"use client";

import { useEffect, useState, useMemo, Fragment, useRef, useId } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Heart, Calendar, Link as LinkIcon, ShoppingBag, ChevronLeft, ExternalLink, Link2, Info, User as UserIcon, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import ReactDOM from "react-dom";
import { CommentsSection } from "@/components/events/comments-section";
import { trackPerformance } from "@/lib/performance";

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

import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

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

export type OnlineEventDetail = {
  id: number;
  event_id: number;
  title: string;
  description: string;
  start_at: string | null;
  end_at: string | null;
  image_url: string | null;
  links: { link_name: string; link_url: string }[] | null;
  channels: { id: number; name: string; image_url: string; type: string; owner_id: string; company?: string | null }[];
};

export function OnlineEventDetailClient({ initialEvent }: { initialEvent: OnlineEventDetail }) {
  const uniqueId = useId().replace(/:/g, "-");
  const toolbarId = `quill-toolbar-${uniqueId}`;
  const inputId = `toolbar-font-size-input-${uniqueId}`;
  const btnUpId = `toolbar-size-up-${uniqueId}`;
  const btnDownId = `toolbar-size-down-${uniqueId}`;

  const router = useRouter();
  const [event, setEvent] = useState<OnlineEventDetail>(initialEvent);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userCompData, setUserCompData] = useState<{name: string} | null>(null);
  const [heartAnim, setHeartAnim] = useState(false);

  const eventId = event.id;

  const isPastEvent = useMemo(() => {
    if (!event) return false;
    const endDateStr = event.end_at;
    const startDateStr = event.start_at;
    if (!endDateStr && !startDateStr) return false;
    const dateStr = endDateStr || startDateStr;
    if (!dateStr) return false;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    return targetDate < today;
  }, [event]);
  
  const [activeTab, setActiveTab] = useState<'main' | 'notices'>('main');
  
  const searchParams = useSearchParams();
  useEffect(() => {
    const noticeId = searchParams.get("notice_id");
    const activeTabParam = searchParams.get("activeTab");
    const tabParam = searchParams.get("tab");
    
    if (noticeId || activeTabParam === "notices" || tabParam === "notices") {
      setActiveTab("notices");
    }
  }, [searchParams]);

  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesLoaded, setIsNoticesLoaded] = useState(false);
  const [isNoticesLoading, setIsNoticesLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);

  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const lastSelectionRef = useRef<any>(null);

  const quillRef = useRef<any>(null);
  const [directFontSize, setDirectFontSize] = useState('16');
  const directFontSizeRef = useRef(directFontSize);
  useEffect(() => {
    directFontSizeRef.current = directFontSize;
  }, [directFontSize]);

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
    q.focus();
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

  useEffect(() => {
    if (!isWritingNotice) return;

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

      btnUp?.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleUp();
      });
      btnDown?.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleDown();
      });
      quill?.on('selection-change', handleSelectionChange);
    }, 100);

    return () => {
      clearTimeout(timer);
      quill?.off('selection-change', handleSelectionChange);
    };
  }, [isWritingNotice, inputId, btnUpId, btnDownId]);

  interface FloatingButton {
    src: string;
    top: number;
    left: number;
  }
  const [floatingButtons, setFloatingButtons] = useState<FloatingButton[]>([]);
  const editorContainerRef = useRef<HTMLDivElement>(null);

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
    if (!isWritingNotice) {
      setFloatingButtons([]);
      return;
    }
    const handle = requestAnimationFrame(updateFloatingButtons);
    return () => cancelAnimationFrame(handle);
  }, [noticeContent, isWritingNotice]);

  useEffect(() => {
    if (!isWritingNotice) return;
    
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
  }, [isWritingNotice, noticeContent]);

  const handleDeleteImageFromEditor = (src: string) => {
    const escapedSrc = src.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexImg = new RegExp(`<img[^>]+src=["']${escapedSrc}["'][^>]*>`, 'g');
    setNoticeContent(prev => {
      const next = prev.replace(regexImg, '');
      return next;
    });
    toast.success('선택한 이미지가 공지 본문에서 제거되었습니다.');
  };

  const isOwner = useMemo(() => {
    if (!user || !event) return false;
    return event.channels.some(ch => {
      if (ch.owner_id === user.id) return true;
      if (userCompData?.name && ch.company === userCompData.name) return true;
      return false;
    });
  }, [user, event, userCompData]);

  const pinnedNotices = useMemo(() => {
    return notices;
  }, [notices]);

  const uploadNoticeImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

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
    } catch (err) {
      console.error('Image upload catch err:', err);
      return null;
    }
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
                toast.error('이미지 업로드에 실패했습니다.');
              }
            }
          };
        }
      }
    }
  }), [toolbarId]);

  const quillFormats = [
    'header', 'size',
    'align',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  const fetchNotices = async () => {
    if (isNoticesLoaded || !event) return;
    setIsNoticesLoading(true);
    try {
      const { data, error } = await trackPerformance("공지사항 목록 조회 (Client)", "client", () =>
        supabase
          .from('channel_notices')
          .select('*, channels(name, image_url), comments(count)')
          .eq('event_id', event.event_id)
          .order('created_at', { ascending: false })
      );
      
      if (error) throw error;

      if (data) {
        const noticesWithComments = data.map(n => ({
          ...n,
          commentsCount: n.comments?.[0]?.count || 0
        }));
        setNotices(noticesWithComments);
      } else {
        setNotices([]);
      }
    } catch (e) {
      console.error('Error fetching notices:', e);
    } finally {
      setIsNoticesLoaded(true);
      setIsNoticesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'notices') {
      fetchNotices();
    }
  }, [activeTab, event, isNoticesLoaded]);

  const extractNoticeImagePaths = (htmlContent: string): string[] => {
    if (!htmlContent) return [];
    const regex = /storage\/v1\/object\/public\/notices\/([^"'\s>]+)/g;
    const paths: string[] = [];
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
      if (match[1]) {
        try {
          paths.push(decodeURIComponent(match[1]));
        } catch {
          paths.push(match[1]);
        }
      }
    }
    return paths;
  };

  const extractImageUrls = (htmlContent: string): string[] => {
    if (!htmlContent) return [];
    const regex = /<img[^>]+src=["']([^"']+)["']/g;
    const urls: string[] = [];
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  };

  const handleSaveNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }
    
    if (editingNoticeId !== null) {
      const oldNotice = notices.find(n => n.id === editingNoticeId);
      if (oldNotice) {
        const oldPaths = extractNoticeImagePaths(oldNotice.content);
        const newPaths = extractNoticeImagePaths(noticeContent);
        const deletedPaths = oldPaths.filter(path => !newPaths.includes(path));

        if (deletedPaths.length > 0) {
          await supabase.storage
            .from('notices')
            .remove(deletedPaths);
        }
      }

      const { data, error } = await supabase
        .from('channel_notices')
        .update({
          title: noticeTitle,
          content: noticeContent
        })
        .eq('id', editingNoticeId)
        .select('*, channels(name, image_url)')
        .single();

      if (error) {
        toast.error('공지사항 수정에 실패했습니다.');
        console.error(error);
      } else {
        toast.success('공지사항이 수정되었습니다.');
        setNotices(notices.map(n => n.id === editingNoticeId ? data : n));
        setSelectedNoticeId(data.id);
        setEditingNoticeId(null);
        setIsWritingNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
      }
    } else {
      const channelId = event?.channels.find(ch => ch.owner_id === user?.id)?.id;
      
      const { data, error } = await supabase
        .from('channel_notices')
        .insert({
          event_id: event!.event_id,
          channel_id: channelId,
          title: noticeTitle,
          content: noticeContent
        })
        .select('*, channels(name, image_url)')
        .single();

      if (error) {
        toast.error('공지사항 저장에 실패했습니다.');
        console.error(error);
      } else {
        toast.success('공지사항이 저장되었습니다.');
        setNotices([data, ...notices]);
        setIsWritingNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
      }
    }
  };

  const handleDeleteNotice = async (noticeId: number) => {
    if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;
    
    const targetNotice = notices.find(n => n.id === noticeId);
    if (targetNotice) {
      const paths = extractNoticeImagePaths(targetNotice.content);
      if (paths.length > 0) {
        await supabase.storage
          .from('notices')
          .remove(paths);
      }
    }

    const { error } = await supabase
      .from('channel_notices')
      .delete()
      .eq('id', noticeId);

    if (error) {
      toast.error('공지사항 삭제에 실패했습니다.');
      console.error(error);
    } else {
      toast.success('공지사항이 삭제되었습니다.');
      setNotices(notices.filter(n => n.id !== noticeId));
      setSelectedNoticeId(null);
    }
  };

  const getNoticeViews = (noticeId: number) => {
    const notice = notices.find(n => n.id === noticeId);
    return notice?.views ?? 0;
  };

  const handleViewNotice = async (noticeId: number) => {
    setSelectedNoticeId(noticeId);
    
    try {
      if (user) {
        const { error: viewError } = await supabase
          .from('notice_views')
          .insert({ notice_id: noticeId, user_id: user.id });

        if (!viewError) {
          const currentNotice = notices.find(n => n.id === noticeId);
          const currentViews = Number(currentNotice?.views || 0);
          
          await supabase
            .from('channel_notices')
            .update({ views: currentViews + 1 })
            .eq('id', noticeId);

          setNotices(prevNotices =>
            prevNotices.map(n => n.id === noticeId ? { ...n, views: currentViews + 1 } : n)
          );
        }
      } else {
        const guestViewedKey = `guest_viewed_notice_${noticeId}`;
        if (!localStorage.getItem(guestViewedKey)) {
          localStorage.setItem(guestViewedKey, 'true');
          
          const currentNotice = notices.find(n => n.id === noticeId);
          const currentViews = Number(currentNotice?.views || 0);
          
          await supabase
            .from('channel_notices')
            .update({ views: currentViews + 1 })
            .eq('id', noticeId);

          setNotices(prevNotices =>
            prevNotices.map(n => n.id === noticeId ? { ...n, views: currentViews + 1 } : n)
          );
        }
      }
    } catch (err) {
      console.error('Error tracking notice views:', err);
    }
  };

  // Parallelized Session and Bookmark fetch
  useEffect(() => {
    let active = true;
    const syncSessionAndBookmark = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setUser(session?.user ?? null);

      if (session?.user) {
        // Query company info and bookmark status in parallel
        const companyPromise = supabase.from("companies").select("name").eq("user_id", session.user.id).maybeSingle();
        const bookmarkPromise = trackPerformance("관심 북마크 여부 조회 (Client)", "api", () =>
          supabase
            .from("event_bookmarks")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("event_id", event.event_id)
            .maybeSingle()
        );

        const [compRes, bookmarkRes] = await Promise.all([companyPromise, bookmarkPromise]);
        if (!active) return;
        setUserCompData(compRes.data);
        setIsBookmarked(!!bookmarkRes.data);
      } else {
        if (!active) return;
        setUserCompData(null);
      }
    };

    syncSessionAndBookmark();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data } = await supabase.from("companies").select("name").eq("user_id", session.user.id).maybeSingle();
        if (!active) return;
        setUserCompData(data);
        const { data: bookmarkData } = await supabase
          .from("event_bookmarks")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("event_id", event.event_id)
          .maybeSingle();
        if (!active) return;
        setIsBookmarked(!!bookmarkData);
      } else {
        if (!active) return;
        setUserCompData(null);
        setIsBookmarked(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [event.event_id]);

  const handleBookmark = async () => {
    if (!user) {
      toast("로그인이 필요합니다.");
      return;
    }
    
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);

    if (!event?.event_id) return;

    if (isBookmarked) {
      await supabase
        .from("event_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", event.event_id);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, event_id: event.event_id });
      setIsBookmarked(true);
      toast("관심 행사가 저장되었습니다");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("정말 이 행사를 삭제하시겠습니까? (공동 주최 정보도 함께 삭제됩니다)")) return;

    try {
      if (!event?.event_id) throw new Error("이벤트 정보를 찾을 수 없습니다.");

      if (event.image_url && event.image_url.includes("/storage/v1/object/public/event_images/event-main-image/")) {
        const parts = event.image_url.split("event-main-image/");
        const fileName = parts[parts.length - 1];
        if (fileName) {
          try {
            await supabase.storage.from("event_images").remove([`event-main-image/${fileName}`]);
          } catch (storageErr) {
            console.error("Failed to delete event main image from storage:", storageErr);
          }
        }
      }

      await supabase.from("event_channels").delete().eq("event_id", event.event_id);
      await supabase.from("event_bookmarks").delete().eq("event_id", event.event_id);
      await supabase.from("channel_notices").delete().eq("event_id", event.event_id);
      
      const { error: delOnErr } = await supabase.from("online_events").delete().eq("id", eventId);
      if (delOnErr) throw delOnErr;

      const { error: delBaseErr } = await supabase.from("events").delete().eq("id", event.event_id);
      if (delBaseErr) throw delBaseErr;
      
      toast.success("행사가 삭제되었습니다.");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      toast.error("행사 삭제 중 오류가 발생했습니다.");
    }
  };

  const formatOnlineEventDateFull = (start: string | null, end: string | null) => {
    if (!start) return <div className="font-semibold text-[15px]">상시</div>;

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = days[d.getDay()];
      
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      
      return `${year}.${month}.${day} (${dayOfWeek}) ${hours}:${minutes}`;
    };

    const startFormatted = formatDate(start);
    if (!end) return <div className="font-semibold text-[15px]">{startFormatted}</div>;
    
    const endFormatted = formatDate(end);
    return (
      <div className="flex flex-col text-[15px] font-semibold leading-snug text-foreground">
        <span>{startFormatted} ~</span>
        <span>{endFormatted}</span>
      </div>
    );
  };

  const urlRegex = /(https?:\/\/[^\s]+|(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9.-]+\.(?:com|net|org|co\.kr|kr|io|tv|me|link|info|page|xyz|site|run|space|app|co|ee|so)(?:\/[^\s]*)?)/g;
  const descriptionWithLinks = event.description ? event.description.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      let href = part;
      if (!/^https?:\/\//i.test(part)) {
        href = `https://${part}`;
      }
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>;
    }
    return part;
  }) : "소개가 없습니다.";
  
  const firstExplicitLink = event.links && event.links.filter(l => l.link_url.trim()).length > 0
    ? event.links.filter(l => l.link_url.trim())[0]
    : null;

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("클립보드에 저장됐습니다");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-12">
      <Header />

      {/* 1. Hero Section Container with floating back button */}
      <div className="mx-auto max-w-2xl md:max-w-6xl relative mt-2 md:mt-6 mb-4 md:mb-6 px-4 md:px-0">
        {/* Floating Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute left-4 md:-left-24 top-6 md:top-8 z-40 flex items-center justify-center w-16 h-16 rounded-full border border-border/60 bg-white/90 dark:bg-muted/90 text-foreground shadow-md backdrop-blur-sm hover:scale-105 active:scale-95 transition-all"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="w-8 h-8 stroke-[2.5]" />
        </button>

        {/* Hero Card content */}
        <div className="bg-background border-x border-b border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:rounded-3xl md:border md:border-slate-200/80 overflow-hidden">
          {/* Top Section (Responsive Row-Reverse on Desktop) */}
          <div className="flex flex-col md:flex-row-reverse md:gap-8 md:p-8 md:items-center">
            {/* Right (Image) on Desktop, Top on Mobile */}
            <div className="w-full md:w-[55%] shrink-0 relative">
              <div className="w-full aspect-[16/9] bg-muted relative md:rounded-2xl overflow-hidden md:shadow-md">
                {event.image_url ? (
                  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-blue-500/80 to-cyan-600/80 flex items-center justify-center">
                      <ShoppingBag className="w-24 h-24 text-white/30" />
                   </div>
                )}
              </div>
            </div>

            {/* Left (Info) on Desktop, Below on Mobile */}
            <div className="w-full md:w-[45%] px-5 md:px-0 pt-0 md:pt-0 pb-6 md:pb-0 flex flex-col justify-center">
              {/* Overlapping Channel Images / Desktop Row Profiles */}
              {event.channels.length > 0 && (
                <div className="relative -mt-8 md:mt-0 mb-4 md:mb-6 z-20 flex items-center -space-x-3 md:-space-x-3">
                  {event.channels.map((channel, i) => (
                    <div 
                      key={channel.id} 
                      className="transition-transform hover:scale-105 hover:z-30 cursor-pointer relative" 
                      style={{ zIndex: 20 - i }}
                      onClick={() => router.push(`/channels/${channel.id}`)}
                    >
                      <div className="w-16 h-16 md:w-14 md:h-14 rounded-full border-4 md:border-2 border-background shadow-md overflow-hidden bg-muted flex items-center justify-center">
                        {channel.image_url ? (
                          <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg md:text-base font-bold text-muted-foreground">{channel.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start justify-between md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center md:items-start md:flex-col gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl md:text-2xl font-bold tracking-tight break-keep leading-tight text-foreground animate-in fade-in duration-300">
                        {event.title}
                      </h1>
                      {isPastEvent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-500 dark:bg-slate-805 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 select-none">
                          지나간 행사
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] md:text-base text-muted-foreground font-medium shrink-0 whitespace-nowrap mt-0.5 md:mt-0">
                      {event.channels.length > 0 ? event.channels[0].name : "온라인 행사"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Owner Action Row */}
              {isOwner && (
                <div className="flex gap-2 mt-4 md:mt-6">
                  <button 
                    onClick={() => router.push(`/online-events/${event.id}/edit`)}
                    className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                  >
                    행사 수정
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-2 bg-destructive/10 text-destructive text-sm font-semibold rounded-xl hover:bg-destructive/20 transition-colors"
                  >
                    행사 삭제
                  </button>
                </div>
              )}

              {/* Action Buttons Row (Save, Link, Share) */}
              <div className="flex justify-around md:justify-start md:gap-3 items-center mt-6 md:mt-8 pt-5 md:pt-0 border-t md:border-t-0 border-border/40">
                <button 
                  onClick={handleBookmark} 
                  className={`flex flex-col items-center gap-2 transition-colors w-full md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:text-sm md:font-semibold md:shadow-sm
                    ${isBookmarked 
                      ? "text-pink-500 md:bg-pink-500 md:text-white md:border-pink-500 md:hover:bg-pink-600" 
                      : "text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] md:bg-background md:text-[#3a5378] dark:md:text-[#a0b8d6] md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10"
                    }`}
                >
                  <div className="w-10 h-10 md:w-5 md:h-5 flex items-center justify-center">
                    <Heart className={`w-6 h-6 md:w-4 md:h-4 ${isBookmarked ? "fill-pink-500 md:fill-white" : ""}`} />
                  </div>
                  <span className="text-[12px] md:text-sm font-medium md:font-semibold">{isBookmarked ? "관심저장" : "저장"}</span>
                </button>

                {firstExplicitLink && (
                  <button 
                    onClick={() => {
                      const url = firstExplicitLink.link_url;
                      const targetUrl = url.startsWith("http") ? url : `https://${url}`;
                      window.open(targetUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="flex flex-col items-center gap-2 text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] transition-colors w-full md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:bg-background md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10 md:text-[#3a5378] dark:md:text-[#a0b8d6] md:text-sm md:font-semibold shadow-sm"
                  >
                    <div className="w-10 h-10 md:w-5 md:h-5 flex items-center justify-center">
                      <ExternalLink className="w-6 h-6 md:w-4 md:h-4" />
                    </div>
                    <span className="text-[12px] md:text-sm font-medium md:font-semibold">이동하기</span>
                  </button>
                )}

                <button 
                  onClick={handleShare}
                  className="flex flex-col items-center gap-2 text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] transition-colors w-full md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:bg-background md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10 md:text-[#3a5378] dark:md:text-[#a0b8d6] md:text-sm md:font-semibold shadow-sm"
                >
                  <div className="w-10 h-10 md:w-5 md:h-5 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-4 md:h-4">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <span className="text-[12px] md:text-sm font-medium md:font-semibold">공유</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Content & Tabs Container */}
      <div className="mx-4 md:mx-auto max-w-2xl md:max-w-6xl bg-background rounded-3xl border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden">
        
        {/* Tabs Header */}
        <div className="flex items-center border-b border-border/60 bg-background select-none">
          <button
            onClick={() => setActiveTab('main')}
            className={cn(
              "flex-1 py-4 text-[15px] md:text-base font-bold transition-all border-b-[3px]",
              activeTab === 'main' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/80 bg-muted/20"
            )}
          >
            메인
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={cn(
              "flex-1 py-4 text-[15px] md:text-base font-bold transition-all border-b-[3px]",
              activeTab === 'notices' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/80 bg-muted/20"
            )}
          >
            공지·안내
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 md:p-8">
          
          {/* --- MAIN TAB --- */}
          {activeTab === 'main' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col select-text divide-y divide-slate-100 dark:divide-slate-800/60 pb-2">
                
                {/* 1. 진행 기간 */}
                <div className="flex items-start gap-4 py-4 sm:py-5 first:pt-0">
                  <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                    <Calendar className="w-[22px] h-[22px] stroke-[2]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug">진행 기간</p>
                    <div className="text-slate-700 dark:text-slate-300 font-semibold break-keep text-[15px] md:text-[16px] mt-1.5">
                      {formatOnlineEventDateFull(event.start_at, event.end_at)}
                    </div>
                  </div>
                </div>

                {/* 2. 주최 채널 */}
                {event.channels.length > 0 && (
                  <div className="flex items-start gap-4 py-4 sm:py-5">
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] stroke-[2]">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 mb-3 leading-snug">주최 채널</p>
                      <div className="flex flex-wrap gap-2.5">
                        {event.channels.map(channel => (
                          <button 
                            key={channel.id} 
                            onClick={() => router.push(`/channels/${channel.id}`)}
                            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-850 rounded-full pr-3.5 p-1 border border-border/60 shadow-sm transition-all"
                          >
                            <Avatar className="w-7 h-7 border border-background shadow-sm">
                              <AvatarImage src={channel.image_url || undefined} className="object-cover bg-muted" />
                              <AvatarFallback className="bg-muted text-[10px] font-bold">{channel.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{channel.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 관련 링크 */}
                {event.links && event.links.filter(l => l.link_name.trim() && l.link_url.trim()).length > 0 && (
                  <div className="flex items-start gap-4 py-4 sm:py-5 last:pb-0">
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <LinkIcon className="w-[22px] h-[22px] stroke-[2]" />
                    </div>
                    <div className="flex-1 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug">
                      <p className="font-bold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 mb-3">링크</p>
                      <div className="flex flex-col gap-4">
                        {event.links
                          .filter(l => l.link_name.trim() && l.link_url.trim())
                          .map((link, idx) => (
                            <div key={idx} className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-[15px] md:text-[16px]">
                              <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                                {link.link_name}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 shrink-0">:</span>
                              <a
                                href={link.link_url.startsWith("http") ? link.link_url : `https://${link.link_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 dark:text-blue-400 hover:underline font-medium break-all"
                              >
                                {link.link_url.replace(/^(https?:\/\/)?(www\.)?/, "")}
                              </a>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- NOTICES TAB --- */}
          {activeTab === 'notices' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[17px] md:text-xl font-bold text-foreground flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-primary rounded-full inline-block"></span>
                  공지·안내
                </h2>
                {isOwner && (
                  <button
                    onClick={() => {
                      if (isWritingNotice) {
                        setIsWritingNotice(false);
                        setEditingNoticeId(null);
                        setNoticeTitle('');
                        setNoticeContent('');
                      } else {
                        setIsWritingNotice(true);
                      }
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    {isWritingNotice ? '취소' : '글 작성'}
                  </button>
                )}
              </div>

              {isWritingNotice && isOwner && (
                <div className="mb-8 p-5 bg-card rounded-2xl border border-border shadow-sm">
                  <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-1.5">
                    <span className="w-1 h-3.5 bg-primary rounded-full inline-block"></span>
                    {editingNoticeId !== null ? '공지사항 수정' : '새 공지사항 작성'}
                  </h3>
                  <input
                    type="text"
                    placeholder="공지 제목을 입력하세요"
                    value={noticeTitle}
                    onChange={e => setNoticeTitle(e.target.value)}
                    className="w-full mb-4 px-4 py-3 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
                  />
                  
                  <div ref={editorContainerRef} className="relative mb-4 bg-background border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 text-foreground">
                    <style dangerouslySetInnerHTML={{ __html: `
                      .ql-toolbar button {
                        border: 1px solid transparent !important;
                        border-radius: 4px;
                        transition: all 0.15s ease;
                      }
                      .ql-toolbar button.ql-active {
                        border: 1px solid #3b82f6 !important;
                        border-radius: 4px;
                        background-color: rgba(59, 130, 246, 0.08) !important;
                      }
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
                    
                    <div id={toolbarId} className="border-b border-border bg-slate-50 dark:bg-muted/10 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 select-none">
                      <span className="ql-formats">
                        <button className="ql-image" title="이미지 업로드" />
                      </span>
                      
                      <span className="ql-formats" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', float: 'none', verticalAlign: 'middle' }}>
                        <span className="text-xs font-bold text-muted-foreground mr-1 select-none">크기:</span>
                        <input
                          id={inputId}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="w-12 h-6 px-1 text-xs text-center font-bold bg-background text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
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
                        />
                        <span className="text-[10px] text-muted-foreground font-semibold select-none">px</span>
                        
                        <div className="flex flex-col gap-0.5 ml-1 select-none">
                          <button
                            id={btnUpId}
                            type="button"
                            className="w-3.5 h-3 flex items-center justify-center text-[8px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-sm font-bold active:scale-95"
                            title="크기 키우기"
                          >
                            ▲
                          </button>
                          <button
                            id={btnDownId}
                            type="button"
                            className="w-3.5 h-3 flex items-center justify-center text-[8px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-sm font-bold active:scale-95"
                            title="크기 줄이기"
                          >
                            ▼
                          </button>
                        </div>
                      </span>

                      <span className="ql-formats">
                        <button className="ql-bold" title="굵게" />
                        <button className="ql-italic" title="기울임" />
                        <button className="ql-underline" title="밑줄" />
                        <button className="ql-strike" title="취소선" />
                        <button className="ql-blockquote" title="인용구" />
                      </span>
                      <span className="ql-formats">
                        <button className="ql-list" value="ordered" title="번호 리스트" />
                        <button className="ql-list" value="bullet" title="불릿 리스트" />
                      </span>
                      <span className="ql-formats">
                        <button className="ql-align" value="" title="왼쪽 정렬" />
                        <button className="ql-align" value="center" title="가운데 정렬" />
                        <button className="ql-align" value="right" title="오른쪽 정렬" />
                        <button className="ql-align" value="justify" title="양쪽 정렬" />
                      </span>
                    </div>

                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={noticeContent}
                      onChange={setNoticeContent}
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="공지 내용을 작성해보세요. 이미지 업로드 및 하이퍼링크가 지원됩니다."
                      className="min-h-[250px]"
                    />
                    
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

                  {(() => {
                    const regex = /<img[^>]+src=["']([^"']+)["']/g;
                    const urls: string[] = [];
                    let match;
                    while ((match = regex.exec(noticeContent)) !== null) {
                      if (match[1]) urls.push(match[1]);
                    }
                    if (urls.length === 0) return null;

                    return (
                      <div className="mb-4 p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-muted/10">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5">본문 업로드 이미지 목록 ({urls.length})</p>
                        <div className="flex flex-wrap gap-3">
                          {urls.map((src, idx) => (
                            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm shrink-0 bg-muted group">
                              <img src={src} alt="Attached" className="w-full h-full object-cover" />
                              <button
                                onClick={() => {
                                  const escapedSrc = src.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                  const regexImg = new RegExp(`<img[^>]+src=["']${escapedSrc}["'][^>]*>`, 'g');
                                  setNoticeContent(prev => prev.replace(regexImg, ''));
                                  toast.success('선택한 이미지가 공지 본문에서 제거되었습니다.');
                                }}
                                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center transition-all hover:scale-110 shadow-md z-20"
                                title="본문에서 이미지 삭제"
                              >
                                <span className="text-[10px] font-extrabold leading-none">✕</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsWritingNotice(false);
                        const prevId = editingNoticeId;
                        setEditingNoticeId(null);
                        setNoticeTitle('');
                        setNoticeContent('');
                        if (prevId !== null) {
                          setSelectedNoticeId(prevId);
                        }
                      }}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-sm rounded-xl transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveNotice}
                      className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      {editingNoticeId !== null ? '수정하기' : '저장하기'}
                    </button>
                  </div>
                </div>
              )}

              {!isWritingNotice && (
                isNoticesLoading ? (
                  <div className="py-10 text-center text-muted-foreground text-sm font-bold animate-pulse">
                    불러오는 중...
                  </div>
                ) : selectedNoticeId !== null ? (
                  (() => {
                    const notice = notices.find(n => n.id === selectedNoticeId);
                    if (!notice) return null;

                    const views = getNoticeViews(notice.id);
                    const fullDateStr = new Date(notice.created_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div className="md:border md:border-border/60 md:rounded-2xl bg-transparent md:bg-background md:shadow-sm min-h-[500px] flex flex-col p-0 md:p-8 animate-in fade-in duration-300">
                        <div className="flex items-center pb-3">
                          <button
                            onClick={() => setSelectedNoticeId(null)}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-all hover:scale-105"
                            aria-label="목록으로 가기"
                          >
                            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                          </button>
                        </div>

                        <div className="border-b border-border/60 mb-6" />

                        <div className="flex-1 flex flex-col">
                          <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug tracking-tight mb-4 select-text">
                            {notice.title}
                          </h1>

                          <div className="flex items-center gap-3 mb-6 select-text">
                            <Avatar className="w-10 h-10 border border-border shadow-sm shrink-0">
                              <AvatarImage src={notice.channels?.image_url || undefined} className="object-cover bg-muted" />
                              <AvatarFallback className="bg-muted text-xs font-bold">{notice.channels?.name?.charAt(0) || "운"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-foreground">{notice.channels?.name || "공식 채널"}</span>
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold select-none">작성자</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-semibold">
                                  <span>{fullDateStr}</span>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span>조회 {views}</span>
                                </div>
                              </div>

                              {isOwner && (
                                <div className="flex items-center gap-2.5 text-xs md:text-sm font-bold select-none shrink-0 self-end sm:self-center">
                                  <button
                                    onClick={() => {
                                      setNoticeTitle(notice.title);
                                      setNoticeContent(notice.content);
                                      setEditingNoticeId(notice.id);
                                      setIsWritingNotice(true);
                                      setSelectedNoticeId(null);
                                    }}
                                    className="text-muted-foreground hover:text-primary transition-all hover:scale-105"
                                  >
                                    수정
                                  </button>
                                  <span className="text-muted-foreground/20 font-normal">|</span>
                                  <button
                                    onClick={() => handleDeleteNotice(notice.id)}
                                    className="text-rose-500 hover:text-rose-600 transition-all hover:scale-105"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 select-text">
                            <div 
                              className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 leading-relaxed break-words ql-editor-display"
                              dangerouslySetInnerHTML={{ __html: notice.content }}
                            />
                          </div>

                          <div className="mt-10 pt-8 border-t border-border/60">
                            <CommentsSection noticeId={notice.id} isOrganizer={isOwner} user={user} />
                          </div>
                        </div>

                        <div className="border-t border-border/60 mt-8 pt-6 flex justify-center">
                          <button
                            onClick={() => setSelectedNoticeId(null)}
                            className="px-6 py-2.5 border border-border bg-background hover:bg-muted text-foreground font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
                          >
                            목록으로 돌아가기
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col bg-background md:border border-border/60 md:rounded-2xl md:shadow-sm overflow-hidden divide-y divide-border/60 -mx-5 md:mx-0 border-t border-b border-border/60 md:border-t-0 md:border-b-0 min-h-[500px]">
                    {pinnedNotices.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-semibold bg-muted/5 py-32">
                        등록된 공지·안내가 없습니다.
                      </div>
                    ) : (
                      pinnedNotices.map(notice => {
                        const views = getNoticeViews(notice.id);
                        const dateStr = new Date(notice.created_at).toLocaleDateString('ko-KR', { 
                          month: '2-digit', 
                          day: '2-digit' 
                        }).replaceAll(" ", "");

                        const imageUrls = extractImageUrls(notice.content);
                        const hasImage = imageUrls.length > 0;
                        const thumbnail = hasImage ? imageUrls[0] : null;

                        return (
                          <div key={notice.id} className="bg-background hover:bg-muted/10 transition-colors">
                            <button
                              onClick={() => handleViewNotice(notice.id)}
                              className="w-full h-[76px] md:h-[92px] px-5 md:px-8 text-left flex items-center justify-between gap-4"
                            >
                              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="shrink-0 inline-flex items-center justify-center bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[10.5px] px-1.5 py-0.5 rounded font-extrabold select-none">
                                    공지
                                  </span>
                                  <span className="text-foreground font-semibold text-[15px] md:text-[16px] leading-snug hover:text-primary transition-colors hover:underline truncate">
                                    {notice.title}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-1.5 md:gap-2.5 text-xs text-muted-foreground font-semibold min-w-0">
                                  <span className="text-slate-700 dark:text-slate-300 font-bold truncate shrink">{notice.channels?.name || "공식 채널"}</span>
                                  <span className="text-muted-foreground/30 shrink-0">•</span>
                                  <span className="shrink-0">{dateStr}</span>
                                  <span className="text-muted-foreground/30 shrink-0">•</span>
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
                                    {views}
                                  </span>
                                  <span className="text-muted-foreground/30 shrink-0">•</span>
                                  <span className="flex items-center gap-1 shrink-0">
                                    <MessageSquare className="w-3.5 h-3.5 stroke-[2.2]" />
                                    {notice.commentsCount || 0}
                                  </span>
                                </div>
                              </div>

                              {hasImage && thumbnail && (
                                <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border border-border/40 shrink-0 shadow-sm">
                                  <img 
                                    src={thumbnail} 
                                    alt="공지 이미지" 
                                    className="w-full h-full object-cover" 
                                  />
                                  {imageUrls.length > 1 && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-extrabold text-[11px] md:text-[13px] select-none tracking-wider">
                                      {imageUrls.length}+
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Event Description Container */}
      {activeTab === 'main' && event.description && (
        <div className="mx-4 md:mx-auto max-w-2xl md:max-w-6xl bg-background rounded-3xl p-6 md:p-10 border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden animate-in fade-in duration-300">
          <h2 className="text-[17px] md:text-xl font-bold mb-6 text-foreground flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full inline-block"></span>
            행사 정보
          </h2>
          {(() => {
            const isHtml = /<[a-z][\s\S]*>/i.test(event.description);
            if (isHtml) {
              return (
                <div 
                  className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed break-words ql-editor-display"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              );
            }
            return (
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 font-medium select-text">
                {descriptionWithLinks}
              </div>
            );
          })()}
        </div>
      )}

      {/* Comments Section */}
      {activeTab === 'main' && (
        <div className="mx-4 md:mx-auto max-w-2xl md:max-w-6xl bg-background rounded-3xl p-6 md:p-10 border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden animate-in fade-in duration-300">
          <CommentsSection eventId={event.event_id} isOrganizer={isOwner} user={user} />
        </div>
      )}

      <style jsx global>{`
        .ql-toolbar.ql-snow {
          border-color: var(--border) !important;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          background-color: var(--muted)/10;
        }
        .ql-container.ql-snow {
          border-color: var(--border) !important;
          border-bottom-left-radius: 0.75rem;
          border-bottom-right-radius: 0.75rem;
          font-family: inherit;
        }
        .ql-editor {
          min-height: 250px;
        }
        .ql-editor.ql-blank::before {
          color: var(--muted-foreground) !important;
          font-style: normal !important;
          opacity: 0.7;
        }
        .ql-editor-display img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .ql-editor-display a {
          color: #3b82f6 !important;
          text-decoration: underline !important;
          font-weight: bold;
        }
        .ql-editor-display a:hover {
          color: #2563eb !important;
        }
        .ql-editor-display p {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
