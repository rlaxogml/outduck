"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

type Channel = {
  id: number;
  name: string;
  type: string | null;
  image_url: string | null;
  activeEventCount?: number;
  hasBookmarkedEvent?: boolean;
  latestEventCreatedAt?: string;
  favoriteCreatedAt?: string;
};

const channelTypeLabel: Record<string, string> = {
  game: "게임",
  youtuber: "유튜버",
  festival: "축제",
};

function getChannelTypeText(type: string | null) {
  if (!type) return "기타";
  const normalized = type.trim().toLowerCase();
  return channelTypeLabel[normalized] || "기타";
}

let cachedChannels: Channel[] | null = null;

export function FavoriteChannels({ user }: { user: any }) {
  const [channels, setChannels] = useState<Channel[]>(cachedChannels || []);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(cachedChannels === null);
  const [mounted, setMounted] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    console.log("FavoriteChannels: Component mounted.");
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log("FavoriteChannels: Auth changed or mounted.", { hasUser: !!user, mounted });
    if (!mounted) return;

    let isMounted = true;
    setHasTimedOut(false);

    let safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("FavoriteChannels: Loading safety timeout reached (15s). Forcing isLoading to false.");
        setHasTimedOut(true);
        setIsLoading(false);
      }
    }, 15000);

    const checkAuthAndProgressiveFetch = async () => {
      try {
        // 부모 컴포넌트에서 user={user}로 내려오므로 세션 확인 단계를 과감히 삭제하여 Waterfall 방지
        const currentUser = user;
        if (!currentUser) return;

        if (isMounted && cachedChannels) {
          setChannels(cachedChannels);
          setIsLoading(false);
        } else if (isMounted) {
          setIsLoading(true);
        }

        console.log("FavoriteChannels: Fetching initial channel metadata for user:", currentUser.id);
        
        // 1단계: 초고속 단일 조회 (소속 관계 매핑을 위해 team_id, is_team 추가 조회)
        const { data: favoritesData, error: favError } = await supabase
          .from("favorites")
          .select("channel_id, created_at, channels(id, name, type, image_url, team_id, is_team)")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (favError) {
          console.error("FavoriteChannels: Error fetching favorites:", favError);
          throw favError;
        }

        if (!isMounted) return;

        // 메타데이터 매핑 및 렌더링 시작
        const initialChannels: (Channel & { team_id?: number | null; is_team?: boolean; relatedChannelIds?: number[] })[] = (favoritesData || []).map((fav: any) => {
          const ch = fav.channels;
          return {
            id: ch?.id,
            name: ch?.name || "기타",
            type: ch?.type,
            image_url: ch?.image_url || null,
            team_id: ch?.team_id,
            is_team: ch?.is_team || false,
            activeEventCount: undefined, // 배지는 백그라운드 로드
            favoriteCreatedAt: fav.created_at,
            relatedChannelIds: ch?.id ? [ch.id] : []
          };
        }).filter(c => c.id !== undefined);

        // [핵심 최적화] 소속사 멤버/뱃지 계산을 기다리지 않고 즉시 렌더링!
        cachedChannels = initialChannels;
        setChannels(initialChannels);
        setIsLoading(false);
        clearTimeout(safetyTimeout);

        // --- 화면이 뜬 상태에서 백그라운드로 도는 작업 ---
        
        // 소속 팀 채널들의 멤버 채널 목록 수집
        const teamIds = initialChannels.filter(c => c.is_team).map(c => c.id);
        let membersList: { id: number; team_id: number }[] = [];

        if (teamIds.length > 0) {
          const { data: membersData } = await supabase
            .from("channels")
            .select("id, team_id")
            .in("team_id", teamIds)
            .eq("is_team", false);
          
          membersList = (membersData || []) as { id: number; team_id: number }[];
        }

        // 각 채널별 연관 채널 ID 바인딩
        initialChannels.forEach(c => {
          if (c.is_team) {
            const memberIds = membersList.filter(m => m.team_id === c.id).map(m => m.id);
            c.relatedChannelIds = [c.id, ...memberIds];
          } else if (c.team_id) {
            c.relatedChannelIds = [c.id, c.team_id];
          } else {
            c.relatedChannelIds = [c.id];
          }
        });

        // 연관 채널들의 고유 ID 목록 추출
        const allQueryChannelIds = Array.from(new Set(
          initialChannels.flatMap(c => c.relatedChannelIds || [])
        ));

        // 2단계: 백그라운드에서 조용히 활성 행사 개수(Red Badge) 및 북마크 매핑 병렬 계산
        if (allQueryChannelIds.length > 0) {
          const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
          
          const [{ data: eventsData }, { data: bookmarksData }] = await Promise.all([
            supabase
              .from("event_channels")
              .select(`
                channel_id,
                events!inner (
                  id,
                  offline_events(id, end_date),
                  online_events(id, end_at)
                )
              `)
              .in("channel_id", allQueryChannelIds),
            supabase
              .from("event_bookmarks")
              .select("event_id")
              .eq("user_id", currentUser.id),
          ]);

          if (!isMounted) return;

          const bookmarkedEventIds = new Set((bookmarksData || []).map(b => b.event_id).filter(Boolean));
          
          // 채널별 활성 행사 매핑 수집
          const channelActiveEventsMap: Record<number, { eventId: number; isBookmarked: boolean }[]> = {};

          (eventsData || []).forEach((ec: any) => {
            const ev = ec.events;
            if (!ev) return;

            let isEventActive = false;
            if (ev.offline_events && ev.offline_events.length > 0) {
              const off = ev.offline_events[0];
              if (!off.end_date || off.end_date >= todayStr) {
                isEventActive = true;
              }
            } else if (ev.online_events && ev.online_events.length > 0) {
              const on = ev.online_events[0];
              const endAtDate = on.end_at ? on.end_at.split("T")[0] : null;
              if (!endAtDate || endAtDate >= todayStr) {
                isEventActive = true;
              }
            }

            if (isEventActive) {
              if (!channelActiveEventsMap[ec.channel_id]) {
                channelActiveEventsMap[ec.channel_id] = [];
              }
              channelActiveEventsMap[ec.channel_id].push({
                eventId: ev.id,
                isBookmarked: bookmarkedEventIds.has(ev.id)
              });
            }
          });

          // 채널 상태 업데이트 (연관 채널의 행사 개수를 수집하되 co-host 중복 제거)
          setChannels(prev => {
            const updated = prev.map(ch => {
              const extraCh = ch as any;
              const relatedIds: number[] = extraCh.relatedChannelIds || [ch.id];
              
              const allRelatedEvents: { eventId: number; isBookmarked: boolean }[] = [];
              relatedIds.forEach(rid => {
                const evs = channelActiveEventsMap[rid] || [];
                allRelatedEvents.push(...evs);
              });

              // eventId 기준 중복 제거 및 수치 합산
              const seenEventIds = new Set<number>();
              let uniqueActiveCount = 0;
              let hasBookmarkedEvent = false;

              allRelatedEvents.forEach(e => {
                if (!seenEventIds.has(e.eventId)) {
                  seenEventIds.add(e.eventId);
                  uniqueActiveCount++;
                  if (e.isBookmarked) {
                    hasBookmarkedEvent = true;
                  }
                }
              });

              return {
                ...ch,
                activeEventCount: uniqueActiveCount,
                hasBookmarkedEvent
              };
            });
            cachedChannels = updated;
            return updated;
          });
        }
      } catch (error) {
        console.error("FavoriteChannels: Failed progressive load:", error);
      }
    };

    checkAuthAndProgressiveFetch();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [user, mounted]);

  if (!mounted || isLoading) {
    return (
      <div className="bg-white mb-4 border-y border-border animate-pulse">
        <div className="flex items-center p-3 border-b border-border">
          <div className="h-4 bg-muted-foreground/30 rounded w-24" />
        </div>
        <div className="p-4 pt-4 flex gap-4 overflow-x-auto no-scrollbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[56px] md:min-w-[80px]">
              <div className="relative w-14 h-14 md:w-20 md:h-20">
                <div className="w-full h-full rounded-full bg-muted-foreground/30 shrink-0" />
              </div>
              <div className="flex flex-col items-center gap-1.5 mt-0.5">
                <div className="h-3 bg-muted-foreground/20 rounded w-12 md:w-16" />
                <div className="h-2.5 bg-muted-foreground/20 rounded w-8 md:w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const hasTooMany = channels.length > 10;

  return (
    <div className="bg-white mb-4 border-y border-border">
      <Link
        href="/all-channels"
        className="flex items-center p-3 cursor-pointer border-b border-border hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-sm">관심 채널 &gt;&gt;</span>
      </Link>

      <div className={`p-4 pt-4 pb-4 flex gap-x-3 md:gap-x-4 gap-y-4 md:gap-y-6 relative ${isExpanded ? "flex-wrap pr-4" : "flex-nowrap overflow-x-auto no-scrollbar pr-0"}`}>
        {channels.length === 0 ? (
          <div className="w-full h-[120px] flex flex-col items-center justify-center">
            {hasTimedOut ? (
              <>
                <p className="text-sm font-medium text-foreground">관심 채널 정보를 불러오는 중입니다...</p>
                <p className="text-xs text-muted-foreground mt-1">연결 상태가 늦어지고 있으니 잠시만 기다려주세요.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">아직 관심 채널이 없어요</p>
                <p className="text-xs text-muted-foreground mt-1">관심있는 채널을 찜해서 추가해보세요</p>
              </>
            )}
          </div>
        ) : (
          <>
            {channels.map((channel) => (
              <Link key={channel.id} href={`/channels/${channel.id}`} className="flex flex-col items-center gap-2 min-w-[56px] md:min-w-[80px] group">
                <div className="relative w-14 h-14 md:w-20 md:h-20 bg-brand-gradient p-[2.5px] rounded-full shadow-sm group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-muted flex items-center justify-center shrink-0">
                    {channel.image_url ? (
                      <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base md:text-xl font-bold text-muted-foreground">{channel.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  {channel.activeEventCount !== undefined && channel.activeEventCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded-full border-2 border-white min-w-[16px] md:min-w-[20px] text-center shadow-sm leading-none">
                      {channel.activeEventCount}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] md:text-xs font-medium text-center truncate w-14 md:w-20 leading-tight">{channel.name}</span>
                  <span className="text-[8px] md:text-[10px] text-muted-foreground text-center truncate w-14 md:w-20 leading-tight">{getChannelTypeText(channel.type)}</span>
                </div>
              </Link>
            ))}

            <Link
              href="/all-channels"
              className="flex flex-col items-center gap-2 min-w-[56px] md:min-w-[80px] group"
            >
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:bg-muted/50 transition-colors shadow-sm">
                <span className="text-2xl text-slate-400 dark:text-slate-500 font-light">+</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground text-center truncate leading-tight">
                  추가
                </span>
              </div>
            </Link>

            {!isExpanded && hasTooMany && (
              <div
                onClick={() => setIsExpanded(true)}
                className="sticky right-0 flex items-center justify-center min-w-[40px] md:min-w-[50px] cursor-pointer select-none bg-white/95 backdrop-blur-sm z-10 px-1.5 self-stretch border-l border-border/30 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.05)] hover:bg-muted/30 transition-all"
              >
                <span className="text-xs md:text-sm font-bold text-primary whitespace-nowrap px-1 hover:underline">
                  더보기
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {isExpanded && hasTooMany && (
        <div className="flex justify-center p-2.5 border-t border-border bg-muted/20">
          <button
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all py-1.5 px-4 rounded-xl hover:bg-muted/50 select-none border border-border/50 bg-white shadow-sm"
          >
            <span>접기</span>
            <span className="text-sm select-none">▲</span>
          </button>
        </div>
      )}
    </div>
  );
}
