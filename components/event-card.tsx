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
import { cn } from "@/lib/utils";

type ReservationType = "예약 필수" | "예약 우대" | "일부 예약" | "자유 입장" | "티켓팅" | "휴무" | "예약필수" | "예약우대" | "일부예약" | "자유입장";

interface EventCardProps {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType?: string; // Allow any string for safety
  channels?: { id: number; name: string; image_url: string }[];
  user: User | null;
  eventType: "offline" | "online";
  baseEventId?: number;
  bookmarkedIds?: number[];
  isRightCard?: boolean;
  isPriority?: boolean;
  showEventTypeBadge?: boolean;
}

const reservationBadgeColors: Record<string, string> = {
  "예약 필수": "bg-red-500 text-white",
  "예약필수": "bg-red-500 text-white",
  "예약 우대": "bg-orange-500 text-white",
  "예약우대": "bg-orange-500 text-white",
  "일부 예약": "bg-orange-500 text-white",
  "일부예약": "bg-orange-500 text-white",
  "자유 입장": "bg-green-500 text-white",
  "자유입장": "bg-green-500 text-white",
  "티켓팅": "bg-purple-500 text-white",
  "휴무": "bg-slate-500 text-white",
};

const categoryBadgeColors: Record<string, string> = {
  "게임": "bg-blue-500/80 text-white",
  "버튜버": "bg-purple-500/80 text-white",
  "유튜버": "bg-red-500/80 text-white",
  "축제": "bg-amber-500/80 text-white",
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
  bookmarkedIds,
  isRightCard,
  isPriority,
  showEventTypeBadge = false,
}: EventCardProps) {
  const [showChannels, setShowChannels] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  const [resolvedBaseEventId, setResolvedBaseEventId] = useState<number | null>(baseEventId || null);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (baseEventId) {
      setResolvedBaseEventId(baseEventId);
    }
  }, [baseEventId]);

  useEffect(() => {
    if (!user) return;

    // 부모가 북마크한 행사 id 목록을 내려주면, 카드마다 개별 조회하지 않고 그 목록으로 판단한다.
    // (홈처럼 카드가 수십 개일 때 카드당 1건씩 나가던 event_bookmarks 조회를 0건으로)
    if (bookmarkedIds) {
      if (baseEventId != null) setIsBookmarked(bookmarkedIds.includes(baseEventId));
      return;
    }

    // 목록을 못 받은 경우에만 개별 조회로 폴백
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
  }, [user, id, eventType, bookmarkedIds, baseEventId]);

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

  const hostText = channels && channels.length > 0 
    ? (channels.length > 1 ? `${channels[0].name} 외 ${channels.length - 1}` : channels[0].name)
    : "";

  return (
    <Card
      onClick={() => {
        setIsNavigating(true);

        // Log viewed channels locally for recommendation algorithm
        if (channels && channels.length > 0) {
          try {
            const viewedStr = window.localStorage.getItem("outduck-recent-viewed-channels");
            let viewed = viewedStr ? JSON.parse(viewedStr) : [];
            channels.forEach((ch) => {
              const existingIdx = viewed.findIndex((item: any) => item.id === ch.id);
              if (existingIdx > -1) {
                viewed[existingIdx].count += 1;
                viewed[existingIdx].timestamp = Date.now();
              } else {
                viewed.push({ id: ch.id, name: ch.name, count: 1, timestamp: Date.now() });
              }
            });
            viewed.sort((a: any, b: any) => b.timestamp - a.timestamp);
            viewed = viewed.slice(0, 15);
            window.localStorage.setItem("outduck-recent-viewed-channels", JSON.stringify(viewed));
          } catch (e) {
            console.warn("Failed to record recent channel view:", e);
          }
        }

        router.push(eventType === "online" ? `/online-events/${id}` : `/events/${id}`);
      }}
      className="relative overflow-visible hover:shadow-md transition-shadow cursor-pointer pt-0 -mx-4 sm:mx-0 border-x-0 sm:border rounded-none sm:rounded-2xl bg-background shadow-none sm:shadow-sm gap-0 sm:gap-6 pb-3"
    >
      {isNavigating && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200 rounded-none sm:rounded-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-foreground">불러오는 중...</p>
        </div>
      )}
      <div className="relative">
        <div className={`aspect-[16/9] ${!imageUrl ? imageColor : 'bg-muted'} relative overflow-hidden rounded-none sm:rounded-t-2xl`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="object-cover absolute inset-0 w-full h-full"
              loading={isPriority ? "eager" : "lazy"}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2/3 h-1/2 border-2 border-white/30 rounded-lg flex items-end p-3">
                <div className="w-full h-4 bg-white/20 rounded" />
              </div>
            </div>
          )}

          {/* 하트 버튼 - hydration 후 로그인 상태일 때만 표시 */}
          {isClientReady && user && (
            <button
              onClick={handleBookmark}
              className={`absolute top-2 right-2 h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center transition-all duration-200 z-10
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

          {/* 온/오프라인 & 카테고리 뱃지 컨테이너 */}
          <div className="absolute top-2 left-2 flex gap-1.5 z-10">
            {/* 온/오프라인 뱃지 - 주최자 대시보드에서만 선택적으로 노출 */}
            {showEventTypeBadge && (
              <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-bold text-white shadow-sm transition-all
                ${eventType === "online" 
                  ? "bg-emerald-500/90 dark:bg-emerald-600/90" 
                  : "bg-blue-600/90 dark:bg-blue-700/90"}`}>
                {eventType === "online" ? "온라인" : "오프라인"}
              </span>
            )}

            {/* 카테고리 뱃지 */}
            <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-medium shadow-sm
              ${categoryBadgeColors[category] ?? "bg-background/80 text-foreground"}`}>
              {category}
            </span>
          </div>
        </div>

        {channels && channels.length > 0 && (
          <div className="absolute -bottom-6 sm:-bottom-4 md:-bottom-5 left-3 md:left-6" ref={popupRef}>
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
              className="flex items-center -space-x-5 sm:-space-x-3.5 md:-space-x-6 transition-transform hover:scale-105 active:scale-95"
            >
              {channels.slice(0, 3).map((channel, i) => (
                <Avatar
                  key={i}
                  className={`relative w-12 h-12 sm:w-10 sm:h-10 md:w-14 md:h-14 border border-border sm:border-2 sm:border-black/60 bg-muted ${i === 2 ? "hidden md:inline-flex" : ""}`}
                  style={{ zIndex: 10 - i }}
                >
                  <AvatarImage src={channel.image_url || undefined} alt={channel.name} className="object-cover" />
                  <AvatarFallback className="text-xs sm:text-xs font-bold text-muted-foreground bg-muted">
                    {channel.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {channels.length > 2 && (
                <div
                  className="relative w-12 h-12 sm:w-10 sm:h-10 rounded-full border border-border sm:border-2 sm:border-black/60 bg-secondary flex md:hidden items-center justify-center text-xs sm:text-xs font-bold text-secondary-foreground"
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
                    <div key={i} className="flex flex-col items-center gap-0.5 md:gap-1 cursor-pointer" onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/channels/${c.id}`);
                    }}>
                      <Avatar className="w-8 h-8 sm:w-9 sm:h-9 md:w-14 md:h-14 border border-border bg-muted flex-shrink-0">
                        <AvatarImage src={c.image_url || undefined} alt={c.name} className="object-cover" />
                        <AvatarFallback className="text-[9px] sm:text-[10px] md:text-xs font-bold text-muted-foreground bg-muted">
                          {c.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[9px] sm:text-[10px] md:text-xs font-medium text-center break-keep w-full">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CardContent 
        className={cn(
          "flex flex-col justify-center",
          channels && channels.length > 0
            ? "pt-[30px] pb-3 pr-3 pl-3 sm:pt-[clamp(0.35rem,0.9vw,0.6rem)] sm:pb-[clamp(0.2rem,0.6vw,0.4rem)] sm:px-[clamp(0.6rem,1.5vw,1rem)]"
            : "pt-3 pl-3 pb-3 pr-3 sm:pt-[clamp(0.3rem,0.8vw,0.5rem)] sm:pb-[clamp(0.2rem,0.6vw,0.4rem)] sm:px-[clamp(0.6rem,1.5vw,1rem)]"
        )}
      >
        {/* 1. 모바일 전용 뷰 (sm 미만) */}
        <div className="sm:hidden flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-[15px] min-[380px]:text-[16px] leading-[20px] tracking-tight line-clamp-2 text-foreground flex-1 break-keep">
              {title}
            </h3>
            {reservationType && (
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${reservationBadgeColors[reservationType]}`}>
                {reservationType}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 text-[12px] text-muted-foreground/80 dark:text-muted-foreground/60 mt-1 leading-[18px]">
            {location && (
              <span className="truncate w-full block text-foreground/90 dark:text-foreground/80 font-medium">
                장소: {location}
              </span>
            )}
            <div className="flex items-center gap-x-1 whitespace-nowrap overflow-hidden text-ellipsis w-full">
              {hostText && (
                <>
                  <span className="font-semibold text-foreground/85 dark:text-foreground/90 truncate max-w-[100px]">
                    {hostText}
                  </span>
                  <span className="text-muted-foreground/60 select-none">·</span>
                </>
              )}
              <span className="truncate">{date.replace(/\d{4}\./g, "").trim()}</span>
            </div>
          </div>
        </div>

        {/* 2. PC 전용 뷰 (sm 이상) - 최초 순정 코드 100% 완전 복원 */}
        <div className="hidden sm:block w-full">
          <div className="flex justify-between items-start gap-[clamp(0.25rem,1vw,0.75rem)]">
            <h3 className="font-semibold text-[clamp(0.75rem,1.3vw,1rem)] line-clamp-2 mb-0.5 md:mb-1 leading-tight break-keep">{title}</h3>
            {reservationType && (
              <span className={`shrink-0 mt-0.5 px-[clamp(0.3rem,0.8vw,0.6rem)] py-[clamp(0.1rem,0.3vw,0.2rem)] rounded text-[clamp(0.6rem,1vw,0.75rem)] font-semibold ${reservationBadgeColors[reservationType]}`}>
                {reservationType}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 text-[clamp(0.65rem,1.1vw,0.85rem)] text-muted-foreground mt-1 sm:mt-1.5 leading-tight tracking-tight">
            {location && (
              <span className="truncate w-full block text-foreground/90 dark:text-foreground/80 font-medium">
                장소: {location}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full">
              {hostText && (
                <>
                  <span className="font-semibold text-foreground/85 dark:text-foreground/90 truncate max-w-[120px] sm:max-w-[150px]">
                    {hostText}
                  </span>
                  <span className="text-muted-foreground/60 select-none">·</span>
                </>
              )}
              <span className="truncate">{date.replace(/\d{4}\./g, "").trim()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}