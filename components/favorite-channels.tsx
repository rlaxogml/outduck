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
  festival: "동인 행사",
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

    if (!user) {
      console.log("FavoriteChannels: No user prop. Resetting channels.");
      cachedChannels = null;
      setChannels([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setHasTimedOut(false);

    let safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("FavoriteChannels: Loading safety timeout reached (15s). Forcing isLoading to false.");
        setHasTimedOut(true);
        setIsLoading(false);
      }
    }, 15000);

    const fetchFavoritesAndBookmarks = async (currentUser: any) => {
      console.log("FavoriteChannels: Starting fetchFavoritesAndBookmarks for user:", currentUser.id);
      try {
        const [{ data: favoritesData, error: favError }, { data: bookmarksData }] = await Promise.all([
          supabase
            .from("favorites")
            .select("channel_id, created_at, channels(id, name, type, image_url, event_channels(events(id, offline_events(id, created_at, end_date), online_events(id, created_at, end_at))))")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("event_bookmarks")
            .select("event_id")
            .eq("user_id", currentUser.id),
        ]);

        if (favError) {
          console.error("FavoriteChannels: Error fetching favorites:", favError);
          throw favError;
        }

        if (isMounted) {
          const bookmarkedEventIds = new Set((bookmarksData || []).map(b => b.event_id).filter(Boolean));
          const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

          const zone1: Channel[] = [];
          const zone2: Channel[] = [];

          if (favoritesData) {
            favoritesData.forEach((fav: any) => {
              const ch = fav.channels;
              if (!ch) return;

              let activeEventCount = 0;
              let hasBookmarkedEvent = false;
              let latestEventCreatedAt = "";

              if (ch.event_channels) {
                ch.event_channels.forEach((ec: any) => {
                  const ev = ec.events;
                  if (!ev) return;

                  let isEventActive = false;
                  let eventCreatedAt = "";

                  if (ev.offline_events && ev.offline_events.length > 0) {
                    const off = ev.offline_events[0];
                    if (!off.end_date || off.end_date >= todayStr) {
                      isEventActive = true;
                    }
                    eventCreatedAt = off.created_at || "";
                  } else if (ev.online_events && ev.online_events.length > 0) {
                    const on = ev.online_events[0];
                    const endAtDate = on.end_at ? on.end_at.split("T")[0] : null;
                    if (!endAtDate || endAtDate >= todayStr) {
                      isEventActive = true;
                    }
                    eventCreatedAt = on.created_at || "";
                  }

                  if (isEventActive) {
                    activeEventCount++;
                    if (bookmarkedEventIds.has(ev.id)) {
                      hasBookmarkedEvent = true;
                    }
                    if (eventCreatedAt && (!latestEventCreatedAt || eventCreatedAt > latestEventCreatedAt)) {
                      latestEventCreatedAt = eventCreatedAt;
                    }
                  }
                });
              }

              const formattedChannel: Channel = {
                id: ch.id,
                name: ch.name,
                type: ch.type,
                image_url: ch.image_url,
                activeEventCount,
                hasBookmarkedEvent,
                latestEventCreatedAt,
                favoriteCreatedAt: fav.created_at
              };

              if (activeEventCount > 0) {
                zone1.push(formattedChannel);
              } else {
                zone2.push(formattedChannel);
              }
            });

            // Sort zone1: bookmarked events first, then latest created event first
            zone1.sort((a, b) => {
              if (a.hasBookmarkedEvent && !b.hasBookmarkedEvent) return -1;
              if (!a.hasBookmarkedEvent && b.hasBookmarkedEvent) return 1;
              if (a.latestEventCreatedAt && b.latestEventCreatedAt) {
                return b.latestEventCreatedAt.localeCompare(a.latestEventCreatedAt);
              }
              return (b.favoriteCreatedAt || "").localeCompare(a.favoriteCreatedAt || "");
            });

            // Sort zone2: latest favorite first
            zone2.sort((a, b) => {
              return (b.favoriteCreatedAt || "").localeCompare(a.favoriteCreatedAt || "");
            });

            cachedChannels = [...zone1, ...zone2];
            setChannels(cachedChannels);
            setHasTimedOut(false);
          }
        }
      } catch (error) {
        console.error("FavoriteChannels: Failed to fetch user or favorites:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        clearTimeout(safetyTimeout);
        console.log("FavoriteChannels: fetchFavoritesAndBookmarks finished.");
      }
    };

    fetchFavoritesAndBookmarks(user);

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
      <div
        className="flex items-center p-3 cursor-pointer border-b border-border"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-semibold text-sm">관심 채널 &gt;&gt;</span>
      </div>

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
