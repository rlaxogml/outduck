"use client";

import { useEffect, useState, useMemo, useRef, useId } from "react";
import ReactDOM from "react-dom";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

// React 19 findDOMNode Polyfill (react-quill 호환성 확보용)
if (typeof window !== "undefined") {
  // @ts-ignore
  if (!ReactDOM.findDOMNode) {
    // @ts-ignore
    ReactDOM.findDOMNode = (el) => {
      if (!el) return null;
      if (el instanceof HTMLElement) return el;
      return (el as any).getEditor?.()?.container || el;
    };
  }
}

const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <div className="h-48 w-full bg-muted animate-pulse rounded-xl" />
}) as any;

// Custom Style Attributor를 사용하여 모든 정수 크기(8px~120px)를 지원하도록 size 포맷 커스텀 등록
if (typeof window !== "undefined") {
  import("react-quill").then((QuillModule) => {
    const Quill = (QuillModule.default as any).Quill || QuillModule.Quill;
    const Parchment = Quill.import("parchment");
    const StyleAttributor = Quill.import("attributors/style/size").constructor;
    const CustomSizeAttributor = new StyleAttributor("size", "font-size", {
      scope: Parchment.Scope.INLINE
    });
    Quill.register(CustomSizeAttributor, true);
  }).catch(err => {
    console.error("[Quill Init] Failed to load Quill CustomSizeAttributor registration:", err);
  });
}

const uploadNoticeImage = async (file: File): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // notices 버킷이 없더라도 안전하게 업로드를 유도
    const { data, error } = await supabase.storage
      .from('notices')
      .upload(filePath, file);

    if (error) {
      console.error('Image upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('notices')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (e) {
    console.error(e);
    return null;
  }
};

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

interface FloatingButton {
  src: string;
  top: number;
  left: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "공지 내용을 작성해보세요. 이미지 업로드 및 하이퍼링크가 지원됩니다."
}: RichTextEditorProps) {
  const uniqueId = useId().replace(/:/g, "-");
  const toolbarId = `quill-toolbar-${uniqueId}`;
  const inputId = `toolbar-font-size-input-${uniqueId}`;
  const btnUpId = `toolbar-size-up-${uniqueId}`;
  const btnDownId = `toolbar-size-down-${uniqueId}`;

  const quillRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [directFontSize, setDirectFontSize] = useState('16');
  const directFontSizeRef = useRef(directFontSize);
  const lastSelectionRef = useRef<any>(null);
  const [floatingButtons, setFloatingButtons] = useState<FloatingButton[]>([]);

  useEffect(() => {
    directFontSizeRef.current = directFontSize;
  }, [directFontSize]);

  // 워드프로세서 스타일의 글꼴 크기 처리 함수들
  const getCurrentFontSize = (): number => {
    const q = quillRef.current?.getEditor();
    if (!q) return 16;
    const range = q.getSelection() || lastSelectionRef.current;
    let sizeVal: any = undefined;
    if (range) {
      const formats = q.getFormat(range.index, Math.max(range.length, 1));
      sizeVal = formats.size;
    } else {
      const formats = q.getFormat();
      sizeVal = formats.size;
    }
    const raw = Array.isArray(sizeVal) ? sizeVal[0] : sizeVal;
    if (raw) {
      const parsed = parseInt(String(raw).replace(/[^0-9]/g, ''));
      if (!isNaN(parsed)) return parsed;
    }
    const stateVal = parseInt(directFontSizeRef.current);
    return isNaN(stateVal) ? 16 : stateVal;
  };

  const applySize = (sizeVal: number) => {
    if (sizeVal < 8 || sizeVal > 120) return;
    const q = quillRef.current?.getEditor();
    if (!q) return;
    const range = q.getSelection() || lastSelectionRef.current;
    
    const inputElement = document.getElementById(inputId);
    if (document.activeElement !== inputElement) {
      q.focus();
    }

    if (range) {
      if (range.length > 0) {
        q.formatText(range.index, range.length, 'size', `${sizeVal}px`);
      } else {
        q.format('size', `${sizeVal}px`);
      }
    } else {
      q.format('size', `${sizeVal}px`);
    }
  };

  const handleUp = () => {
    const q = quillRef.current?.getEditor();
    if (!q) return;
    const current = getCurrentFontSize();
    const next = Math.min(120, current + 1);
    setDirectFontSize(String(next));
    applySize(next);
  };

  const handleDown = () => {
    const q = quillRef.current?.getEditor();
    if (!q) return;
    const current = getCurrentFontSize();
    const next = Math.max(8, current - 1);
    setDirectFontSize(String(next));
    applySize(next);
  };

  const quillModules = useMemo(() => ({
    toolbar: {
      container: '#' + toolbarId,
      handlers: {
        image: function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          input.onchange = async () => {
            const file = input.files?.[0];
            if (file) {
              const toastId = toast.loading('이미지를 업로드하고 있습니다...');
              const url = await uploadNoticeImage(file);
              toast.dismiss(toastId);
              if (url) {
                // @ts-ignore
                const quill = this.quill;
                const range = quill.getSelection();
                if (range) {
                  quill.insertEmbed(range.index, 'image', url);
                  quill.setSelection(range.index + 1);
                } else {
                  quill.insertEmbed(quill.getLength(), 'image', url);
                }
                toast.success('이미지 업로드에 성공했습니다.');
              } else {
                toast.error('이미지 업로드에 실패했습니다. notices 스토리지 버킷이 생성되어 있으며 공개 액세스가 가능한지 확인해주세요.');
              }
            }
          };
        }
      }
    }
  }), [toolbarId]);

  const quillFormats = [
    'size',
    'align',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  // --- Quill Editor Image Close Button Overlay Logic ---
  const updateFloatingButtons = () => {
    if (!editorContainerRef.current) return;
    const container = editorContainerRef.current;
    const qlEditor = container.querySelector('.ql-editor');
    if (!qlEditor) return;

    const images = qlEditor.querySelectorAll('img');
    const containerRect = container.getBoundingClientRect();

    const buttons: FloatingButton[] = [];
    images.forEach((img) => {
      const imgRect = img.getBoundingClientRect();
      const top = imgRect.top - containerRect.top + 16;
      const left = imgRect.left - containerRect.left + 16;

      buttons.push({
        src: img.getAttribute('src') || img.src,
        top,
        left,
      });
    });

    setFloatingButtons(buttons);
  };

  useEffect(() => {
    const handle = requestAnimationFrame(updateFloatingButtons);
    return () => cancelAnimationFrame(handle);
  }, [value]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const qlEditor = container.querySelector('.ql-editor');
    const handleScroll = () => {
      updateFloatingButtons();
    };

    qlEditor?.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    const observer = new MutationObserver(() => {
      updateFloatingButtons();
    });
    if (qlEditor) {
      observer.observe(qlEditor, { childList: true, subtree: true, attributes: true });
    }

    const timer = setInterval(updateFloatingButtons, 500);

    return () => {
      qlEditor?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      observer.disconnect();
      clearInterval(timer);
    };
  }, [value]);

  const handleDeleteImageFromEditor = (src: string) => {
    const escapedSrc = src.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexImg = new RegExp(`<img[^>]+src=["']${escapedSrc}["'][^>]*>`, 'g');
    onChange(value.replace(regexImg, ''));
    toast.success('선택한 이미지가 공지 본문에서 제거되었습니다.');
  };

  // 폰트 크기 스피너 및 워드프로세서 스타일 연동 useEffect
  useEffect(() => {
    let input: HTMLInputElement | null = null;
    let btnUp: HTMLElement | null = null;
    let btnDown: HTMLElement | null = null;
    let quill: any = null;

    const handleSelectionChange = () => {
      const q = quillRef.current?.getEditor();
      if (!q) return;
      
      const range = q.getSelection();
      if (range) {
        lastSelectionRef.current = range;
      }
      
      if (document.activeElement === input) return;
      
      const current = getCurrentFontSize();
      setDirectFontSize(String(current));
    };

    const timer = setTimeout(() => {
      input = document.getElementById(inputId) as HTMLInputElement;
      btnUp = document.getElementById(btnUpId);
      btnDown = document.getElementById(btnDownId);
      quill = quillRef.current?.getEditor();

      if (quill) {
        try {
          const QConstructor = quill.constructor;
          const Parchment = QConstructor.import("parchment");
          const StyleAttributor = QConstructor.import("attributors/style/size").constructor;
          const CustomSizeAttributor = new StyleAttributor("size", "font-size", {
            scope: Parchment.Scope.INLINE
          });
          QConstructor.register(CustomSizeAttributor, true);
        } catch (e) {
          console.error("[Spinner Setup] Error registering CustomSizeAttributor:", e);
        }
      }

      if (btnUp) btnUp.addEventListener('click', handleUp);
      if (btnDown) btnDown.addEventListener('click', handleDown);
      if (quill) quill.on('selection-change', handleSelectionChange);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (btnUp) btnUp.removeEventListener('click', handleUp);
      if (btnDown) btnDown.removeEventListener('click', handleDown);
      if (quill) quill.off('selection-change', handleSelectionChange);
    };
  }, [inputId, btnUpId, btnDownId]);

  // 에디터 내 이미지 URL 목록 추출 헬퍼
  const getEmbeddedImages = (): string[] => {
    const urls: string[] = [];
    const htmlCopy = value || "";
    let m;
    const re = /<img[^>]+src=["']([^"']+)["']/g;
    while ((m = re.exec(htmlCopy)) !== null) {
      urls.push(m[1]);
    }
    return urls;
  };

  const embeddedImages = getEmbeddedImages();

  return (
    <div className="space-y-4">
      {/* React Quill Editor Container */}
      <div ref={editorContainerRef} className="relative bg-background border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 text-foreground">
        <style dangerouslySetInnerHTML={{ __html: `
          /* 툴바 기본 버튼들에 투명 테두리를 부여하여 레이아웃 시프트 방지 */
          .ql-toolbar button {
            border: 1px solid transparent !important;
            border-radius: 4px;
            transition: all 0.15s ease;
          }
          /* 툴바 활성화 버튼에 테두리 및 반투명 파란색 배경 부여 */
          .ql-toolbar button.ql-active {
            border: 1px solid #3b82f6 !important;
            border-radius: 4px;
            background-color: rgba(59, 130, 246, 0.08) !important;
          }
          /* 정렬 그룹에 활성화 버튼이 없는 초기 진입 상태일 때, 왼쪽 정렬 버튼(value="")을 활성화 상태로 강조 */
          .ql-toolbar .ql-formats:not(:has(button.ql-align.ql-active)) button.ql-align[value=""] {
            border: 1px solid #3b82f6 !important;
            border-radius: 4px;
            background-color: rgba(59, 130, 246, 0.08) !important;
          }
          .ql-toolbar .ql-formats:not(:has(button.ql-align.ql-active)) button.ql-align[value=""] .ql-stroke {
            stroke: #3b82f6 !important;
          }
          .ql-toolbar .ql-formats:not(:has(button.ql-align.ql-active)) button.ql-align[value=""] .ql-fill {
            fill: #3b82f6 !important;
          }
          /* Quill 기본 테두리 제거 및 커스텀 스타일링 */
          .ql-toolbar.ql-snow {
            border: none !important;
          }
          .ql-container.ql-snow {
            border: none !important;
            font-size: 14px;
            font-family: inherit;
          }
          .ql-editor {
            min-height: 250px;
            font-family: inherit;
          }
          .ql-editor.ql-blank::before {
            color: var(--muted-foreground) !important;
            font-style: normal !important;
            opacity: 0.7;
            left: 16px !important;
            right: 16px !important;
          }
        `}} />
        
        {/* Custom HTML Toolbar */}
        <div id={toolbarId} className="border-b border-border bg-slate-50 dark:bg-muted/10 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 select-none">
          {/* 이미지 업로드 버튼 */}
          <span className="ql-formats">
            <button className="ql-image" title="이미지 삽입" />
          </span>

          {/* 글꼴 크기 스피너 */}
          <span className="ql-formats" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', float: 'none', verticalAlign: 'middle' }}>
            <span className="text-xs text-muted-foreground font-semibold shrink-0">크기</span>
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={directFontSize}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setDirectFontSize(val);
                if (val) {
                  const num = Number(val);
                  if (num >= 8 && num <= 120) {
                    applySize(num);
                  }
                }
              }}
              className="w-10 h-7 text-center text-xs font-bold border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 px-1"
              style={{ MozAppearance: 'textfield' }}
            />
            <span className="text-xs text-muted-foreground font-semibold shrink-0">px</span>
            <div className="flex flex-col" style={{ gap: '1px' }}>
              <button
                id={btnUpId}
                type="button"
                className="w-5 h-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="크기 증가"
              >
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 4L4 1L7 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                id={btnDownId}
                type="button"
                className="w-5 h-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="크기 감소"
              >
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </span>

          {/* 서식 버튼들 */}
          <span className="ql-formats">
            <button className="ql-bold" />
            <button className="ql-italic" />
            <button className="ql-underline" />
            <button className="ql-strike" />
            <button className="ql-blockquote" />
          </span>
          <span className="ql-formats">
            <button className="ql-list" value="ordered" />
            <button className="ql-list" value="bullet" />
          </span>
          <span className="ql-formats">
            <button className="ql-align" value="" title="왼쪽 정렬" />
            <button className="ql-align" value="center" title="가운데 정렬" />
            <button className="ql-align" value="right" title="오른쪽 정렬" />
            <button className="ql-align" value="justify" title="양쪽 정렬" />
          </span>
        </div>

        {/* 에디터 본문 */}
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={quillModules}
          formats={quillFormats}
          placeholder={placeholder}
          className="min-h-[250px]"
        />

        {/* 동그란 X 삭제 버튼 오버레이 */}
        {floatingButtons.map((btn, idx) => (
          <button
            key={idx}
            onClick={() => handleDeleteImageFromEditor(btn.src)}
            style={{
              position: 'absolute',
              top: `${btn.top}px`,
              left: `${btn.left}px`,
            }}
            className="w-12 h-12 rounded-full bg-white hover:bg-rose-600 text-black hover:text-white flex items-center justify-center transition-all hover:scale-110 shadow-xl z-30 cursor-pointer border-2 border-black select-none animate-in fade-in zoom-in-75 duration-200"
            title="이 이미지 삭제"
          >
            <span className="text-2xl font-bold leading-none">✕</span>
          </button>
        ))}
      </div>

      {/* 업로드된 이미지 리스트 (X 버튼 클릭 시 삭제) */}
      {embeddedImages.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-muted/10 rounded-xl border border-border">
          <p className="text-xs font-bold text-muted-foreground mb-2">첨부 이미지 ({embeddedImages.length})</p>
          <div className="flex flex-wrap gap-3">
            {embeddedImages.map((url, idx) => (
              <div key={idx} className="relative group">
                <img src={url} alt="첨부이미지" className="w-20 h-20 object-cover rounded-lg border border-border shadow-sm" />
                <button
                  type="button"
                  onClick={() => {
                    // 에디터 본문에서 해당 이미지 src 태그 제거
                    const newContent = value.replace(
                      new RegExp(`<img[^>]+src=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g'),
                      ''
                    );
                    onChange(newContent);
                    // Storage에서도 삭제 시도
                    const storageBase = supabase.storage.from('notices').getPublicUrl('').data.publicUrl.replace(/\/$/, '');
                    if (url.startsWith(storageBase)) {
                      const path = url.replace(storageBase + '/', '');
                      supabase.storage.from('notices').remove([path]);
                    }
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-black text-black rounded-full flex items-center justify-center text-xs font-bold shadow hover:bg-red-500 hover:border-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  title="이미지 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
