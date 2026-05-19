"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Heart, Calendar, Link as LinkIcon, ShoppingBag, ChevronLeft, ExternalLink, Link2, Info, User as UserIcon } from "lucide-react";
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

type OnlineEventDetail = {
  id: number;
  event_id: number;
  title: string;
  description: string;
  start_at: string | null;
  end_at: string | null;
  image_url: string | null;
  links: { link_name: string; link_url: string }[] | null;
  channels: { id: number; name: string; image_url: string; type: string; owner_id: string }[];
};

export default function OnlineEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = useMemo(() => Number(params.id), [params.id]);
  const router = useRouter();
  
  const [event, setEvent] = useState<OnlineEventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [heartAnim, setHeartAnim] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'main' | 'notices'>('main');
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesLoaded, setIsNoticesLoaded] = useState(false);
  const [isNoticesLoading, setIsNoticesLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState<number | null>(null);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'latest' | 'views'>('latest');

  const [isWritingNotice, setIsWritingNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  const isOwner = useMemo(() => {
    if (!user || !event) return false;
    return event.channels.some(ch => ch.owner_id === user.id);
  }, [user, event]);

  const pinnedNotices = useMemo(() => {
    return notices;
  }, [notices]);

  const regularNotices = useMemo<any[]>(() => {
    return [];
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
      container: [
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
                toast.error('이미지 업로드에 실패했습니다.');
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

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    syncSession();
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("online_events")
        .select(`
          id, event_id, title, description, start_at, end_at, image_url, links,
          events (
            event_channels ( channels ( id, name, type, image_url, owner_id ) )
          )
        `)
        .eq("id", eventId)
        .maybeSingle();
        
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
          start_at: data.start_at,
          end_at: data.end_at,
          image_url: data.image_url,
          links: data.links as any,
          channels,
        });
      }
      setIsLoading(false);
    };
    
    if (eventId) fetchEvent();
  }, [eventId]);

  useEffect(() => {
    const checkBookmark = async () => {
      if (!user || !event?.event_id) return;
      const { data } = await supabase
        .from("event_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", event.event_id)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    checkBookmark();
  }, [user, event?.event_id]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32 text-muted-foreground">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p>온라인 행사 정보를 불러오는 중...</p>
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

  const primaryChannel = event.channels[0];
  
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
      toast.success("행사 링크가 복사되었습니다!");
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
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight break-keep leading-tight text-foreground animate-in fade-in duration-300">
                      {event.title}
                    </h1>
                    <span className="text-[13px] md:text-base text-muted-foreground font-medium shrink-0 whitespace-nowrap mt-0.5 md:mt-0">
                      {event.channels.length > 0 ? event.channels[0].name : "온라인 행사"}
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

                {/* 3. 관련 링크 (Explicitly from event.links) */}
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
                    <div className="border border-border/60 rounded-2xl bg-background shadow-sm min-h-[500px] flex flex-col p-5 md:p-8 animate-in fade-in duration-300">
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
                <div className="border border-border/60 rounded-2xl overflow-hidden bg-background shadow-sm min-h-[500px] flex flex-col animate-in fade-in duration-300">
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-border bg-muted/30 text-sm font-extrabold text-muted-foreground select-none">
                    <div className="col-span-9">제목</div>
                    <div className="col-span-2 text-center">작성일</div>
                    <div className="col-span-1 text-center">조회수</div>
                  </div>

                  {pinnedNotices.length === 0 && regularNotices.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-semibold bg-muted/5">
                      등록된 공지·안내가 없습니다.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60 flex-1">
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
                    </div>
                  )}
                </div>
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
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 font-medium select-text">
            {descriptionWithLinks}
          </div>
        </div>
      )}

      {/* React Quill Styling overrides */}
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
