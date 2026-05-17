"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Heart, MapPin, Calendar, Clock, Info, User as UserIcon, X, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import ReactDOM from "react-dom";

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
});

type ScheduleItem = {
  id: number;
  day_of_week: string | null;
  date: string | null;
  open_time: string | null;
  close_time: string | null;
  reservation_type: string | null;
};

type EventDetail = {
  id: number;
  event_id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  image_url: string | null;
  reservation_type: string | null;
  channels: { id: number; name: string; image_url: string; type: string; owner_id: string }[];
  images: { id: number; image_url: string; order: number }[];
  schedules: ScheduleItem[];
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = useMemo(() => Number(params.id), [params.id]);
  const router = useRouter();
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [heartAnim, setHeartAnim] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);

  const [activeTab, setActiveTab] = useState<'main' | 'notices'>('main');
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesLoaded, setIsNoticesLoaded] = useState(false);
  const [isNoticesLoading, setIsNoticesLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'latest' | 'views'>('latest');

  const pinnedNotices = useMemo(() => {
    return notices;
  }, [notices]);

  const regularNotices = useMemo(() => {
    return [];
  }, [notices]);

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

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        ['image'],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'header': [1, 2, 3, false] }],
        ['clean']
      ],
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
  }), []);

  const quillFormats = [
    'header', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  const isOwner = useMemo(() => {
    if (!user || !event) return false;
    return event.channels.some(ch => ch.owner_id === user.id);
  }, [user, event]);

  const fetchNotices = async () => {
    if (isNoticesLoaded || !event) return;
    setIsNoticesLoading(true);
    const { data, error } = await supabase
      .from('channel_notices')
      .select('*, channels(name, image_url)')
      .eq('event_id', event.event_id)
      .order('created_at', { ascending: false });
    
    if (data) setNotices(data);
    setIsNoticesLoaded(true);
    setIsNoticesLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'notices') {
      fetchNotices();
    }
  }, [activeTab, event, isNoticesLoaded]);

  const handleSaveNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }
    
    if (editingNoticeId !== null) {
      // --- Update Mode ---
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
        setSelectedNoticeId(data.id); // 수정된 글의 상세 페이지로 복귀
        setEditingNoticeId(null);
        setIsWritingNotice(false);
        setNoticeTitle('');
        setNoticeContent('');
      }
    } else {
      // --- Insert Mode ---
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

  // Sort and process schedules
  const processedSchedules = useMemo(() => {
    if (!event?.schedules || event.schedules.length === 0) return [];
    
    const dayOrder: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const koreanDayNames: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

    // Group: Separate by type (Weekly vs Daily)
    const isWeekly = event.schedules.some(s => s.day_of_week);
    
    if (isWeekly) {
      return [...event.schedules]
        .filter(s => s.day_of_week)
        .sort((a, b) => {
          const orderA = dayOrder[a.day_of_week!.toLowerCase()] ?? 99;
          const orderB = dayOrder[b.day_of_week!.toLowerCase()] ?? 99;
          return orderA - orderB;
        })
        .map(s => {
          const lowerDay = s.day_of_week!.toLowerCase();
          const label = koreanDayNames[lowerDay] || s.day_of_week!;
          
          let timeText = "시간 정보 없음";
          if (s.reservation_type === "휴무") {
            timeText = "휴무";
          } else if (s.open_time && s.close_time) {
            timeText = `${s.open_time.substring(0, 5)} - ${s.close_time.substring(0, 5)}`;
          }

          return {
            id: s.id,
            label,
            timeText,
            reservationType: s.reservation_type || "자유 입장",
            isOff: s.reservation_type === "휴무",
            dayOfWeek: lowerDay
          };
        });
    } else {
      // Daily Schedules (sorted by date ascending)
      return [...event.schedules]
        .filter(s => s.date)
        .sort((a, b) => a.date!.localeCompare(b.date!))
        .map(s => {
          const dateParts = s.date!.split("-");
          const label = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : s.date!;
          
          let timeText = "시간 정보 없음";
          if (s.reservation_type === "휴무") {
            timeText = "휴무";
          } else if (s.open_time && s.close_time) {
            timeText = `${s.open_time.substring(0, 5)} - ${s.close_time.substring(0, 5)}`;
          }

          return {
            id: s.id,
            label,
            timeText,
            reservationType: s.reservation_type || "자유 입장",
            isOff: s.reservation_type === "휴무",
            dayOfWeek: undefined as string | undefined
          };
        });
    }
  }, [event?.schedules]);
  
  useEffect(() => {
    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    syncSession();
  }, []);

  useEffect(() => {
    if (!eventId || isNaN(eventId)) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();

    const fetchEvent = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("offline_events")
          .select(`
            id, event_id, title, description, start_date, end_date, start_time, end_time, image_url, reservation_type,
            events (
              event_channels ( channels ( id, name, type, image_url, owner_id ) ),
              event_images ( id, image_url, order ),
              event_schedules ( id, day_of_week, date, open_time, close_time, reservation_type )
            ),
            offline_event_locations ( location )
          `)
          .eq("id", eventId)
          .abortSignal(abortController.signal)
          .maybeSingle();
          
        if (error) throw error;

        if (data) {
          const eventObj = data.events as any;
          const channels = (eventObj?.event_channels || [])
            .map((ec: any) => ec.channels)
            .filter(Boolean);
            
          setEvent({
            id: data.id,
            event_id: data.event_id,
            title: data.title,
            description: data.description,
            start_date: data.start_date,
            end_date: data.end_date,
            start_time: data.start_time,
            end_time: data.end_time,
            location: data.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
            image_url: data.image_url,
            reservation_type: data.reservation_type,
            channels,
            images: (eventObj?.event_images || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
            schedules: eventObj?.event_schedules || [],
          });
        }
        setIsLoading(false);
      } catch (err: any) {
        if (!err?.message?.includes("AbortError") && err?.name !== "AbortError") {
          console.error("Error fetching event:", err);
          setIsLoading(false);
        }
      }
    };
    
    fetchEvent();

    return () => {
      abortController.abort();
    };
  }, [eventId]);

  useEffect(() => {
    const abortController = new AbortController();

    const checkBookmark = async () => {
      if (!user || !event?.event_id) return;
      try {
        const { data } = await supabase
          .from("event_bookmarks")
          .select("id")
          .eq("user_id", user.id)
          .eq("event_id", event.event_id)
          .abortSignal(abortController.signal)
          .maybeSingle();
        setIsBookmarked(!!data);
      } catch (err: any) {
        if (err?.name !== "AbortError") console.error(err);
      }
    };
    checkBookmark();

    return () => {
      abortController.abort();
    };
  }, [user, event?.event_id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

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
    if (!window.confirm("정말 이 행사를 삭제하시겠습니까? (관련 위치 및 공동 주최 정보도 함께 삭제됩니다)")) return;

    try {
      if (!event?.event_id) throw new Error("이벤트 정보를 찾을 수 없습니다.");

      // 1. Manually delete specific child records satisfying manual referential cleanup
      await supabase.from("offline_event_locations").delete().eq("offline_event_id", eventId);
      await supabase.from("event_channels").delete().eq("event_id", event.event_id);
      await supabase.from("event_links").delete().eq("event_id", event.event_id);
      await supabase.from("event_bookmarks").delete().eq("event_id", event.event_id);
      await supabase.from("event_images").delete().eq("event_id", event.event_id);
      
      // 2. Delete offline specific row
      const { error: delOffErr } = await supabase.from("offline_events").delete().eq("id", eventId);
      if (delOffErr) throw delOffErr;

      // 3. Finally delete underlying universal event record
      const { error: delBaseErr } = await supabase.from("events").delete().eq("id", event.event_id);
      if (delBaseErr) throw delBaseErr;
      
      toast.success("행사가 삭제되었습니다.");
      router.push("/");
    } catch (err: any) {
      console.error(err);
      toast.error("행사 삭제 중 오류가 발생했습니다.");
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p>행사 정보를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-xl font-bold text-foreground">행사를 찾을 수 없습니다.</p>
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground hover:underline">
            이전 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const formatEventDate = (start: string, end: string | null) => {
    const formatSingle = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
      }
      return dateStr.replaceAll("-", "/");
    };

    if (end) return `${formatSingle(start)} - ${formatSingle(end)}`;
    return start ? formatSingle(start) : "상시";
  };
  
  const formatTime = (time: string) => {
    if (!time) return "";
    return time.substring(0, 5); // 14:00:00 -> 14:00
  };

  // Extract URL from description
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const descriptionWithLinks = event.description ? event.description.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">{part}</a>;
    }
    return part;
  }) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-12">
      <Header />

      {/* 1. Hero Section Container */}
      <div className="mx-auto max-w-2xl md:max-w-6xl bg-background border-x border-b border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:rounded-3xl md:border md:border-slate-200/80 overflow-hidden mt-2 md:mt-6 mb-4 md:mb-6">
        {/* Top Section (Responsive Row-Reverse on Desktop) */}
        <div className="flex flex-col md:flex-row-reverse md:gap-8 md:p-8 md:items-center">
          {/* Right (Image) on Desktop, Top on Mobile */}
          <div className="w-full md:w-[55%] shrink-0 relative">
            <div className="w-full aspect-[16/9] bg-muted relative md:rounded-2xl overflow-hidden md:shadow-md">
              {event.image_url ? (
                <img 
                  src={event.image_url} 
                  alt={event.title} 
                  className="w-full h-full object-cover cursor-pointer" 
                  onClick={() => setSelectedImage(event.image_url)}
                />
              ) : (
                 <div className="w-full h-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80" />
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
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight break-keep leading-tight text-foreground">
                    {event.title}
                  </h1>
                  <span className="text-[13px] md:text-base text-muted-foreground font-medium shrink-0 whitespace-nowrap mt-0.5 md:mt-0">
                    {event.channels.length > 0 ? event.channels[0].name : "오프라인 행사"}
                  </span>
                </div>
              </div>
              
              {/* Mobile Bookmark Button */}
              <button
                onClick={handleBookmark}
                className={`shrink-0 md:hidden flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-300
                  ${isBookmarked ? "border-pink-500 text-pink-500 bg-pink-50/50 dark:bg-pink-950/30" : "border-border text-foreground hover:bg-muted"}
                  ${heartAnim ? "scale-105" : "scale-100"}
                `}
              >
                <Heart className={`w-3.5 h-3.5 ${isBookmarked ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`} />
                <span>{isBookmarked ? "관심저장" : "알림받기"}</span>
              </button>
            </div>

            {/* Owner Action Row */}
            {isOwner && (
              <div className="flex gap-2 mt-4 md:mt-6">
                <button 
                  onClick={() => router.push(`/events/${event.id}/edit`)}
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

            {/* Action Buttons Row (Save, Location, Share) */}
            <div className="flex justify-around md:justify-start md:gap-3 items-center mt-6 md:mt-8 pt-5 md:pt-0 border-t md:border-t-0 border-border/40">
              <button 
                onClick={handleBookmark} 
                className={cn(
                  "flex flex-col items-center gap-2 transition-colors w-full",
                  "md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:text-sm md:font-semibold md:shadow-sm",
                  isBookmarked 
                    ? "text-pink-500 md:bg-pink-500 md:text-white md:border-pink-500 md:hover:bg-pink-600" 
                    : "text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] md:bg-background md:text-[#3a5378] dark:md:text-[#a0b8d6] md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10"
                )}
              >
                <div className="w-10 h-10 md:w-5 md:h-5 flex items-center justify-center">
                  <Heart className={cn("w-6 h-6 md:w-4 md:h-4", isBookmarked ? "fill-pink-500 md:fill-white" : "")} />
                </div>
                <span className="text-[12px] md:text-sm font-medium md:font-semibold">{isBookmarked ? "관심저장" : "저장"}</span>
              </button>

              <button 
                onClick={() => router.push(`/map?eventId=${event.id}`)}
                className="flex flex-col items-center gap-2 text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] transition-colors w-full md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:bg-background md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10 md:text-[#3a5378] dark:md:text-[#a0b8d6] md:text-sm md:font-semibold shadow-sm"
              >
                <div className="w-10 h-10 md:w-5 md:h-5 flex items-center justify-center">
                  <MapPin className="w-6 h-6 md:w-4 md:h-4" />
                </div>
                <span className="text-[12px] md:text-sm font-medium md:font-semibold">위치보기</span>
              </button>

              <button className="flex flex-col items-center gap-2 text-[#6a83a8] hover:text-[#3a5378] dark:text-[#8ba3c7] dark:hover:text-[#a0b8d6] transition-colors cursor-default w-full md:flex-row md:justify-center md:gap-2 md:px-4 md:py-3 md:rounded-xl md:border md:border-[#4f6b94]/30 dark:md:border-[#627fa6]/30 md:bg-background md:hover:bg-[#4f6b94]/10 dark:md:hover:bg-[#627fa6]/10 md:text-[#3a5378] dark:md:text-[#a0b8d6] md:text-sm md:font-semibold shadow-sm">
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

      {/* 2. Main Content & Tabs Container */}
      <div className="mx-4 md:mx-auto max-w-2xl md:max-w-6xl bg-background rounded-3xl border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden">
        
        {/* Tabs Header */}
        <div className="flex items-center border-b border-border/60 bg-background">
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
              {/* Info Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-10">
                {/* Row 1: Location (Always Full Width) */}
                <div 
                  onClick={() => router.push(`/map?eventId=${event.id}`)}
                  className="flex items-center gap-3 bg-background hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border border-slate-300/80 dark:border-slate-700/80 border-l-[5px] border-l-[#4f6b94] dark:border-l-[#627fa6] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group sm:col-span-2"
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f6b94]/15 dark:bg-[#627fa6]/20 flex items-center justify-center shrink-0 group-hover:bg-[#4f6b94]/25 transition-colors">
                    <MapPin className="w-4 h-4 text-[#3a5378] dark:text-[#a0b8d6]" />
                  </div>
                  <div>
                    <p className="text-xs md:text-[13px] text-muted-foreground font-bold mb-0.5">장소</p>
                    <p className="text-[15px] md:text-base text-foreground font-bold leading-snug">{event.location}</p>
                  </div>
                </div>

                {/* Row 2 Left: Date */}
                <div 
                  onClick={() => router.push(`/calendar?event=${event.id}`)}
                  className={cn(
                    "flex items-center gap-3 bg-background hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border border-slate-300/80 dark:border-slate-700/80 border-l-[5px] border-l-[#4f6b94] dark:border-l-[#627fa6] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group",
                    (!event.start_time && !event.end_time) ? "sm:col-span-2" : "sm:col-span-1"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-[#4f6b94]/15 dark:bg-[#627fa6]/20 flex items-center justify-center shrink-0 group-hover:bg-[#4f6b94]/25 transition-colors">
                    <Calendar className="w-4 h-4 text-[#3a5378] dark:text-[#a0b8d6]" />
                  </div>
                  <div>
                    <p className="text-xs md:text-[13px] text-muted-foreground font-bold mb-0.5">행사 기간</p>
                    <p className="text-[15px] md:text-base text-foreground font-bold leading-snug">
                      {formatEventDate(event.start_date, event.end_date)}
                    </p>
                  </div>
                </div>

                {/* Row 2 Right: Time */}
                {(event.start_time || event.end_time || processedSchedules.length > 0) && (
                  <div 
                    onClick={() => {
                      if (processedSchedules.length > 0) setIsScheduleExpanded(!isScheduleExpanded);
                    }}
                    className={cn(
                      "flex items-start gap-3 bg-background border border-slate-300/80 dark:border-slate-700/80 border-l-[5px] border-l-[#4f6b94] dark:border-l-[#627fa6] rounded-2xl p-4 shadow-sm transition-all duration-200 select-none sm:col-span-1",
                      processedSchedules.length > 0 ? "cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/10" : ""
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#4f6b94]/15 dark:bg-[#627fa6]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-[#3a5378] dark:text-[#a0b8d6]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5 gap-2">
                        <p className="text-xs md:text-[13px] text-muted-foreground font-bold">이용 시간</p>
                        {processedSchedules.length > 0 && (
                          <ChevronDown className={cn("w-4 h-4 text-[#4f6b94] transition-transform duration-300 shrink-0", isScheduleExpanded ? "rotate-180" : "")} />
                        )}
                      </div>
                      
                      {!isScheduleExpanded || processedSchedules.length === 0 ? (
                        <p className="text-[15px] md:text-base text-foreground font-bold leading-snug">
                          {event.start_time ? formatTime(event.start_time) : ""}
                          {event.start_time && event.end_time ? " - " : ""}
                          {event.end_time ? formatTime(event.end_time) : ""}
                          {!event.start_time && !event.end_time && processedSchedules.length > 0 ? "상세 일정 확인" : ""}
                        </p>
                      ) : (
                        <div className="mt-2.5 space-y-2 animate-in slide-in-from-top-1 duration-200">
                          {processedSchedules.map((s, idx) => {
                            const dayOrder: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
                            const nextItem = processedSchedules[idx + 1];
                            let hasGap = false;
                            
                            if (s.dayOfWeek && nextItem && nextItem.dayOfWeek) {
                              const currIdx = dayOrder[s.dayOfWeek];
                              const nextIdx = dayOrder[nextItem.dayOfWeek];
                              if (typeof currIdx === "number" && typeof nextIdx === "number") {
                                hasGap = (nextIdx - currIdx > 1);
                              }
                            }

                            return (
                              <Fragment key={s.id}>
                                <div className="flex items-center gap-3 text-sm text-foreground/90">
                                  <span className="font-bold text-foreground/70 select-none w-4">{s.label}</span>
                                  <span className={cn(
                                    "font-bold tracking-tight",
                                    s.isOff ? "text-red-500 font-black" : "text-foreground"
                                  )}>
                                    {s.timeText}
                                  </span>
                                  {s.reservationType !== "자유 입장" && !s.isOff && (
                                    <span className="text-[10.5px] font-bold text-muted-foreground select-none tracking-tight opacity-80">
                                      ({s.reservationType})
                                    </span>
                                  )}
                                </div>
                                
                                {hasGap && (
                                  <div className="py-2 flex items-center text-[#4f6b94]/40 max-w-[140px] select-none animate-in fade-in duration-300">
                                    <svg className="w-full h-[5px]" viewBox="0 0 120 5" preserveAspectRatio="none">
                                      <path 
                                        d="M 0 2.5 C 5 5, 5 0, 10 2.5 C 15 5, 15 0, 20 2.5 C 25 5, 25 0, 30 2.5 C 35 5, 35 0, 40 2.5 C 45 5, 45 0, 50 2.5 C 55 5, 55 0, 60 2.5 C 65 5, 65 0, 70 2.5 C 75 5, 75 0, 80 2.5 C 85 5, 85 0, 90 2.5 C 95 5, 95 0, 100 2.5 C 105 5, 105 0, 110 2.5 C 115 5, 115 0, 120 2.5" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="1.5" 
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3 Left: Organizer */}
                {event.channels.length > 0 && (
                  <div className={cn(
                    "flex items-center gap-3 bg-background border border-slate-300/80 dark:border-slate-700/80 border-l-[5px] border-l-[#4f6b94] dark:border-l-[#627fa6] rounded-2xl p-4 shadow-sm",
                    (!event.reservation_type) ? "sm:col-span-2" : "sm:col-span-1"
                  )}>
                    <div className="w-10 h-10 rounded-full bg-[#4f6b94]/15 dark:bg-[#627fa6]/20 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-[#3a5378] dark:text-[#a0b8d6]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs md:text-[13px] text-muted-foreground font-bold mb-0.5">주최자</p>
                      <div className="flex flex-wrap gap-2">
                        {event.channels.map(channel => (
                          <button 
                            key={channel.id} 
                            onClick={() => router.push(`/channels/${channel.id}`)}
                            className="flex items-center gap-1.5 bg-background/90 hover:bg-background rounded-full pr-3 p-1 border border-border/50 shadow-sm transition-all hover:scale-[1.02]"
                          >
                            <Avatar className="w-6 h-6 border border-background shadow-sm">
                              <AvatarImage src={channel.image_url || undefined} className="object-cover bg-muted" />
                              <AvatarFallback className="bg-muted text-[10px] font-bold">{channel.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[13px] font-bold text-foreground pr-0.5">{channel.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 3 Right: Reservation Type Card */}
                {event.reservation_type && (
                  <div className={cn(
                    "flex items-center gap-3 bg-background border border-slate-300/80 dark:border-slate-700/80 border-l-[5px] border-l-[#4f6b94] dark:border-l-[#627fa6] rounded-2xl p-4 shadow-sm",
                    (event.channels.length === 0) ? "sm:col-span-2" : "sm:col-span-1"
                  )}>
                    <div className="w-10 h-10 rounded-full bg-[#4f6b94]/15 dark:bg-[#627fa6]/20 flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 text-[#3a5378] dark:text-[#a0b8d6]" />
                    </div>
                    <div>
                      <p className="text-xs md:text-[13px] text-muted-foreground font-bold mb-0.5">입장 방식</p>
                      <p className="text-[15px] md:text-base text-foreground font-bold leading-snug">{event.reservation_type}</p>
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
                  
                  {/* React Quill Editor Container */}
                  <div className="mb-4 bg-background border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 text-foreground">
                    <ReactQuill
                      theme="snow"
                      value={noticeContent}
                      onChange={setNoticeContent}
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="공지 내용을 작성해보세요. 이미지 업로드 및 하이퍼링크가 지원됩니다."
                      className="min-h-[250px]"
                    />
                  </div>

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

              {isNoticesLoading ? (
                <div className="py-10 text-center text-muted-foreground text-sm font-bold animate-pulse">
                  불러오는 중...
                </div>
              ) : selectedNoticeId !== null ? (
                // --- Notice Detail View (Image 2 style) ---
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
                    <div className="border border-border/60 rounded-2xl bg-background shadow-sm min-h-[700px] flex flex-col p-5 md:p-8 animate-in fade-in duration-300">
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
                // --- Notice List Table View (Naver Lounge style) ---
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
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium">
            {descriptionWithLinks}
          </div>
        </div>
      )}

      {/* 4. Additional Images Card */}
      {activeTab === 'main' && event.images && event.images.length > 0 && (
        <div className="mx-4 md:mx-auto max-w-2xl md:max-w-6xl bg-background rounded-3xl py-8 border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-12 overflow-hidden animate-in fade-in duration-300">
          <h2 className="text-[17px] md:text-xl font-bold mb-6 px-5 md:px-10 text-foreground flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full inline-block"></span>
            행사 사진
          </h2>
          <div className="flex flex-nowrap overflow-x-auto pb-4 snap-x">
            {event.images.map((img, i) => (
              <div 
                key={img.id} 
                className={`shrink-0 snap-start ${i === 0 ? 'pl-5 md:pl-10' : 'pl-4'} ${i === event.images.length - 1 ? 'pr-5 md:pr-10' : ''}`}
              >
                <div className="w-56 md:w-72 aspect-square bg-muted rounded-2xl overflow-hidden shadow-sm border border-border/40">
                  <img 
                    src={img.image_url} 
                    alt="행사 이미지" 
                    className="w-full h-full object-cover transition-transform hover:scale-105 cursor-pointer" 
                    onClick={() => setSelectedImage(img.image_url)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={selectedImage} 
              alt="확대 이미지" 
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
