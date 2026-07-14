"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { Bell, Calendar, CheckCircle2, Heart, House, Loader2, MapPinned, Megaphone, Menu, PlusCircle, Search, Star, User as UserIcon, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CUSTOM_EVENTS } from "@/lib/constants";

type ChannelType = "game" | "youtuber" | "vtuber" | "festival";

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
  festival: "축제",
};

const sanitizeSearchText = (value: string) => {
  return value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF\u3164\u115F]/g, "");
};

interface HeaderProps {
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
}

export function Header({ activeCategory, onCategoryChange }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  useEffect(() => {
    setIsMounted(true);

    const handleOpenMenu = () => setIsDrawerOpen(true);
    window.addEventListener(CUSTOM_EVENTS.OPEN_MOBILE_MENU, handleOpenMenu);
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.OPEN_MOBILE_MENU, handleOpenMenu);
    };
  }, []);

  const getNavStyle = (path: string) => {
    // Default logic: check if mounted. If not yet mounted (SSR/Hydration phase), assume we are on the Home page for the static initial render to ensure correct visible highlight immediately.
    const isActive = isMounted ? (pathname === path) : (path === "/");

    if (isActive) {
      return {
        isActive,
        button: "group flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-extrabold transition-all duration-200 min-w-[44px] sm:min-w-fit px-3 py-1.5 rounded-full bg-blue-100/80 dark:bg-blue-950/60 shadow-sm scale-[1.03]",
        icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 flex-shrink-0",
        textClassName: "bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 whitespace-nowrap",
      };
    }
    return {
      isActive,
      // Inactive: High-visibility interactive state with bolder hover effects and noticeable scaling.
      button: "group flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[44px] sm:min-w-fit px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white hover:scale-[1.06] hover:shadow-sm active:scale-[0.96] transition-all duration-200 cursor-pointer",
      icon: "h-[18px] w-[18px] sm:h-4 sm:w-4 text-slate-800 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white group-hover:scale-110 transition-all duration-200 flex-shrink-0",
      textClassName: "font-bold text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white whitespace-nowrap"
    };
  };

  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Notification states & hooks
  type Notification = {
    id: string;
    user_id: string;
    type: string;
    message: string;
    is_read: boolean;
    read_at: string | null;
    event_id: number | null;
    channel_id: number | null;
    created_at: string;
  };

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "어제";
    if (diffInDays < 7) return `${diffInDays}일 전`;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_event":
        return <Calendar className="w-4 h-4" />;
      case "new_notice":
        return <Megaphone className="w-4 h-4" />;
      case "request_status":
        return <CheckCircle2 className="w-4 h-4" />;
      case "new_company_request":
        return <PlusCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColorClass = (type: string) => {
    switch (type) {
      case "new_event":
        return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
      case "new_notice":
        return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
      case "request_status":
        return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
      case "new_company_request":
        return "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400";
      default:
        return "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400";
    }
  };

  const fetchNotifications = async (userId: string) => {
    setIsNotificationsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      const loaded = data || [];
      setNotifications(loaded);
      setUnreadCount(loaded.filter(n => !n.is_read).length);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  const handleDropdownOpen = async (open: boolean) => {
    setIsNotifDropdownOpen(open);
    if (open && user && unreadCount > 0) {
      // Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (error) throw error;
      } catch (err) {
        console.error("Failed to mark notifications as read:", err);
      }
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("id", notif.id);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    if (notif.event_id) {
      router.push(`/events/${notif.event_id}`);
    } else if (notif.channel_id) {
      router.push(`/channels/${notif.channel_id}`);
    } else if (notif.type === "new_company_request") {
      router.push("/company");
    }
    // request_status 타입 알림은 클릭 시 이동하지 않음
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications(user.id);

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);

          toast.info(newNotif.message || "새로운 알림이 도착했습니다.", {
            action: newNotif.event_id ? {
              label: "확인",
              onClick: () => {
                handleNotificationClick(newNotif);
              }
            } : undefined
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const [hasChannel, setHasChannel] = useState(false);
  const [isCompanyUser, setIsCompanyUser] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<ChannelSearchItem[]>([]);
  const [lastValidResults, setLastValidResults] = useState<ChannelSearchItem[]>([]);
  const [recentChannels, setRecentChannels] = useState<ChannelSearchItem[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNoResultsMessage, setShowNoResultsMessage] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const activeSearchRequestIdRef = useRef(0);

  // Close mobile search on navigation
  useEffect(() => {
    setIsMobileSearchOpen(false);
    setSearchText("");
  }, [pathname]);

  // Focus mobile search input when opened
  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      const timer = setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isMobileSearchOpen]);
  const noResultsTimerRef = useRef<number | null>(null);
  const companyNamesRef = useRef<Set<string>>(new Set());
  const querySearchText = sanitizeSearchText(searchText)
    .replace(/\s+/g, " ")
    .trim();
  const hasTypedInput = searchText.trim().length > 0;

  useEffect(() => {
    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(prev => prev?.id === currentUser?.id ? prev : currentUser);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(prev => prev?.id === currentUser?.id ? prev : currentUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHasChannel(false);
      setIsCompanyUser(false);
      return;
    }

    const checkUserChannel = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasChannel(true);
        } else {
          setHasChannel(false);
        }
      } catch {
        setHasChannel(false);
      }
    };

    const checkCompanyUser = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (data) {
          setIsCompanyUser(true);
        } else {
          setIsCompanyUser(false);
        }
      } catch {
        setIsCompanyUser(false);
      }
    };

    checkUserChannel(user.id);
    checkCompanyUser(user.id);
  }, [user]);



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
    const loadCompanyNames = async () => {
      const { data } = await supabase.from("companies").select("name");
      companyNamesRef.current = new Set((data ?? []).map((c) => c.name));
    };
    loadCompanyNames();
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

      const nextResults = ((data ?? []) as ChannelSearchItem[]).filter(
        (channel) => !companyNamesRef.current.has(channel.name)
      );

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
    setIsLoggingIn(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (error) {
      console.error("Login redirect failed:", error);
      setIsLoggingIn(false);
    }
  };


  const handleLogout = () => {
    // 강제로 Supabase 관련 로컬 스토리지 키 먼저 삭제
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }

    // 상태 바로 초기화
    setUser(null);

    // 로그아웃 API는 백그라운드에서 호출 (await 하지 않음 - 무한 대기 방지)
    supabase.auth.signOut().catch((error) => {
      console.error("Logout error:", error);
    });

    // 즉시 새로고침하여 홈으로
    if (window.location.pathname === "/") {
      window.location.reload();
    } else {
      window.location.href = "/";
    }
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

    // Log viewed channels locally for recommendation algorithm
    try {
      const viewedStr = window.localStorage.getItem("outduck-recent-viewed-channels");
      let viewed = viewedStr ? JSON.parse(viewedStr) : [];
      const existingIdx = viewed.findIndex((item: any) => item.id === channel.id);
      if (existingIdx > -1) {
        viewed[existingIdx].count += 1;
        viewed[existingIdx].timestamp = Date.now();
      } else {
        viewed.push({ id: channel.id, name: channel.name, count: 1, timestamp: Date.now() });
      }
      viewed.sort((a: any, b: any) => b.timestamp - a.timestamp);
      viewed = viewed.slice(0, 15);
      window.localStorage.setItem("outduck-recent-viewed-channels", JSON.stringify(viewed));
    } catch (e) {
      console.warn("Failed to record recent channel view:", e);
    }

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

    // Log searched keywords locally for recommendation algorithm
    try {
      const savedSearches = window.localStorage.getItem("outduck-recent-searches");
      let searchesList = savedSearches ? JSON.parse(savedSearches) : [];
      searchesList = [trimmedSearchText, ...searchesList.filter((s: string) => s !== trimmedSearchText)].slice(0, 5);
      window.localStorage.setItem("outduck-recent-searches", JSON.stringify(searchesList));
    } catch (e) {
      console.warn("Failed to record recent search:", e);
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
    <header className="border-b border-border bg-purple-50 dark:bg-purple-900/20 w-full">
      {/* Top bar: Logo and Login (Wrapper spans full width) */}
      <div className="border-b border-border/50">
        <div className="mx-auto max-w-7xl w-full flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr] px-3.5 md:px-4 py-2 md:py-3">
          <div
            className="flex items-center gap-2 md:gap-3 flex-shrink-0 justify-self-start"
          >
            {/* Hamburger Button (Mobile only) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-2 rounded-full hover:bg-muted text-slate-700 dark:text-slate-300 block md:hidden transition-colors cursor-pointer"
              aria-label="메뉴 열기"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div
              className="flex items-center gap-2 md:gap-3 cursor-pointer"
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
          </div>

          {/* Integrated Search Bar: Explicit fixed width overrides to force CSS Grid 'auto' expansion */}
          {pathname !== "/all-channels" ? (
            <div className="relative w-full md:w-[400px] lg:w-[550px] xl:w-[650px] max-w-lg md:max-w-2xl mx-3 md:mx-auto md:px-4 hidden md:block">
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
          ) : (
            /* all-channels: 검색창을 숨겨도 그리드 3열을 유지하기 위한 빈 가운데 칸 */
            <div className="hidden md:block" aria-hidden />
          )}

          <div className="flex-shrink-0 justify-self-end flex items-center gap-2.5 md:gap-3.5">

            {user ? (
              <div className="flex items-center gap-2 md:gap-3">
                {/* Mobile Search Toggle Button */}
                <button
                  onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                  className={cn(
                    "p-2 rounded-full hover:bg-muted transition-colors block md:hidden",
                    isMobileSearchOpen ? "bg-muted text-primary" : "text-slate-700 dark:text-slate-300"
                  )}
                  aria-label="검색창 열기"
                >
                  <Search className="w-5 h-5" />
                </button>

                {/* Notification Dropdown */}
                <DropdownMenu open={isNotifDropdownOpen} onOpenChange={handleDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
                      <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm border border-background">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" collisionPadding={16} className="w-[calc(100vw-32px)] sm:w-96 p-0 rounded-2xl shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                      <span className="font-bold text-sm">알림</span>
                      {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-extrabold">{unreadCount} 새 알림</span>}
                    </div>
                    <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                      {isNotificationsLoading ? (
                        <div className="flex justify-center items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                      ) : notifications.length === 0 ? (
                        <div className="text-center py-12">
                          <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">새로운 알림이 없습니다.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={cn(
                              "flex gap-3 px-4 py-3.5 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50 last:border-0",
                              !notif.is_read ? "bg-primary/5" : ""
                            )}
                          >
                            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", getNotificationColorClass(notif.type))}>
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className={cn("text-[13px] leading-snug break-keep", !notif.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                                {notif.message}
                              </p>
                              <p className="text-[11px] font-medium text-muted-foreground/80">
                                {getRelativeTime(notif.created_at)}
                              </p>
                            </div>
                            {!notif.is_read && (
                              <div className="flex shrink-0 items-center justify-center pl-1">
                                <span className="h-2 w-2 rounded-full bg-primary shadow-sm" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Profile Dropdown */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 md:h-11 md:w-11 border border-border cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarImage src={avatarUrl} alt={`${userName} 프로필`} />
                      <AvatarFallback>{avatarFallbackText}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer font-semibold">
                      마이페이지
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/suggest')} className="cursor-pointer font-semibold">
                      제보 / 제안하기
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-500/10">
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Mobile Search Toggle Button */}
                <button
                  onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                  className={cn(
                    "p-2 rounded-full hover:bg-muted transition-colors block md:hidden",
                    isMobileSearchOpen ? "bg-muted text-primary" : "text-slate-700 dark:text-slate-300"
                  )}
                  aria-label="검색창 열기"
                >
                  <Search className="w-5 h-5" />
                </button>

                <Button
                  variant="ghost"
                  className="text-xs md:text-sm font-medium"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  로그인
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar Row (Collapsible/Slide-down) */}
      <div className="bg-transparent px-3.5 block md:hidden">
        <div className="relative w-full max-w-lg mx-auto">
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isMobileSearchOpen
                ? "max-h-[60px] opacity-100 py-2 border-b border-border/50"
                : "max-h-0 opacity-0 py-0 border-b-0 pointer-events-none"
            )}
          >
            <div className="relative flex w-full items-center">
              <Search className="absolute left-4 h-[18px] w-[18px] text-muted-foreground" />
              <input
                ref={mobileSearchInputRef}
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
                className="h-10 w-full rounded-full border border-transparent bg-muted pl-11 pr-5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-foreground focus:bg-background focus:shadow-sm"
              />
            </div>
          </div>

          {isMobileSearchOpen && isSearchFocused && (
            <div className="absolute top-[48px] left-0 right-0 z-[100] w-full rounded-2xl border border-border bg-background p-2 shadow-xl">
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
      </div>

      {/* Navigation Container */}
      <div className="border-t border-border bg-background w-full relative hidden md:block">
        <div className="mx-auto max-w-7xl w-full relative flex items-center justify-center">
          {/* Main Scrollable Nav - Increased vertical padding for lux room, and bumped right guard to detach neighbor elements */}
          <nav className={cn(
            "flex items-center justify-around sm:justify-center gap-2 sm:gap-6 px-3.5 py-2.5 sm:py-3.5 w-full overflow-x-auto no-scrollbar sm:pr-0",
            !isCompanyUser ? "pr-28" : "pr-3.5"
          )}>
            <Link
              href="/"
              className={getNavStyle("/").button}
            >
              <House className={getNavStyle("/").icon} />
              <span className={getNavStyle("/").textClassName}>홈</span>
            </Link>
            <span className="text-border shrink-0 select-none">|</span>
            <Link
              href="/calendar"
              className={getNavStyle("/calendar").button}
            >
              <Calendar className={getNavStyle("/calendar").icon} />
              <span className={getNavStyle("/calendar").textClassName}>캘린더</span>
            </Link>
            <span className="text-border shrink-0 select-none">|</span>
            <Link
              href="/map"
              className={getNavStyle("/map").button}
            >
              <MapPinned className={getNavStyle("/map").icon} />
              <span className={getNavStyle("/map").textClassName}>지도</span>
            </Link>
            <span className="text-border shrink-0 select-none">|</span>
            <Link
              href="/subscriptions"
              className={getNavStyle("/subscriptions").button}
            >
              <Star className={getNavStyle("/subscriptions").icon} />
              <span className={getNavStyle("/subscriptions").textClassName}>팔로우 채널</span>
            </Link>
            <span className="text-border shrink-0 select-none">|</span>
            <Link
              href="/settings"
              className={getNavStyle("/settings").button}
            >
              <UserIcon className={getNavStyle("/settings").icon} />
              <span className={cn(getNavStyle("/settings").textClassName, "text-[12.5px] sm:text-[14.5px]")}>MY</span>
            </Link>
          </nav>

          {/* Floating Action Button: Pushed visibly inward to fully detach from edge and made slightly lusher */}
          {!isCompanyUser && (
            <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 z-10 flex items-center">
              <button
                onClick={() => router.push("/apply")}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
              >
                <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">주최자 계정 신청</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer (Menu Overlay) */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsDrawerOpen(false)}
      >
        <div
          className={cn(
            "fixed top-0 left-0 h-full w-[280px] sm:w-[320px] bg-background border-r border-border p-5 shadow-2xl flex flex-col transition-transform duration-300 ease-out",
            isDrawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header of Drawer */}
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <span className="font-extrabold text-lg text-primary">메뉴</span>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 flex flex-col py-6 overflow-y-auto no-scrollbar">
            {/* Top Section: Navigation Links */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">내 활동</h3>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/subscriptions"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:bg-muted transition-all"
                  >
                    <Star className="h-5 w-5 text-yellow-500 shrink-0" />
                    <span className="text-sm font-bold text-foreground">팔로우 채널</span>
                  </Link>
                  <Link
                    href="/bookmarks"
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 hover:bg-muted transition-all"
                  >
                    <Heart className="h-5 w-5 text-red-500 shrink-0" />
                    <span className="text-base font-bold text-foreground">찜한 행사</span>
                  </Link>
                </div>
              </div>

              {/* Bottom Section: Category Filter */}
              {onCategoryChange && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">필터</h3>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: "all", label: "전체" },
                      { id: "game", label: "게임" },
                      { id: "youtuber_vtuber", label: "유튜버 / 버튜버" },
                      { id: "festival", label: "행사" },
                      { id: "always", label: "상시 운영" }
                    ].map((cat) => {
                      const isActive = activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            onCategoryChange(cat.id);
                            setIsDrawerOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all cursor-pointer",
                            isActive
                              ? "bg-primary/10 border-primary text-primary font-extrabold shadow-sm"
                              : "bg-background border-border text-muted-foreground font-semibold hover:border-primary/50 hover:text-primary"
                          )}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </header>
  );
}

