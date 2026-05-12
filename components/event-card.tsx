"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type ReservationType = "예약필수" | "예약우대" | "자유입장" | "티켓팅";

interface EventCardProps {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType?: ReservationType;
  channels?: { id: number; name: string; image_url: string }[];
  user: User | null;
  eventType: "offline" | "online";
  baseEventId?: number;
  isRightCard?: boolean;
  isPriority?: boolean;
}

const reservationBadgeColors: Record<ReservationType, string> = {
  "예약필수": "bg-red-500 text-white",
  "예약우대": "bg-orange-500 text-white",
  "자유입장": "bg-green-500 text-white",
  "티켓팅": "bg-purple-500 text-white",
};

const categoryBadgeColors: Record<string, string> = {
  "게임": "bg-blue-500/80 text-white",
  "버튜버": "bg-purple-500/80 text-white",
  "유튜버": "bg-red-500/80 text-white",
};

export function EventCard({
  id,
  title,
  date,
  location,
  category,
  imageColor,
  imageUrl,
  reservationType,
  channels,
  user,
  eventType,
  baseEventId,
  isRightCard,
  isPriority,
}: EventCardProps) {
  const [showChannels, setShowChannels] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  const [resolvedBaseEventId, setResolvedBaseEventId] = useState<number | null>(baseEventId || null);

  useEffect(() => {
    if (baseEventId) {
      setResolvedBaseEventId(baseEventId);
    }
  }, [baseEventId]);

  useEffect(() => {
    if (!user) return;
    const loadAndCheckBookmark = async () => {
      let curBaseId = resolvedBaseEventId;
      if (!curBaseId) {
        const tableName = eventType === "offline" ? "offline_events" : "online_events";
        const { data } = await supabase
          .from(tableName)
          .select("event_id")
          .eq("id", id)
          .maybeSingle();
        if (data?.event_id) {
          curBaseId = data.event_id;
          setResolvedBaseEventId(curBaseId);
        }
      }
      if (!curBaseId) return;

      const { data } = await supabase
        .from("event_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", curBaseId)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    loadAndCheckBookmark();
  }, [user, id, eventType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowChannels(false);
      }
    };
    if (showChannels) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showChannels]);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);

    let curBaseId = resolvedBaseEventId;
    if (!curBaseId) {
      const tableName = eventType === "offline" ? "offline_events" : "online_events";
      const { data } = await supabase
        .from(tableName)
        .select("event_id")
        .eq("id", id)
        .maybeSingle();
      if (data?.event_id) {
        curBaseId = data.event_id;
        setResolvedBaseEventId(curBaseId);
      }
    }
    if (!curBaseId) {
      toast.error("행사 정보를 찾을 수 없습니다.");
      return;
    }

    if (isBookmarked) {
      await supabase
        .from("event_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", curBaseId);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, event_id: curBaseId });
      setIsBookmarked(true);
      toast("관심 행사가 저장되었습니다");
    }
  };

  return (
    <Card
      onClick={() => {
        setIsNavigating(true);
        router.push(eventType === "online" ? `/online-events/${id}` : `/events/${id}`);
      }}
      className="relative overflow-visible hover:shadow-md transition-shadow cursor-pointer pt-0"
    >
      {isNavigating && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200 rounded-xl">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-foreground">불러오는 중...</p>
        </div>
      )}
      <div className="relative">
        <div className={`aspect-[16/9] ${!imageUrl ? imageColor : 'bg-muted'} relative overflow-hidden rounded-t-xl`}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              priority={isPriority}
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2/3 h-1/2 border-2 border-white/30 rounded-lg flex items-end p-3">
                <div className="w-full h-4 bg-white/20 rounded" />
              </div>
            </div>
          )}

          {/* 하트 버튼 - 로그인한 경우만 표시 */}
          {user && (
            <button
              onClick={handleBookmark}
              className={`absolute top-2 right-2 h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center transition-all duration-200
                ${isBookmarked
                  ? "bg-gradient-to-br from-pink-400 to-rose-500"
                  : "bg-background/80 hover:bg-background"
                }
                ${heartAnim ? "scale-125" : "scale-100"}
              `}
            >
              <Heart
                className={`h-3.5 w-3.5 md:h-4 md:w-4 transition-colors ${isBookmarked ? "fill-white text-white" : "text-foreground"}`}
              />
            </button>
          )}

          {/* 카테고리 뱃지 */}
          <span className={`absolute top-2 left-2 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-medium
            ${categoryBadgeColors[category] ?? "bg-background/80 text-foreground"}`}>
            {category}
          </span>
        </div>

        {channels && channels.length > 0 && (
          <div className="absolute -bottom-4 md:-bottom-5 left-3 md:left-6" ref={popupRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (channels.length === 1) {
                  router.push(`/channels/${channels[0].id}`);
                } else {
                  setShowChannels(!showChannels);
                }
              }}
              className="flex items-center -space-x-4 md:-space-x-6 transition-transform hover:scale-105 active:scale-95"
            >
              {channels.slice(0, 3).map((channel, i) => (
                <Avatar
                  key={i}
                  className={`relative w-10 h-10 md:w-14 md:h-14 border-2 border-black/60 bg-muted ${i === 2 ? "hidden md:inline-flex" : ""}`}
                  style={{ zIndex: 10 - i }}
                >
                  <AvatarImage src={channel.image_url || undefined} alt={channel.name} className="object-cover" />
                  <AvatarFallback className="text-xs font-bold text-muted-foreground bg-muted">
                    {channel.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {channels.length > 2 && (
                <div
                  className="relative w-10 h-10 rounded-full border-2 border-black/60 bg-secondary flex md:hidden items-center justify-center text-xs font-bold text-secondary-foreground"
                  style={{ zIndex: 0 }}
                >
                  +{channels.length - 2}
                </div>
              )}
              {channels.length > 3 && (
                <div
                  className="relative w-14 h-14 rounded-full border-2 border-black/60 bg-secondary hidden md:flex items-center justify-center text-xs font-bold text-secondary-foreground"
                  style={{ zIndex: 0 }}
                >
                  +{channels.length - 3}
                </div>
              )}
            </button>

            {showChannels && (
              <div className={`absolute bottom-full mb-2 z-50 bg-background border border-border rounded-xl md:rounded-2xl shadow-lg p-2 md:p-3 min-w-[140px] md:min-w-[160px] ${isRightCard ? "right-0 md:left-1/2 md:-translate-x-1/2 md:right-auto" : "left-0 md:left-1/2 md:-translate-x-1/2"}`}>
                <div className={`absolute -bottom-2 w-4 h-4 bg-background border-r border-b border-border rotate-45 ${isRightCard ? "right-14 md:left-1/2 md:-translate-x-1/2" : "left-6 md:left-1/2 md:-translate-x-1/2"}`} />
                <p className="text-[10px] md:text-xs font-semibold text-muted-foreground mb-1.5 md:mb-2">
                  {channels.length === 1 ? "주최자" : "공동 주최자"}
                </p>
                <div className="flex flex-row gap-1.5 md:gap-3">
                  {channels.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 md:gap-1 cursor-pointer" onClick={() => router.push(`/channels/${c.id}`)}>
                      <Avatar className="w-9 h-9 md:w-14 md:h-14 border border-border bg-muted flex-shrink-0">
                        <AvatarImage src={c.image_url || undefined} alt={c.name} className="object-cover" />
                        <AvatarFallback className="text-[10px] md:text-xs font-bold text-muted-foreground bg-muted">
                          {c.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[9px] md:text-xs font-medium text-center break-keep w-full">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <CardContent className="pt-[clamp(0.3rem,0.8vw,0.5rem)] pb-[clamp(0.2rem,0.6vw,0.4rem)] px-[clamp(0.6rem,1.5vw,1rem)] flex flex-col justify-center">
        <div className="flex justify-between items-start gap-[clamp(0.25rem,1vw,0.75rem)]">
          <h3 className="font-semibold text-[clamp(0.75rem,1.3vw,1rem)] line-clamp-2 mb-0.5 md:mb-1 leading-tight">{title}</h3>
          {reservationType && (
            <span className={`shrink-0 mt-0.5 px-[clamp(0.3rem,0.8vw,0.6rem)] py-[clamp(0.1rem,0.3vw,0.2rem)] rounded text-[clamp(0.6rem,1vw,0.75rem)] font-semibold ${reservationBadgeColors[reservationType]}`}>
              {reservationType}
            </span>
          )}
        </div>
        <p className="text-[clamp(0.65rem,1.1vw,0.85rem)] text-muted-foreground mt-0.5">{date}</p>
        <p className="text-[clamp(0.65rem,1.1vw,0.85rem)] text-muted-foreground truncate leading-tight">{location}</p>
      </CardContent>
    </Card>
  );
}