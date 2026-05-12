"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { Calendar, Heart, MapPinned, Star, Search, X, House, PlusCircle } from "lucide-react";
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

type ChannelType = "game" | "youtuber";

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
};

const sanitizeSearchText = (value: string) => {
  return value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF\u3164\u115F]/g, "");
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getNavStyle = (path: string) => {
    // Default logic: check if mounted. If not yet mounted (SSR/Hydration phase), assume we are on the Home page for the static initial render to ensure correct visible highlight immediately.
    const isActive = isMounted ? (pathname === path) : (path === "/");

    if (isActive) {
      return {
        isActive,
        button: "flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-bold transition-colors min-w-[44px] sm:min-w-fit",
        icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-blue-500 flex-shrink-0",
        textClassName: "bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 font-bold whitespace-nowrap",
      };
    }
    return {
      isActive,
      // Inactive: Switched to high-contrast bold dark charcoal text as requested.
      button: "flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-foreground transition-colors min-w-[44px] sm:min-w-fit",
      icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-slate-800 dark:text-slate-300 flex-shrink-0",
      textClassName: "font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap"
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
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
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
    <header className="border-b border-border bg-background w-full">
      {/* Top bar: Logo and Login (Wrapper spans full width) */}
      <div className="border-b border-border/50">
        <div className="mx-auto max-w-7xl w-full flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] px-3.5 md:px-4 py-2 md:py-3">
          <div
            className="flex items-center gap-2 md:gap-3 cursor-pointer flex-shrink-0 justify-self-start"
            onClick={() => router.push("/")}
          >
            <Image 
              src="/logo.png" 
              alt="Icon" 
              width={120} 
              height={120} 
              className="h-11 w-11 md:h-14 md:w-14 object-contain flex-shrink-0" 
              priority 
              unoptimized
            />
            <Image 
              src="/logo-text.png" 
              alt="Logo" 
              width={250} 
              height={100} 
              className="h-12 md:h-15 w-auto object-contain flex-shrink-0" 
              priority 
              unoptimized
            />
          </div>

          {/* Integrated Search Bar: Explicit fixed width overrides to force CSS Grid 'auto' expansion */}
          <div className="relative w-full md:w-[500px] lg:w-[700px] xl:w-[850px] max-w-3xl md:max-w-4xl mx-3 md:mx-auto md:px-4">
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
              <div className="absolute top-[52px] left-0 right-0 z-[100] w-full rounded-2xl border border-border bg-background p-2 shadow-xl">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            clearRecentChannels();
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          모두 지우기
                        </button>
                      </div>
                    )}
                    <ul className="flex gap-3 overflow-x-auto p-1 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {displayedChannels.map((channel) => (
                        <li
                          key={channel.id}
                          className="relative min-w-[100px] flex-shrink-0 group"
                        >
                          {!hasTypedInput && (
                            <button
                              type="button"
                              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentChannel(channel.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleChannelSelect(channel)}
                            className="w-full rounded-xl border border-border p-2.5 text-center hover:bg-muted transition-colors"
                          >
                            <Avatar className="mx-auto mb-2 h-10 w-10 border border-border">
                              <AvatarImage src={channel.image_url ?? undefined} alt={`${channel.name} 프로필`} className="object-cover" />
                              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                                {getChannelInitial(channel.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="truncate text-[13px] font-medium">
                              {channel.name}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
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

          <div className="flex-shrink-0 justify-self-end">
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
        </div>
      </div>

      {/* Navigation Container */}
      <div className="border-t border-border w-full relative">
        <div className="mx-auto max-w-7xl w-full relative flex items-center justify-center">
          {/* Main Scrollable Nav - Increased vertical padding for lux room, and bumped right guard to detach neighbor elements */}
          <nav className="flex items-center justify-around sm:justify-center gap-2 sm:gap-6 px-3.5 py-2.5 sm:py-3.5 w-full overflow-x-auto no-scrollbar pr-28 sm:pr-0">
            <button
              onClick={() => router.push("/")}
              className={getNavStyle("/").button}
            >
              <House className={getNavStyle("/").icon} />
              <span className={getNavStyle("/").textClassName}>홈</span>
            </button>
            <span className="text-border shrink-0 select-none">|</span>
            <button
              onClick={() => router.push("/calendar")}
              className={getNavStyle("/calendar").button}
            >
              <Calendar className={getNavStyle("/calendar").icon} />
              <span className={getNavStyle("/calendar").textClassName}>캘린더</span>
            </button>
            <span className="text-border shrink-0 select-none">|</span>
            <button
              onClick={() => router.push("/map")}
              className={getNavStyle("/map").button}
            >
              <MapPinned className={getNavStyle("/map").icon} />
              <span className={getNavStyle("/map").textClassName}>지도</span>
            </button>
            <span className="text-border shrink-0 select-none">|</span>
            <button
              onClick={() => router.push("/subscriptions")}
              className={getNavStyle("/subscriptions").button}
            >
              <Star className={getNavStyle("/subscriptions").icon} />
              <span className={getNavStyle("/subscriptions").textClassName}>구독 행사</span>
            </button>
            <span className="text-border shrink-0 select-none">|</span>
            <button
              onClick={() => router.push("/bookmarks")}
              className={getNavStyle("/bookmarks").button}
            >
              <Heart className={getNavStyle("/bookmarks").icon} />
              <span className={getNavStyle("/bookmarks").textClassName}>찜한 행사</span>
            </button>
          </nav>

          {/* Floating Action Button: Pushed visibly inward to fully detach from edge and made slightly lusher */}
          <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 z-10 flex items-center">
            <button
              onClick={() => router.push("/apply")}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
            >
              <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">주최자 등록</span>
            </button>
          </div>
        </div>
      </div>

    </header>
  );
}

