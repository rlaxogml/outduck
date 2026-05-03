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
  vtuber: "버튜버",
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchFavoritesAndBookmarks = async (currentUser: any) => {
      try {
        if (!currentUser) {
          setChannels([]);
          setIsLoading(false);
          return;
        }

        const [{ data: favoritesData, error: favError }, { data: bookmarksData }] = await Promise.all([
          supabase
            .from("favorites")
            .select("channel_id, created_at, channels(id, name, type, image_url, offline_event_channels(offline_events(id, created_at, end_date)), online_event_channels(online_events(id, created_at, end_at)))")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("event_bookmarks")
            .select("offline_event_id, online_event_id")
            .eq("user_id", currentUser.id),
        ]);

        if (!favError && favoritesData) {
          const today = new Date().toISOString().split("T")[0];
          const bookmarkedOfflineIds = bookmarksData?.map(b => b.offline_event_id).filter(Boolean) || [];
          const bookmarkedOnlineIds = bookmarksData?.map(b => b.online_event_id).filter(Boolean) || [];

          const favoriteChannels = favoritesData
            .map((f: any) => {
              const channel = f.channels;
              if (!channel) return null;

              let activeCount = 0;
              let hasBookmarkedEvent = false;
              let latestEventCreatedAt = "";

              if (channel.offline_event_channels) {
                channel.offline_event_channels.forEach((ec: any) => {
                  const event = ec.offline_events;
                  if (event) {
                    if (!event.end_date || event.end_date >= today) {
                      activeCount++;
                    }
                    if (bookmarkedOfflineIds.includes(event.id)) {
                      hasBookmarkedEvent = true;
                    }
                    if (event.created_at && (!latestEventCreatedAt || event.created_at > latestEventCreatedAt)) {
                      latestEventCreatedAt = event.created_at;
                    }
                  }
                });
              }

              if (channel.online_event_channels) {
                channel.online_event_channels.forEach((ec: any) => {
                  const event = ec.online_events;
                  if (event) {
                    if (!event.end_at || event.end_at >= today) {
                      activeCount++;
                    }
                    if (bookmarkedOnlineIds.includes(event.id)) {
                      hasBookmarkedEvent = true;
                    }
                    if (event.created_at && (!latestEventCreatedAt || event.created_at > latestEventCreatedAt)) {
                      latestEventCreatedAt = event.created_at;
                    }
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

          setChannels([...zone1, ...zone2]);
        }
      } catch (error) {
        console.error("Failed to fetch user or favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchFavoritesAndBookmarks(currentUser);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setIsLoading(true);
        fetchFavoritesAndBookmarks(currentUser);
      } else {
        setChannels([]);
        setIsLoading(false);
      }
    });

    return () => {
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
            <p className="text-sm font-medium text-foreground">아직 관심 채널이 없어요</p>
            <p className="text-xs text-muted-foreground mt-1">관심있는 채널을 찜해서 추가해보세요</p>
          </div>
        ) : (
          <>
            {channels.map((channel) => (
              <Link key={channel.id} href={`/channels/${channel.id}`} className="flex flex-col items-center gap-2 min-w-[56px] md:min-w-[80px]">
                <div className="relative w-14 h-14 md:w-20 md:h-20">
                  <div className="w-full h-full rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                    {channel.image_url ? (
                      <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base md:text-xl font-bold">{channel.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  {channel.activeEventCount !== undefined && channel.activeEventCount > 0 && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] md:text-[10px] font-bold px-1 md:px-1.5 py-0.5 rounded-full border-2 border-background min-w-[16px] md:min-w-[20px] text-center shadow-sm leading-none">
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
