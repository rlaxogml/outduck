"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MapPin, Calendar, Clock, Info, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

type EventDetail = {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  image_url: string | null;
  reservation_type: string | null;
  channels: { id: number; name: string; image_url: string; type: string }[];
  images: { id: number; image_url: string; order: number }[];
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
    const fetchEvent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("offline_events")
        .select(`
          id, title, description, start_date, end_date, start_time, end_time, location, image_url, reservation_type,
          offline_event_channels ( channels ( id, name, type, image_url ) ),
          offline_event_images ( id, image_url, order )
        `)
        .eq("id", eventId)
        .maybeSingle();
        
      if (data) {
        const channels = (data.offline_event_channels || [])
          .map((ec: any) => ec.channels)
          .filter(Boolean);
          
        setEvent({
          id: data.id,
          title: data.title,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date,
          start_time: data.start_time,
          end_time: data.end_time,
          location: data.location,
          image_url: data.image_url,
          reservation_type: data.reservation_type,
          channels,
          images: (data.offline_event_images || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
        });
      }
      setIsLoading(false);
    };
    
    if (eventId) fetchEvent();
  }, [eventId]);

  useEffect(() => {
    const checkBookmark = async () => {
      if (!user || !eventId) return;
      const { data } = await supabase
        .from("event_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("offline_event_id", eventId)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    checkBookmark();
  }, [user, eventId]);

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

    if (isBookmarked) {
      await supabase
        .from("event_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("offline_event_id", eventId);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, offline_event_id: eventId });
      setIsBookmarked(true);
      toast("관심 행사가 저장되었습니다");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-3 relative z-10">
          <Header />
        </div>
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
        <div className="mx-auto max-w-5xl px-4 py-3 relative z-10">
          <Header />
        </div>
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
    if (end) return `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`;
    return start?.replaceAll("-", ".") ?? "상시";
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
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-12">
      <div className="mx-auto max-w-5xl px-4 py-3 relative z-10">
        <Header />
      </div>

      <div className="mx-auto max-w-2xl bg-background min-h-screen border-x border-border/40 shadow-sm md:rounded-t-3xl overflow-hidden mt-2">
        {/* Representative Image */}
        <div className="w-full aspect-[16/9] md:aspect-[21/9] bg-muted relative">
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

        {/* Title and Bookmark */}
        <div className="px-5 pt-0 pb-6">
          {/* Overlapping Channel Images */}
          {event.channels.length > 0 && (
            <div className="relative -mt-10 md:-mt-12 mb-5 z-20 flex items-center -space-x-4 md:-space-x-5">
              {event.channels.map((channel, i) => (
                <div 
                  key={channel.id} 
                  className="transition-transform hover:scale-105 hover:z-30 cursor-pointer relative" 
                  style={{ zIndex: 20 - i }}
                  onClick={() => router.push(`/channels/${channel.id}`)}
                >
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-background shadow-md overflow-hidden bg-muted flex items-center justify-center">
                    {channel.image_url ? (
                      <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">{channel.name.charAt(0)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight break-keep leading-tight text-foreground">
                  {event.title}
                </h1>
                <span className="text-[14px] text-muted-foreground font-medium shrink-0 whitespace-nowrap mt-1">
                  {event.channels.length > 0 ? event.channels[0].name : "오프라인 행사"}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground flex items-center gap-1">
                행사 세부 정보를 확인해보세요
              </p>
            </div>
            
            <button
              onClick={handleBookmark}
              className={`shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-300
                ${isBookmarked ? "border-pink-500 text-pink-500 bg-pink-50/50 dark:bg-pink-950/30" : "border-border text-foreground hover:bg-muted"}
                ${heartAnim ? "scale-105" : "scale-100"}
              `}
            >
              <Heart className={`w-3.5 h-3.5 ${isBookmarked ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`} />
              <span>{isBookmarked ? "관심저장" : "알림받기"}</span>
            </button>
          </div>

          {/* Action Icons Row */}
          <div className="flex justify-around items-center mt-6 pt-5 border-t border-border/40">
            <button onClick={handleBookmark} className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <div className="w-10 h-10 flex items-center justify-center">
                <Heart className={`w-6 h-6 ${isBookmarked ? "fill-pink-500 text-pink-500" : ""}`} />
              </div>
              <span className="text-[12px] font-medium">저장</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-default">
              <div className="w-10 h-10 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-[12px] font-medium">위치보기</span>
            </button>
            <button className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-default">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
              </div>
              <span className="text-[12px] font-medium">공유</span>
            </button>
          </div>
        </div>

        {/* Gray Divider */}
        <div className="w-full h-2 bg-gray-100 dark:bg-white/5" />



        {/* Info List */}
        <div className="px-5">
          <div className="py-4 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[15px] text-foreground font-medium leading-snug">{event.location}</p>
              <p className="text-[13px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">오프라인</span> 
                행사장 위치를 확인해주세요
              </p>
            </div>
          </div>

          <div 
            onClick={() => router.push(`/calendar?event=${event.id}`)}
            className="py-4 flex items-start gap-3 border-t border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[15px] text-foreground leading-snug">
                <span className="font-bold mr-2">행사 기간</span>
                {formatEventDate(event.start_date, event.end_date)}
              </p>
            </div>
          </div>

          {(event.start_time || event.end_time) && (
            <div className="py-4 flex items-start gap-3 border-t border-border/40">
              <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-[15px] text-foreground leading-snug">
                  <span className="font-bold mr-2">이용 시간</span>
                  {event.start_time ? formatTime(event.start_time) : ""}
                  {event.start_time && event.end_time ? " - " : ""}
                  {event.end_time ? formatTime(event.end_time) : ""}
                </p>
              </div>
            </div>
          )}

          {event.reservation_type && (
            <div className="py-4 flex items-start gap-3 border-t border-border/40">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[15px] text-foreground leading-snug pt-0.5">
                <span className="font-bold mr-2">입장 방식</span>
                {event.reservation_type}
              </p>
            </div>
          )}

          {event.channels.length > 0 && (
            <div className="py-4 flex items-start gap-3 border-t border-border/40">
               <UserIcon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
               <div className="flex-1">
                  <p className="text-[15px] text-foreground leading-snug pt-0.5 mb-2">
                    <span className="font-bold mr-2">주최자</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {event.channels.map(channel => (
                      <button 
                        key={channel.id} 
                        onClick={() => router.push(`/channels/${channel.id}`)}
                        className="flex items-center gap-2 bg-secondary/50 rounded-full pr-4 p-1 border border-border/50 hover:bg-secondary transition-colors"
                      >
                        <Avatar className="w-8 h-8 border border-background shadow-sm">
                          <AvatarImage src={channel.image_url || undefined} className="object-cover bg-muted" />
                          <AvatarFallback className="bg-muted text-xs font-bold">{channel.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{channel.name}</span>
                      </button>
                    ))}
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Gray Divider */}
        <div className="w-full h-2 bg-gray-100 dark:bg-white/5" />

        {/* Description Section */}
        {event.description && (
          <div className="px-5 py-6 mb-2">
            <h2 className="text-[17px] font-bold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full inline-block"></span>
              행사 정보
            </h2>
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90">
              {descriptionWithLinks}
            </div>
          </div>
        )}

        {/* Gray Divider */}
        {(event.images && event.images.length > 0) && (
          <div className="w-full h-2 bg-gray-100 dark:bg-white/5" />
        )}

        {/* Additional Images Grid */}
        {event.images && event.images.length > 0 && (
          <div className="py-6 mb-12">
            <h2 className="text-[17px] font-bold mb-4 px-5 text-foreground flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full inline-block"></span>
              행사 사진
            </h2>
            <div className="flex flex-nowrap overflow-x-auto pb-4 snap-x">
              {event.images.map((img, i) => (
                <div 
                  key={img.id} 
                  className={`shrink-0 snap-start ${i === 0 ? 'pl-5' : 'pl-4'} ${i === event.images.length - 1 ? 'pr-5' : ''}`}
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
      </div>

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
