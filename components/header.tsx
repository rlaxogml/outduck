"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Calendar, Heart, MapPinned, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";

type ChannelType = "game" | "youtuber" | "vtuber";

type ChannelSearchItem = {
  id: number;
  name: string;
  type: ChannelType | null;
  image_url: string | null;
};

const RECENT_CHANNELS_STORAGE_KEY = "recent-searched-channels";

const channelTypeLabel: Record<ChannelType, string> = {
  game: "게임",
  youtuber: "유튜버",
  vtuber: "버튜버",
};

const sanitizeSearchText = (value: string) => {
  return value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF\u3164\u115F]/g, "");
};

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<ChannelSearchItem[]>([]);
  const [lastValidResults, setLastValidResults] = useState<ChannelSearchItem[]>([]);
  const [recentChannels, setRecentChannels] = useState<ChannelSearchItem[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNoResultsMessage, setShowNoResultsMessage] = useState(false);
  const activeSearchRequestIdRef = useRef(0);
  const noResultsTimerRef = useRef<number | null>(null);
  const querySearchText = sanitizeSearchText(searchText)
    .replace(/\s+/g, " ")
    .trim();
  const hasTypedInput = searchText.trim().length > 0;

  useEffect(() => {
    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const savedRecentChannels = window.localStorage.getItem(
      RECENT_CHANNELS_STORAGE_KEY
    );

    if (!savedRecentChannels) {
      return;
    }

    try {
      const parsed = JSON.parse(savedRecentChannels) as ChannelSearchItem[];
      setRecentChannels(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentChannels([]);
    }
  }, []);

  useEffect(() => {
    if (!querySearchText) {
      setSearchResults([]);
      setLastValidResults([]);
      setShowNoResultsMessage(false);
      activeSearchRequestIdRef.current += 1;
      if (noResultsTimerRef.current) {
        window.clearTimeout(noResultsTimerRef.current);
        noResultsTimerRef.current = null;
      }
      return;
    }

    const requestId = ++activeSearchRequestIdRef.current;
    setShowNoResultsMessage(false);
    if (noResultsTimerRef.current) {
      window.clearTimeout(noResultsTimerRef.current);
      noResultsTimerRef.current = null;
    }

    const runSearch = async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, type, image_url")
        .ilike("name", `%${querySearchText}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (requestId !== activeSearchRequestIdRef.current) {
        return;
      }

      if (error) {
        noResultsTimerRef.current = window.setTimeout(() => {
          if (requestId !== activeSearchRequestIdRef.current) {
            return;
          }
          setSearchResults([]);
          setShowNoResultsMessage(true);
        }, 300);
        return;
      }

      const nextResults = (data ?? []) as ChannelSearchItem[];

      if (nextResults.length > 0) {
        setSearchResults(nextResults);
        setLastValidResults(nextResults);
        setShowNoResultsMessage(false);
        return;
      }

      // Keep previous valid results briefly to avoid flicker.
      noResultsTimerRef.current = window.setTimeout(() => {
        if (requestId !== activeSearchRequestIdRef.current) {
          return;
        }
        setSearchResults([]);
        setShowNoResultsMessage(true);
      }, 300);
    };

    const searchDebounceTimer = window.setTimeout(() => {
      runSearch();
    }, 100);

    return () => {
      window.clearTimeout(searchDebounceTimer);
    };
  }, [querySearchText]);

  useEffect(() => {
    return () => {
      if (noResultsTimerRef.current) {
        window.clearTimeout(noResultsTimerRef.current);
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.email as string | undefined) ??
    "사용자";
  const avatarFallbackText = userName.slice(0, 1).toUpperCase();

  const saveRecentChannel = (channel: ChannelSearchItem) => {
    const deduplicatedChannels = recentChannels.filter(
      (recentChannel) => recentChannel.id !== channel.id
    );
    const updatedRecentChannels = [channel, ...deduplicatedChannels].slice(0, 8);

    setRecentChannels(updatedRecentChannels);
    window.localStorage.setItem(
      RECENT_CHANNELS_STORAGE_KEY,
      JSON.stringify(updatedRecentChannels)
    );
  };

  const handleChannelSelect = (channel: ChannelSearchItem) => {
    saveRecentChannel(channel);
    setIsSearchFocused(false);
    router.push(`/channels/${channel.id}`);
  };

  const handleSearchInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== "Enter") {
      return;
    }

    const trimmedSearchText = querySearchText;
    if (!trimmedSearchText) {
      return;
    }

    if (searchResults.length === 1) {
      event.preventDefault();
      handleChannelSelect(searchResults[0]);
    }
  };

  const displayedChannels = hasTypedInput
    ? searchResults.length > 0
      ? searchResults
      : showNoResultsMessage
        ? []
        : lastValidResults
    : recentChannels;

  const renderChannelType = (channelType: ChannelType | null) => {
    if (!channelType || !(channelType in channelTypeLabel)) {
      return "기타";
    }

    return channelTypeLabel[channelType];
  };

  const getChannelInitial = (channelName: string) => {
    return channelName.trim().slice(0, 1).toUpperCase() || "?";
  };

  return (
    <header className="border-b border-border bg-background">
      {/* Top bar: Logo and Login */}
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-[2.5px] border-foreground">
            <Star className="h-6 w-6" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">아이콘</span>
        </div>

        {user ? (
          <Avatar className="size-11 border border-border">
            <AvatarImage src={avatarUrl} alt={`${userName} 프로필`} />
            <AvatarFallback>{avatarFallbackText}</AvatarFallback>
          </Avatar>
        ) : (
          <Button
            variant="ghost"
            className="text-sm font-medium"
            onClick={handleGoogleLogin}
          >
            로그인
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex items-center justify-center gap-6 border-t border-border px-4 py-3">
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Calendar className="h-4 w-4" />
          캘린더
        </button>
        <span className="text-border">|</span>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <MapPinned className="h-4 w-4" />
          지도
        </button>
        <span className="text-border">|</span>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Heart className="h-4 w-4" />
          찜한 행사
        </button>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="relative mx-auto w-full max-w-3xl">
          <div className="relative flex w-full items-center">
            <Search className="absolute left-4 h-[18px] w-[18px] text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setIsSearchFocused(false);
                }, 120);
              }}
              placeholder="채널명을 검색해보세요"
              className="h-12 w-full rounded-full border border-transparent bg-muted pl-11 pr-5 text-[15px] outline-none transition-all placeholder:text-muted-foreground focus:border-foreground focus:bg-background focus:shadow-sm"
            />
          </div>

          {isSearchFocused && (
            <div className="absolute top-[52px] z-20 w-full rounded-2xl border border-border bg-background p-2 shadow-lg">
              {displayedChannels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {hasTypedInput
                    ? showNoResultsMessage
                      ? "검색 결과가 없습니다."
                      : "검색 결과를 확인하는 중..."
                    : "최근 검색한 채널이 없습니다."}
                </div>
              ) : (
                <ul className="flex gap-3 overflow-x-auto p-1">
                  {displayedChannels.map((channel) => (
                    <li
                      key={channel.id}
                      className="min-w-28 flex-shrink-0"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleChannelSelect(channel)}
                        className="w-full rounded-xl border border-border p-3 text-center hover:bg-muted"
                      >
                        <Avatar className="mx-auto mb-2 h-12 w-12 border border-border">
                          <AvatarImage src={channel.image_url ?? undefined} alt={`${channel.name} 프로필`} className="object-cover" />
                          <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                            {getChannelInitial(channel.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate text-sm font-medium">
                          {channel.name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {renderChannelType(channel.type)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
