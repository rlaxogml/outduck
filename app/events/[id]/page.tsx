"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MapPin, Calendar, Clock, Info } from "lucide-react";
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
        .from("offline_events")
        .select(`
          id, title, description, start_date, end_date, start_time, end_time, location, image_url, reservation_type,
          offline_event_channels ( channels ( id, name, type, image_url ) )
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
             <div className="w-full h-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80" />
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
            <p className="text-sm font-semibold text-muted-foreground mb-3">주최자</p>
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
              <p className="text-xs text-muted-foreground font-medium mb-1">날짜</p>
              <p className="font-semibold text-[15px]">{formatEventDate(event.start_date, event.end_date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition-shadow hover:shadow-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">장소</p>
              <p className="font-semibold text-[15px]">{event.location}</p>
            </div>
          </div>

          {(event.start_time || event.end_time) && (
            <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">시간</p>
                <p className="font-semibold text-[15px]">
                  {event.start_time ? formatTime(event.start_time) : ""}
                  {event.start_time && event.end_time ? " - " : ""}
                  {event.end_time ? formatTime(event.end_time) : ""}
                </p>
              </div>
            </div>
          )}

          {event.reservation_type && (
            <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition-shadow hover:shadow-md">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">입장 방식</p>
                <p className="font-semibold text-[15px]">{event.reservation_type}</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-sm mb-12 relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0" />
            
            <h2 className="text-xl font-bold mb-5 relative z-10">행사 소개</h2>
            <div className="relative z-10 prose prose-base md:prose-lg dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground font-medium">
              {descriptionWithLinks}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
