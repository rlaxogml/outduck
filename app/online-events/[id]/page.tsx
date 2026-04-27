"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Calendar, Link as LinkIcon, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

type OnlineEventDetail = {
  id: number;
  title: string;
  description: string;
  start_at: string | null;
  end_at: string | null;
  image_url: string | null;
  channels: { id: number; name: string; image_url: string; type: string }[];
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
          id, title, description, start_at, end_at, image_url,
          online_event_channels ( channels ( id, name, type, image_url ) )
        `)
        .eq("id", eventId)
        .maybeSingle();
        
      if (data) {
        const channels = (data.online_event_channels || [])
          .map((ec: any) => ec.channels)
          .filter(Boolean);
          
        setEvent({
          id: data.id,
          title: data.title,
          description: data.description,
          start_at: data.start_at,
          end_at: data.end_at,
          image_url: data.image_url,
          channels,
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
        .eq("online_event_id", eventId)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    checkBookmark();
  }, [user, eventId]);

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
        .eq("online_event_id", eventId);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, online_event_id: eventId });
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
            <p>온라인 행사 정보를 불러오는 중...</p>
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
  
  // Extract URL from description
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const descriptionWithLinks = event.description ? event.description.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>;
    }
    return part;
  }) : "소개가 없습니다.";
  
  const hasExtractedLinks = event.description?.match(urlRegex);

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-5xl px-4 py-3 relative z-10">
        <Header />
      </div>
      
      {/* Representative Image (Width max-w-4xl) */}
      <div className="mx-auto max-w-4xl relative">
        <div className="w-full aspect-[4/3] md:aspect-[21/9] bg-muted relative md:rounded-b-3xl overflow-hidden shadow-lg border-b md:border border-border/50">
          {event.image_url ? (
            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
             <div className="w-full h-full bg-gradient-to-br from-blue-500/80 to-cyan-600/80 flex items-center justify-center">
                <ShoppingBag className="w-24 h-24 text-white/30" />
             </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 md:px-8 border-x border-b border-border/60 pb-12 rounded-b-2xl md:rounded-b-3xl mb-12 shadow-sm bg-background">
        {/* Channel Profile Images overlapping */}
        {event.channels.length > 0 && (
          <div className="relative -mt-10 md:-mt-12 mb-4 z-20 flex items-center -space-x-4 md:-space-x-6">
            {event.channels.map((channel, i) => (
              <div 
                key={channel.id} 
                className="transition-transform hover:scale-105 hover:z-30 cursor-pointer relative" 
                style={{ zIndex: 20 - i }}
                onClick={() => router.push(`/channels/${channel.id}`)}
              >
                <Avatar className="w-20 h-20 md:w-24 md:h-24 border-4 border-background shadow-md">
                  <AvatarImage src={channel.image_url || undefined} className="object-cover bg-muted" />
                  <AvatarFallback className="bg-muted text-xl font-bold">{channel.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>
        )}

        {/* Title and Bookmark */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight break-keep leading-tight">
            {event.title}
          </h1>
          
          <button
            onClick={handleBookmark}
            className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full border shadow-sm transition-all duration-300
              ${isBookmarked ? "bg-gradient-to-br from-pink-400 to-rose-500 border-transparent shadow-pink-500/30" : "bg-card border-border hover:bg-muted"}
              ${heartAnim ? "scale-110" : "scale-100"}
            `}
          >
            <Heart className={`w-5 h-5 transition-colors ${isBookmarked ? "fill-white text-white" : "text-muted-foreground"}`} />
          </button>
        </div>
        
        {/* Organizer Info */}
        {event.channels.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-semibold text-muted-foreground mb-3">관련 채널</p>
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
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition-shadow hover:shadow-md">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">진행 기간</p>
              {formatOnlineEventDateFull(event.start_at, event.end_at)}
            </div>
          </div>

          {hasExtractedLinks && (
            <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <LinkIcon className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="overflow-hidden w-full">
                <p className="text-xs text-muted-foreground font-medium mb-1">관련 링크</p>
                <a href={hasExtractedLinks[0]} target="_blank" rel="noopener noreferrer" className="font-semibold text-[15px] text-blue-500 hover:underline truncate block w-full">
                  {hasExtractedLinks[0]}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-sm mb-12 relative overflow-hidden">
          {/* Decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-0" />
          
          <h2 className="text-xl font-bold mb-5 relative z-10">상세 정보</h2>
          <div className="relative z-10 prose prose-base md:prose-lg dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground font-medium">
            {descriptionWithLinks}
          </div>
        </div>
        
      </div>
    </div>
  );
}
