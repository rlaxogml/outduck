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

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const { data, error } = await supabase
            .from("favorites")
            .select("channel_id, created_at, channels(id, name, type, image_url, offline_event_channels(offline_events(id, end_date)), online_event_channels(online_events(id, end_at)))")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

          if (!error && data) {
            const today = new Date().toISOString().split("T")[0];
            const favoriteChannels = data
              .map((f: any) => {
                const channel = f.channels;
                if (!channel) return null;
                
                let activeCount = 0;
                if (channel.offline_event_channels) {
                  channel.offline_event_channels.forEach((ec: any) => {
                    const event = ec.offline_events;
                    if (event) {
                      if (!event.end_date || event.end_date >= today) {
                        activeCount++;
                      }
                    }
                  });
                }
                
                if (channel.online_event_channels) {
                  channel.online_event_channels.forEach((ec: any) => {
                    const event = ec.online_events;
                    if (event) {
                      // end_at includes time, so we just compare string lexicographically or check if it's not strictly less than today
                      if (!event.end_at || event.end_at >= today) {
                        activeCount++;
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
                } as Channel;
              })
              .filter(Boolean) as Channel[];
            setChannels(favoriteChannels);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user or favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  if (isLoading || !user) return null;

  return (
    <div className="bg-white mb-4 border-y border-border">
      <div 
        className="flex items-center p-3 cursor-pointer border-b border-border"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-semibold text-sm">관심 채널 &gt;&gt;</span>
      </div>
      
      <div className={`p-4 pt-4 flex gap-4 ${isExpanded ? 'flex-wrap' : 'overflow-x-auto no-scrollbar'}`}>
        {channels.length === 0 ? (
          <div className="w-full h-[120px] flex flex-col items-center justify-center">
            <p className="text-sm font-medium text-foreground">아직 관심 채널이 없어요</p>
            <p className="text-xs text-muted-foreground mt-1">관심있는 채널을 찜해서 추가해보세요</p>
          </div>
        ) : (
          channels.map((channel) => (
            <Link key={channel.id} href={`/channels/${channel.id}`} className="flex flex-col items-center gap-2 min-w-[80px]">
              <div className="relative w-20 h-20">
                <div className="w-full h-full rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                  {channel.image_url ? (
                    <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold">{channel.name.slice(0,1).toUpperCase()}</span>
                  )}
                </div>
                {channel.activeEventCount !== undefined && channel.activeEventCount > 0 && (
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-background min-w-[20px] text-center shadow-sm">
                    {channel.activeEventCount}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-medium text-center truncate w-20">{channel.name}</span>
                <span className="text-[10px] text-muted-foreground text-center truncate w-20">{getChannelTypeText(channel.type)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
