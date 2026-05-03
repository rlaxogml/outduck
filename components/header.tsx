"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Calendar, Heart, MapPinned, Star, Search, X, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const pathname = usePathname();

  // 색상은 여기서 쉽게 변경할 수 있습니다.
  const activeGradientStyle = {
    background: "linear-gradient(to right, #3b82f6, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontWeight: "bold"
  } as const;

  const getNavStyle = (path: string) => {
    const isActive = pathname === path;
    if (isActive) {
      return {
        isActive,
        button: "flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-bold transition-colors min-w-[44px] sm:min-w-fit",
        icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-blue-500 flex-shrink-0",
        text: activeGradientStyle,
      };
    }
    return {
      isActive,
      button: "flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-w-[44px] sm:min-w-fit",
      icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0",
      text: {}
    };
  };

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


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.reload();
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

  const clearRecentChannels = () => {
    setRecentChannels([]);
    window.localStorage.removeItem(RECENT_CHANNELS_STORAGE_KEY);
  };

  const removeRecentChannel = (id: number) => {
    const updatedChannels = recentChannels.filter((c) => c.id !== id);
    setRecentChannels(updatedChannels);
    if (updatedChannels.length > 0) {
      window.localStorage.setItem(
        RECENT_CHANNELS_STORAGE_KEY,
        JSON.stringify(updatedChannels)
      );
    } else {
      window.localStorage.removeItem(RECENT_CHANNELS_STORAGE_KEY);
    }
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
      <div className="flex items-center justify-between px-3.5 md:px-4 py-2 md:py-3">
        <div
          className="flex items-center gap-2 md:gap-3 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <div className="flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-full border-2 md:border-[2.5px] border-foreground">
            <Star className="h-4 w-4 md:h-6 md:w-6" />
          </div>
          <span className="text-lg md:text-2xl font-extrabold tracking-tight">아이콘</span>
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 md:h-11 md:w-11 border border-border cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={avatarUrl} alt={`${userName} 프로필`} />
                <AvatarFallback>{avatarFallbackText}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/mypage')} className="cursor-pointer">
                마이페이지
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-500/10">
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            className="text-xs md:text-sm font-medium"
            onClick={handleGoogleLogin}
          >
            로그인
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex items-center justify-around sm:justify-center gap-2 sm:gap-6 border-t border-border px-3.5 py-2 sm:py-2.5 flex-nowrap overflow-x-auto no-scrollbar">
        <button 
          onClick={() => router.push("/")}
          className={getNavStyle("/").button}
        >
          <House className={getNavStyle("/").icon} />
          <span style={getNavStyle("/").text}>홈</span>
        </button>
        <span className="text-border shrink-0 select-none">|</span>
        <button 
          onClick={() => router.push("/calendar")}
          className={getNavStyle("/calendar").button}
        >
          <Calendar className={getNavStyle("/calendar").icon} />
          <span style={getNavStyle("/calendar").text}>캘린더</span>
        </button>
        <span className="text-border shrink-0 select-none">|</span>
        <button 
          onClick={() => router.push("/map")}
          className={getNavStyle("/map").button}
        >
          <MapPinned className={getNavStyle("/map").icon} />
          <span style={getNavStyle("/map").text}>지도</span>
        </button>
        <span className="text-border shrink-0 select-none">|</span>
        <button 
          onClick={() => router.push("/subscriptions")}
          className={getNavStyle("/subscriptions").button}
        >
          <Star className={getNavStyle("/subscriptions").icon} />
          <span style={getNavStyle("/subscriptions").text}>구독 행사</span>
        </button>
        <span className="text-border shrink-0 select-none">|</span>
        <button 
          onClick={() => router.push("/bookmarks")}
          className={getNavStyle("/bookmarks").button}
        >
          <Heart className={getNavStyle("/bookmarks").icon} />
          <span style={getNavStyle("/bookmarks").text}>찜한 행사</span>
        </button>
      </nav>

      <div className="border-t border-border px-3.5 md:px-4 py-2.5 md:py-3">
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
              className="h-11 md:h-12 w-full rounded-full border border-transparent bg-muted pl-11 pr-5 text-sm md:text-[15px] outline-none transition-all placeholder:text-muted-foreground focus:border-foreground focus:bg-background focus:shadow-sm"
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
                <div className="flex flex-col gap-1">
                  {!hasTypedInput && displayedChannels.length > 0 && (
                    <div className="flex items-center justify-between px-3 pt-1 pb-2">
                      <span className="text-sm font-semibold">최근 검색</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={clearRecentChannels}
                      >
                        전체 삭제
                      </button>
                    </div>
                  )}
                  <ul className="flex gap-3 overflow-x-auto p-1 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {displayedChannels.map((channel) => (
                      <li
                        key={channel.id}
                        className="relative min-w-28 flex-shrink-0 group"
                      >
                        {!hasTypedInput && (
                          <button
                            type="button"
                            className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentChannel(channel.id);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleChannelSelect(channel)}
                          className="w-full rounded-xl border border-border p-3 text-center hover:bg-muted transition-colors"
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
