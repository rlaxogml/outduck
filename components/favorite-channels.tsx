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

export function FavoriteChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    console.log("FavoriteChannels: Component mounted.");
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log("FavoriteChannels: Auth useEffect initialized.");
    let isMounted = true;
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
        if (!currentUser) {
          if (isMounted) {
            setChannels([]);
            setIsLoading(false);
          }
          clearTimeout(safetyTimeout);
          return;
        }

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

        console.log("FavoriteChannels: Favorites and Bookmarks fetched. Processing data...", {
          favoritesCount: favoritesData?.length,
          bookmarksCount: bookmarksData?.length
        });

        if (favoritesData) {
          const today = new Date().toISOString().split("T")[0];
          const bookmarkedEventIds = bookmarksData?.map(b => b.event_id).filter(Boolean) || [];

          const favoriteChannels = favoritesData
            .map((f: any) => {
              const channel = f.channels;
              if (!channel) return null;

              let activeCount = 0;
              let hasBookmarkedEvent = false;
              let latestEventCreatedAt = "";

              if (channel.event_channels) {
                channel.event_channels.forEach((ec: any) => {
                  const baseEv = ec.events;
                  if (!baseEv) return;

                  const baseEvId = baseEv.id;
                  const isMatchedBookmark = bookmarkedEventIds.includes(baseEvId);

                  // Handle offline variants
                  if (baseEv.offline_events) {
                    baseEv.offline_events.forEach((event: any) => {
                      if (!event.end_date || event.end_date >= today) {
                        activeCount++;
                      }
                      if (isMatchedBookmark) {
                        hasBookmarkedEvent = true;
                      }
                      if (event.created_at && (!latestEventCreatedAt || event.created_at > latestEventCreatedAt)) {
                        latestEventCreatedAt = event.created_at;
                      }
                    });
                  }

                  // Handle online variants
                  if (baseEv.online_events) {
                    baseEv.online_events.forEach((event: any) => {
                      if (!event.end_at || event.end_at.split('T')[0] >= today) {
                        activeCount++;
                      }
                      if (isMatchedBookmark) {
                        hasBookmarkedEvent = true;
                      }
                      if (event.created_at && (!latestEventCreatedAt || event.created_at > latestEventCreatedAt)) {
                        latestEventCreatedAt = event.created_at;
                      }
                    });
                  }
                });
              }

              return {
                id: channel.id,
                name: channel.name,
                type: channel.type,
                image_url: channel.image_url,
                activeEventCount: activeCount,
                hasBookmarkedEvent,
                latestEventCreatedAt,
                favoriteCreatedAt: f.created_at,
              } as Channel;
            })
            .filter(Boolean) as Channel[];

          const zone1 = favoriteChannels.filter(c => (c.activeEventCount ?? 0) > 0);
          const zone2 = favoriteChannels.filter(c => (c.activeEventCount ?? 0) === 0);

          zone1.sort((a, b) => {
            if (a.hasBookmarkedEvent && !b.hasBookmarkedEvent) return -1;
            if (!a.hasBookmarkedEvent && b.hasBookmarkedEvent) return 1;

            const timeA = a.latestEventCreatedAt ? new Date(a.latestEventCreatedAt).getTime() : 0;
            const timeB = b.latestEventCreatedAt ? new Date(b.latestEventCreatedAt).getTime() : 0;
            return timeB - timeA;
          });

          zone2.sort((a, b) => {
            const timeA = a.favoriteCreatedAt ? new Date(a.favoriteCreatedAt).getTime() : 0;
            const timeB = b.favoriteCreatedAt ? new Date(b.favoriteCreatedAt).getTime() : 0;
            return timeB - timeA;
          });

          if (isMounted) {
            setChannels([...zone1, ...zone2]);
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

    console.log("FavoriteChannels: Calling supabase.auth.getSession()...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("FavoriteChannels: getSession resolved.", { hasSession: !!session });
      const currentUser = session?.user ?? null;
      
      if (!currentUser) {
        console.log("FavoriteChannels: No user session found.");
        if (isMounted) {
          setChannels([]);
          setIsLoading(false);
        }
        clearTimeout(safetyTimeout);
        return;
      }

      setUser((prev: any) => {
        if (prev?.id === currentUser.id) {
          console.log("FavoriteChannels: User session unchanged.");
          clearTimeout(safetyTimeout);
          return prev;
        }
        fetchFavoritesAndBookmarks(currentUser);
        return currentUser;
      });
    }).catch(err => {
      console.error("FavoriteChannels: getSession failed:", err);
      if (isMounted) {
        setIsLoading(false);
      }
      clearTimeout(safetyTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("FavoriteChannels: onAuthStateChange fired.", { event: _event, hasSession: !!session });
      const currentUser = session?.user ?? null;
      
      if (!currentUser) {
        console.log("FavoriteChannels: onAuthStateChange - No user session.");
        if (isMounted) {
          setChannels([]);
          setIsLoading(false);
        }
        clearTimeout(safetyTimeout);
        setUser(null);
        return;
      }

      setUser((prev: any) => {
        if (prev?.id === currentUser.id) {
          console.log("FavoriteChannels: onAuthStateChange - User session unchanged.");
          clearTimeout(safetyTimeout);
          return prev;
        }
        
        if (isMounted) {
          setIsLoading(true);
        }
        
        // Reset safety timeout for new fetch
        clearTimeout(safetyTimeout);
        safetyTimeout = setTimeout(() => {
          if (isMounted) {
            console.warn("FavoriteChannels: onAuthStateChange - Safety timeout reached (15s). Forcing isLoading to false.");
            setHasTimedOut(true);
            setIsLoading(false);
          }
        }, 15000);

        fetchFavoritesAndBookmarks(currentUser);
        return currentUser;
      });
    });

    return () => {
      console.log("FavoriteChannels: Cleaning up Auth useEffect.");
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

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
