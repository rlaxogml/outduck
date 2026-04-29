"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
}: EventCardProps) {
  const [showChannels, setShowChannels] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  const eventColumn = eventType === "offline" ? "offline_event_id" : "online_event_id";

  // 북마크 여부 확인
  useEffect(() => {
    if (!user) return;
    const checkBookmark = async () => {
      const { data } = await supabase
        .from("event_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq(eventColumn, id)
        .maybeSingle();
      setIsBookmarked(!!data);
    };
    checkBookmark();
  }, [user, id, eventColumn]);

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

    // 애니메이션
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);

    if (isBookmarked) {
      await supabase
        .from("event_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq(eventColumn, id);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, [eventColumn]: id });
      setIsBookmarked(true);
      toast("관심 행사가 저장되었습니다");
    }
  };

  return (
    <Card 
      onClick={() => router.push(eventType === "online" ? `/online-events/${id}` : `/events/${id}`)}
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className={`aspect-[5/3] ${!imageUrl ? imageColor : 'bg-muted'} relative`}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
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
            className={`absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200
              ${isBookmarked
                ? "bg-gradient-to-br from-pink-400 to-rose-500"
                : "bg-background/80 hover:bg-background"
              }
              ${heartAnim ? "scale-125" : "scale-100"}
            `}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${isBookmarked ? "fill-white text-white" : "text-foreground"}`}
            />
          </button>
        )}

        {/* 카테고리 뱃지 */}
        <span className={`absolute top-2 left-2 px-2 py-1 rounded text-sm font-medium
          ${categoryBadgeColors[category] ?? "bg-background/80 text-foreground"}`}>
          {category}
        </span>

        {channels && channels.length > 0 && (
          <div className="absolute -bottom-6 left-8" ref={popupRef}>
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
              className="flex items-center -space-x-9 transition-transform hover:scale-105 active:scale-95"
            >
              {channels.slice(0, 3).map((channel, i) => (
                <Avatar
                  key={i}
                  className="relative w-18 h-18 border-2 border-black/60 bg-muted"
                  style={{ zIndex: 10 - i }}
                >
                  <AvatarImage src={channel.image_url || undefined} alt={channel.name} className="object-cover" />
                  <AvatarFallback className="text-xs font-bold text-muted-foreground bg-muted">
                    {channel.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {channels.length > 3 && (
                <div
                  className="relative w-18 h-18 rounded-full border-2 border-black/60 bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground"
                  style={{ zIndex: 0 }}
                >
                  +{channels.length - 3}
                </div>
              )}
            </button>

            {showChannels && (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-background border border-border rounded-2xl shadow-lg p-3 min-w-[160px]">
                <div className="absolute -bottom-2 left-5 w-4 h-4 bg-background border-r border-b border-border rotate-45" />
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {channels.length === 1 ? "주최자" : "공동 주최자"}
                </p>
                <div className="flex flex-row gap-3">
                  {channels.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => router.push(`/channels/${c.id}`)}>
                      <Avatar className="w-14 h-14 border border-border bg-muted flex-shrink-0">
                        <AvatarImage src={c.image_url || undefined} alt={c.name} className="object-cover" />
                        <AvatarFallback className="text-xs font-bold text-muted-foreground bg-muted">
                          {c.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-center break-keep w-full">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <CardContent className="py-3 px-6">
        <div className="flex justify-between items-start gap-4">
          <h3 className="font-semibold text-xl line-clamp-2 mb-2">{title}</h3>
          {reservationType && (
            <span className={`shrink-0 mt-1 px-4 py-1.5 rounded text-base font-semibold ${reservationBadgeColors[reservationType]}`}>
              {reservationType}
            </span>
          )}
        </div>
        <p className="text-lg text-muted-foreground mb-1">{date}</p>
        <p className="text-lg text-muted-foreground">{location}</p>
      </CardContent>
    </Card>
  );
}