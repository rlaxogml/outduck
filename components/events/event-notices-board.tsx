"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import RichTextEditor from "./rich-text-editor";

interface ChannelInfo {
  id: number;
  name: string;
  image_url: string | null;
  type: string;
  owner_id: string;
}

interface EventNoticesBoardProps {
  eventId: number;
  eventChannels: ChannelInfo[];
  isOwner: boolean;
  user: User | null;
}

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

export default function EventNoticesBoard({
  eventId,
  eventChannels,
  isOwner,
  user
}: EventNoticesBoardProps) {
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesLoaded, setIsNoticesLoaded] = useState(false);
  const [isNoticesLoading, setIsNoticesLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  const pinnedNotices = useMemo(() => {
    return notices;
  }, [notices]);

  const regularNotices = useMemo<any[]>(() => {
    return [];
  }, [notices]);

  const fetchNotices = async () => {
    if (isNoticesLoaded || !eventId) return;
    setIsNoticesLoading(true);
    try {
      const { data, error } = await supabase
        .from('channel_notices')
        .select('*, channels(name, image_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setNotices(data);
    } catch (e) {
      console.error(e);
      toast.error('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsNoticesLoaded(true);
      setIsNoticesLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [eventId]);

  const handleSaveNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      if (editingNoticeId !== null) {
        // --- Update Mode ---
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

        if (error) throw error;
        
        toast.success('공지사항이 수정되었습니다.');
        setNotices(notices.map(n => n.id === editingNoticeId ? data : n));
        setSelectedNoticeId(data.id); // 수정된 글의 상세 페이지로 복귀
        setEditingNoticeId(null);
        setIsWritingNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
      } else {
        // --- Insert Mode ---
        const channelId = eventChannels.find(ch => ch.owner_id === user?.id)?.id;
        
        const { data, error } = await supabase
          .from('channel_notices')
          .insert({
            event_id: eventId,
            channel_id: channelId,
            title: noticeTitle,
            content: noticeContent
          })
          .select('*, channels(name, image_url)')
          .single();

        if (error) throw error;

        toast.success('공지사항이 저장되었습니다.');
        setNotices([data, ...notices]);
        setIsWritingNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
      }
    } catch (error) {
      toast.error('공지사항 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleDeleteNotice = async (noticeId: number) => {
    if (!confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

    try {
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

      if (error) throw error;

      toast.success('공지사항이 삭제되었습니다.');
      setNotices(notices.filter(n => n.id !== noticeId));
      setSelectedNoticeId(null);
    } catch (error) {
      toast.error('공지사항 삭제에 실패했습니다.');
      console.error(error);
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
        // 회원 로그인 상태: notice_views 테이블에 중복 방지 인서트 시도
        const { error: viewError } = await supabase
          .from('notice_views')
          .insert({ notice_id: noticeId, user_id: user.id });

        if (!viewError) {
          // 인서트에 성공했다면 (첫 조회라면) DB의 views 1 증가
          const currentNotice = notices.find(n => n.id === noticeId);
          const currentViews = Number(currentNotice?.views || 0);
          
          await supabase
            .from('channel_notices')
            .update({ views: currentViews + 1 })
            .eq('id', noticeId);

          // 로컬 상태 동기화
          setNotices(prevNotices =>
            prevNotices.map(n => n.id === noticeId ? { ...n, views: currentViews + 1 } : n)
          );
        }
      } else {
        // 비로그인 게스트 상태: 로컬 스토리지를 Fallback으로 활용하여 중복 방지
        const guestViewedKey = `guest_viewed_notice_${noticeId}`;
        if (!localStorage.getItem(guestViewedKey)) {
          localStorage.setItem(guestViewedKey, 'true');
          
          const currentNotice = notices.find(n => n.id === noticeId);
          const currentViews = Number(currentNotice?.views || 0);
          
          await supabase
            .from('channel_notices')
            .update({ views: currentViews + 1 })
            .eq('id', noticeId);

          // 로컬 상태 동기화
          setNotices(prevNotices =>
            prevNotices.map(n => n.id === noticeId ? { ...n, views: currentViews + 1 } : n)
          );
        }
      }
    } catch (err) {
      console.error('Error tracking notice views:', err);
    }
  };

  return (
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
            <span className="w-1.5 h-3.5 bg-primary rounded-full inline-block"></span>
            {editingNoticeId !== null ? '공지사항 수정' : '새 공지사항 작성'}
          </h3>
          <input
            type="text"
            placeholder="공지 제목을 입력하세요"
            value={noticeTitle}
            onChange={e => setNoticeTitle(e.target.value)}
            className="w-full mb-4 px-4 py-3 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
          />

          <RichTextEditor
            value={noticeContent}
            onChange={setNoticeContent}
          />

          <div className="flex justify-end gap-2 mt-4">
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

      {isNoticesLoading ? (
        <div className="py-10 text-center text-muted-foreground text-sm font-bold animate-pulse">
          불러오는 중...
        </div>
      ) : selectedNoticeId !== null ? (
        // --- Notice Detail View ---
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
            <div className="border border-border/60 rounded-2xl bg-background shadow-sm min-h-[700px] flex flex-col p-5 md:p-8 animate-in fade-in duration-300 animate-in slide-in-from-bottom-2 duration-300">
              {/* Top Bar with "<" Button */}
              <div className="flex items-center pb-3">
                <button
                  onClick={() => setSelectedNoticeId(null)}
                  className="inline-flex items-center justify-center p-1.5 rounded-lg bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-all hover:scale-105"
                  aria-label="목록으로 가기"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                </button>
              </div>

              {/* Top Divider */}
              <div className="border-b border-border/60 mb-6" />

              {/* Post Content */}
              <div className="flex-1 flex flex-col">
                {/* Title */}
                <h1 className="text-xl md:text-2xl font-bold text-foreground leading-snug tracking-tight mb-4 select-text">
                  {notice.title}
                </h1>

                {/* Author Info Row */}
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

                    {/* Owner Actions */}
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

                {/* Post Body (Rich Text HTML content) */}
                <div className="flex-1 select-text">
                  <div 
                    className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 leading-relaxed break-words ql-editor-display"
                    dangerouslySetInnerHTML={{ __html: notice.content }}
                  />
                </div>
              </div>

              {/* Bottom Back to List button */}
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
        // --- Notice List Table View ---
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-background shadow-sm min-h-[700px] flex flex-col animate-in fade-in duration-300">
          {/* Table Headers (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-border bg-muted/30 text-sm font-extrabold text-muted-foreground select-none">
            <div className="col-span-9">제목</div>
            <div className="col-span-2 text-center">작성일</div>
            <div className="col-span-1 text-center">조회수</div>
          </div>

          {/* Notice List */}
          {pinnedNotices.length === 0 && regularNotices.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-semibold bg-muted/5">
              등록된 공지·안내가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-border/60 flex-1">
              {/* Pinned Notices */}
              {pinnedNotices.map(notice => {
                const views = getNoticeViews(notice.id);
                const dateStr = new Date(notice.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replaceAll(" ", "");

                return (
                  <div key={`pinned-${notice.id}`} className="bg-rose-50/15 dark:bg-rose-950/5">
                    <button
                      onClick={() => handleViewNotice(notice.id)}
                      className="w-full px-4 md:px-6 py-3.5 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-stretch md:items-center hover:bg-muted/15 transition-colors text-left font-bold text-[14px]"
                    >
                      <div className="col-span-9 flex items-center gap-2">
                        <span className="shrink-0 inline-flex items-center justify-center bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-[10px] px-1.5 py-0.5 rounded font-extrabold select-none">
                          📌 공지
                        </span>
                        <span className="text-foreground hover:underline line-clamp-1 flex-1 font-bold text-[14px]">{notice.title}</span>
                      </div>
                      
                      <div className="col-span-2 text-left md:text-center text-sm text-muted-foreground font-semibold flex items-center gap-1.5 md:block">
                        <span className="md:hidden text-muted-foreground font-bold">작성일:</span>{dateStr}
                      </div>

                      <div className="col-span-1 text-left md:text-center text-sm text-muted-foreground font-semibold flex items-center gap-1.5 md:block">
                        <span className="md:hidden font-bold">조회수:</span>{views}
                      </div>
                    </button>
                  </div>
                );
              })}

              {/* Regular Notices */}
              {regularNotices.map(notice => {
                const views = getNoticeViews(notice.id);
                const dateStr = new Date(notice.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replaceAll(" ", "");

                return (
                  <div key={`regular-${notice.id}`} className="bg-background">
                    <button
                      onClick={() => handleViewNotice(notice.id)}
                      className="w-full px-4 md:px-6 py-3.5 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 items-stretch md:items-center hover:bg-muted/30 transition-colors text-left font-medium text-[14px]"
                    >
                      <div className="col-span-9 flex items-center gap-2">
                        <span className="shrink-0 text-muted-foreground/60 select-none text-[10px]">●</span>
                        <span className="text-foreground hover:underline line-clamp-1 flex-1 font-semibold text-[14px]">{notice.title}</span>
                      </div>
                      
                      <div className="col-span-2 text-left md:text-center text-sm text-muted-foreground flex items-center gap-1.5 md:block">
                        <span className="md:hidden font-bold">작성일:</span>{dateStr}
                      </div>

                      <div className="col-span-1 text-left md:text-center text-sm text-muted-foreground flex items-center gap-1.5 md:block">
                        <span className="md:hidden font-bold">조회수:</span>{views}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom CSS overrides for Quill Rich Text and Preview */}
      <style>{`
        .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid var(--border) !important;
          background-color: var(--muted) / 0.1 !important;
          border-top-left-radius: 0.75rem !important;
          border-top-right-radius: 0.75rem !important;
        }
        .ql-container.ql-snow {
          border: none !important;
          min-height: 250px;
          font-size: 14px;
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
