"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

type Channel = {
  id: number;
  name: string;
  type: string | null;
  image_url: string | null;
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data, error } = await supabase
          .from("favorites")
          .select("channel_id, created_at, channels(id, name, type, image_url)")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const favoriteChannels = data
            .map((f: any) => f.channels)
            .filter(Boolean) as Channel[];
          setChannels(favoriteChannels);
        }
      }
      setIsLoading(false);
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
              <div className="w-20 h-20 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                {channel.image_url ? (
                  <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold">{channel.name.slice(0,1).toUpperCase()}</span>
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
