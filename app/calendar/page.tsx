"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import Calendar from "react-calendar";
import type { User } from "@supabase/supabase-js";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackPerformance } from "@/lib/performance";
import { useQuery } from "@tanstack/react-query";
import { imageColors, formatEventDate, formatOnlineEventDate, extractChannels, getCategory } from "@/lib/event-format";

const categoryLabelMap: Record<string, string> = {
  game: "게임",
  youtuber: "유튜버",
  festival: "축제",
  vtuber: "버튜버",
};

type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: any;
  channels: { id: number; name: string; type: string; image_url: string }[];
  isAlways: boolean;
  createdAt: string;
  startDateValue: string | null;
  endDateValue: string | null;
  eventType: "offline" | "online";
  schedules?: any[];
};

const isEventOnDate = (event: any, targetDate: Date) => {
  if (!event.startDateValue) return false;
  
  const start = new Date(event.startDateValue);
  start.setHours(0, 0, 0, 0);
  const end = event.endDateValue ? new Date(event.endDateValue) : start;
  end.setHours(23, 59, 59, 999);

  const calDate = new Date(targetDate);
  calDate.setHours(12, 0, 0, 0);

  const isInRange = calDate >= start && calDate <= end;
  if (!isInRange) return false;

  if (event.schedules && event.schedules.length > 0) {
    const dayOfWeekMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayOfWeek = dayOfWeekMap[calDate.getDay()];
    const dateString = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, "0")}-${String(calDate.getDate()).padStart(2, "0")}`;

    return event.schedules.some((s: any) => {
      if (s.date && s.date === dateString) {
        return s.reservation_type !== "휴무";
      }
      if (!s.date && s.day_of_week?.toLowerCase() === dayOfWeek) {
        return s.reservation_type !== "휴무";
      }
      return false;
    });
  }
  
  return true;
};

// 캘린더 화면 상태(보던 월·선택 날짜·필터)를 메모리에 보관 → SPA 이동 후 돌아오면 그 화면으로 복원.
// 하드 리로드/콜드 스타트엔 사라져 오늘 날짜로 초기화된다.
let cachedCalendarView: { currentMonth: Date; selectedDate: Date; activeFilters: string[]; scrollY: number } | null = null;

function CalendarContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("event") ? Number(searchParams.get("event")) : null;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [focusEventId, setFocusEventId] = useState<number | null>(highlightId);
  const [activeFilters, setActiveFilters] = useState<string[]>(() => cachedCalendarView?.activeFilters ?? ["all"]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => cachedCalendarView?.selectedDate ?? new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => cachedCalendarView?.currentMonth ?? new Date());
  const [user, setUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await trackPerformance(
        "캘린더 페이지 세션 조회 (Client)",
        "auth",
        () => supabase.auth.getSession()
      );
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // 복원된 화면 상태가 있으면 기본 필터(subscribed)로 덮어쓰지 않는다.
    if (user && !cachedCalendarView) {
      setActiveFilters(["subscribed"]);
    }
  }, [user]);

  // 화면 상태(월/날짜/필터)를 메모리 캐시에 반영 (SPA 이동 후 복원용). 스크롤 위치는 별도 유지.
  useEffect(() => {
    cachedCalendarView = { currentMonth, selectedDate, activeFilters, scrollY: cachedCalendarView?.scrollY ?? 0 };
  }, [currentMonth, selectedDate, activeFilters]);

  // 스크롤 위치 저장/복원 — 일정 목록까지 내려본 뒤 다른 화면 갔다 와도 그 위치 유지.
  const scrollRestoredRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (!scrollRestoredRef.current) return; // 복원 중엔 저장하지 않음
      if (cachedCalendarView) cachedCalendarView.scrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const y = cachedCalendarView?.scrollY ?? 0;
    if (y <= 0) {
      scrollRestoredRef.current = true;
      return;
    }
    // 캐시된 데이터/레이아웃이 준비될 때까지 몇 프레임에 걸쳐 재시도
    let n = 0;
    const id = setInterval(() => {
      window.scrollTo(0, y);
      n += 1;
      if (n >= 8) {
        clearInterval(id);
        scrollRestoredRef.current = true;
      }
    }, 70);
    return () => {
      clearInterval(id);
      scrollRestoredRef.current = true;
    };
  }, []);

  // 월 단위로 이벤트 + (로그인 시) 북마크/팔로우를 조회. queryKey에 월을 넣어 월별로 캐시된다.
  // 다른 화면 갔다 돌아오면 같은 달은 재요청 없이 즉시 재사용.
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ["calendar-data", user?.id, `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`],
    queryFn: async () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDateLimit = new Date(year, month - 1, 20).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      const endDateLimit = new Date(year, month + 1, 10).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

      const offlineQuery = supabase
        .from("offline_events")
        .select(`
          id,
          event_id,
          title,
          start_date,
          end_date,
          image_url,
          reservation_type,
          created_at,
          events(
            event_channels(
              channels(id, name, type, image_url)
            ),
            event_schedules(date, day_of_week, reservation_type)
          ),
          offline_event_locations (location)
        `)
        .not("start_date", "is", null)
        .lte("start_date", endDateLimit)
        .or(`end_date.gte.${startDateLimit},end_date.is.null`);

      const onlineQuery = supabase
        .from("online_events")
        .select(`
          id,
          event_id,
          title,
          start_at,
          end_at,
          image_url,
          created_at,
          events(
            event_channels(
              channels(id, name, type, image_url)
            )
          )
        `)
        .not("start_at", "is", null)
        .lte("start_at", endDateLimit)
        .or(`end_at.gte.${startDateLimit},end_at.is.null`);

      const [{ data: offlineEventsData }, { data: onlineEventsData }] = await Promise.all([
        trackPerformance("캘린더 오프라인 행사 조회 (Client)", "client", () => offlineQuery),
        trackPerformance("캘린더 온라인 행사 조회 (Client)", "client", () => onlineQuery),
      ]);

      let bookmarkedIds: number[] = [];
      let subscribedChannelIds: number[] = [];

      if (user) {
        const [{ data: bookmarksData }, { data: favoritesData }] = await Promise.all([
          trackPerformance("캘린더 북마크 조회 (Client)", "client", () => supabase.from("event_bookmarks").select("event_id").eq("user_id", user.id)),
          trackPerformance("캘린더 팔로우 채널 조회 (Client)", "client", () => supabase.from("favorites").select("channel_id").eq("user_id", user.id)),
        ]);
        bookmarkedIds = (bookmarksData || []).map((b) => b.event_id).filter(Boolean) as number[];
        subscribedChannelIds = (favoritesData || []).map((f) => f.channel_id).filter(Boolean);
      }

      const formattedOffline: Event[] = (offlineEventsData || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        const schedules = (event.events as any)?.event_schedules || [];
        return {
          id: event.id,
          baseEventId: event.event_id,
          title: event.title,
          date: formatEventDate(event.start_date, event.end_date),
          location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
          category: getCategory(channels[0]?.type),
          imageColor: imageColors[index % imageColors.length],
          imageUrl: event.image_url ?? undefined,
          reservationType: event.reservation_type as any,
          channels: channels.map((c) => ({ id: c.id, name: c.name, type: c.type ?? "", image_url: c.image_url || "" })),
          isAlways: !event.start_date,
          createdAt: event.created_at,
          startDateValue: event.start_date,
          endDateValue: event.end_date,
          eventType: "offline",
          schedules,
        };
      });

      const formattedOnline: Event[] = (onlineEventsData || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        return {
          id: event.id,
          baseEventId: event.event_id,
          title: event.title,
          date: formatOnlineEventDate(event.start_at, event.end_at),
          location: "온라인",
          category: getCategory(channels[0]?.type),
          imageColor: imageColors[index % imageColors.length],
          imageUrl: event.image_url ?? undefined,
          reservationType: undefined,
          channels: channels.map((c) => ({ id: c.id, name: c.name, type: c.type ?? "", image_url: c.image_url || "" })),
          isAlways: !event.start_at,
          createdAt: event.created_at,
          startDateValue: event.start_at,
          endDateValue: event.end_at,
          eventType: "online",
        };
      });

      return {
        events: [...formattedOffline, ...formattedOnline],
        bookmarkedIds,
        subscribedChannelIds,
      };
    },
  });

  const events = calendarData?.events ?? [];
  const userBookmarkedEventIds = calendarData?.bookmarkedIds ?? [];
  const userSubscribedChannelIds = calendarData?.subscribedChannelIds ?? [];
  const loading = isLoading;

  // highlight 파라미터가 있으면 데이터 로드 후 해당 행사 날짜로 선택/이동 (1회성 부수효과)
  useEffect(() => {
    if (!highlightId || events.length === 0) return;
    const highlightEvent = events.find((e) => e.id === highlightId);
    if (highlightEvent && highlightEvent.startDateValue) {
      const targetDate = new Date(highlightEvent.startDateValue);
      setSelectedDate((prev) => (prev.getTime() !== targetDate.getTime() ? targetDate : prev));
      setCurrentMonth((prev) =>
        prev.getFullYear() !== targetDate.getFullYear() || prev.getMonth() !== targetDate.getMonth() ? targetDate : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, highlightId]);

  const toggleFilter = (id: string) => {
    setFocusEventId(null); // Clear special event focus when any filter is interacted with
    if (id === "all") {
      setActiveFilters(["all"]);
    } else {
      let next = activeFilters.includes(id)
        ? activeFilters.filter(f => f !== id)
        : [...activeFilters.filter(f => f !== "all"), id];

      // 상호 배타적인 필터 처리 (팔로우 채널 vs 찜한행사)
      if (!activeFilters.includes(id)) {
        if (id === "subscribed") next = next.filter(f => f !== "bookmarks");
        if (id === "bookmarks") next = next.filter(f => f !== "subscribed");
      }

      if (next.length === 0) next = ["all"];
      setActiveFilters(next);
    }
  };

  // 1. Memoize filteredEvents to avoid looping the entire database list on unrelated ticks/scrolls
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (focusEventId) {
        return event.id === focusEventId;
      }
      if (activeFilters.includes("all")) return true;

      const activeModes = activeFilters.filter(f => f === "online" || f === "offline");
      const activeCategories = activeFilters.filter(f => f === "game" || f === "youtuber" || f === "festival" || f === "vtuber");
      const activeInteractions = activeFilters.filter(f => f === "subscribed" || f === "bookmarks");

      const modeMatched = activeModes.length === 0 || activeModes.includes(event.eventType);
      const catMatched = activeCategories.length === 0 || activeCategories.some(f => categoryLabelMap[f] === event.category);
      let intMatched = true;

      if (activeInteractions.length > 0) {
        intMatched = activeInteractions.some(f => {
          if (f === "subscribed") return event.channels.some(c => userSubscribedChannelIds.includes(c.id));
          if (f === "bookmarks") return userBookmarkedEventIds.includes((event as any).baseEventId);
          return false;
        });
      }

      return modeMatched && catMatched && intMatched;
    });
  }, [events, focusEventId, activeFilters, userSubscribedChannelIds, userBookmarkedEventIds]);

  // 2. Cache selectedDate to reduce infinite 'new Date()' creation overhead in rendering loops
  const selectedDateMidnight = useMemo(() => {
    const calDate = new Date(selectedDate);
    calDate.setHours(12, 0, 0, 0);
    return calDate.getTime();
  }, [selectedDate]);

  // 3. Memoize daily filtered event items
  const eventsOnSelectedDate = useMemo(() => {
    return filteredEvents.filter((event: any) => {
      const calDate = new Date(selectedDateMidnight);
      calDate.setHours(12, 0, 0, 0);
      return isEventOnDate(event, calDate);
    });
  }, [filteredEvents, selectedDateMidnight]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center animate-pulse">
        <p className="text-muted-foreground text-sm font-medium">캘린더 초기화 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <main className="pb-12 mt-2 md:mt-6">
          <div className="flex flex-col gap-6">
            {/* Header / Banner */}
            <div className="mb-[-12px] md:mb-0">
              <h1 className="text-sm font-extrabold text-muted-foreground/90 tracking-wider md:text-2xl md:font-bold md:tracking-tight md:text-foreground">
                캘린더
              </h1>
            </div>

            {/* Filter Group */}
            {/* Inline Filter Area */}
            <div className="flex flex-col gap-3 animate-in fade-in duration-300">
              {/* Row 1: Quick filters | Modes */}
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                 <button
                   onClick={() => toggleFilter("all")}
                   className={cn(
                     "flex items-center justify-center w-auto px-3.5 py-1 md:w-[155px] md:px-0 md:py-3 text-[10px] md:text-[15px] font-bold md:font-extrabold rounded-full border-2 transition-all whitespace-nowrap shadow-sm",
                    activeFilters.includes("all")
                      ? "bg-slate-300 text-slate-950 border-slate-700"
                      : "bg-card border-slate-300 text-slate-600 hover:bg-muted/60"
                  )}
                >
                  전체
                </button>
                {user && [
                  { id: "subscribed", label: "팔로우 채널" },
                  { id: "bookmarks", label: "찜한 행사" },
                ].map((item) => (
                   <button
                     key={item.id}
                     onClick={() => toggleFilter(item.id)}
                     className={cn(
                       "flex items-center justify-center w-auto px-3.5 py-1 md:w-[155px] md:px-0 md:py-3 text-[10px] md:text-[15px] font-bold md:font-extrabold rounded-full border-2 transition-all whitespace-nowrap shadow-sm",
                      activeFilters.includes(item.id)
                        ? "bg-indigo-100 text-indigo-800 border-indigo-500"
                        : "bg-card border-slate-300 text-slate-600 hover:bg-muted/60"
                    )}
                  >
                    {item.label}
                  </button>
                ))}

                {/* Collapsible Toggle Button for Mobile */}
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 w-auto px-3.5 py-1 text-[10px] font-bold rounded-full border shadow-sm shrink-0 md:hidden whitespace-nowrap transition-all duration-300",
                    isFilterOpen
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                      : "border-slate-300 bg-card text-slate-600 hover:bg-muted/60"
                  )}
                >
                  <Filter className="w-3 h-3 stroke-[2.5]" />
                  <span>{isFilterOpen ? "필터 접기" : "필터 열기"}</span>
                </button>

                {/* Visual Separator Line */}
                <div className="h-5 w-[1.5px] bg-slate-300/80 dark:bg-slate-600/80 mx-2 shrink-0 hidden md:block" />

                <div className={cn("flex items-center gap-2 shrink-0", !isFilterOpen && "hidden md:flex")}>
                  {[
                    { id: "online", label: "온라인" },
                    { id: "offline", label: "오프라인" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleFilter(cat.id)}
                      className={cn(
                        "flex items-center justify-center w-auto px-3.5 py-1 md:w-[155px] md:px-0 md:py-3 text-[10px] md:text-[15px] font-bold md:font-extrabold rounded-full border-2 transition-all whitespace-nowrap shadow-sm",
                        activeFilters.includes(cat.id)
                          ? "bg-slate-300 text-slate-950 border-slate-700"
                          : "bg-card border-slate-300 text-slate-600 hover:bg-muted/60"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Genres */}
              <div className={cn("flex flex-wrap items-center gap-2 md:gap-3", !isFilterOpen && "hidden md:flex")}>
                {[
                  { id: "game", label: "게임", activeClass: "bg-blue-100 text-blue-800 border-blue-500 shadow-sm" },
                  { id: "youtuber", label: "유튜버", activeClass: "bg-red-100 text-red-800 border-red-500 shadow-sm" },
                  { id: "vtuber", label: "버튜버", activeClass: "bg-purple-100 text-purple-800 border-purple-500 shadow-sm" },
                  { id: "festival", label: "축제", activeClass: "bg-amber-100 text-amber-800 border-amber-500 shadow-sm" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleFilter(cat.id)}
                    className={cn(
                      "flex items-center justify-center w-auto px-3.5 py-1 md:w-[155px] md:px-0 md:py-3 text-[10px] md:text-[15px] font-bold md:font-extrabold rounded-full border-2 transition-all whitespace-nowrap shadow-sm",
                      activeFilters.includes(cat.id)
                        ? cat.activeClass
                        : "bg-card border-slate-300 text-slate-600 hover:bg-muted/60"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Focus Event Filter Pill */}
              {focusEventId && (
                <div className="flex items-center pt-1">
                  <button
                    onClick={() => setFocusEventId(null)}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 font-bold shadow-sm flex items-center gap-1.5 animate-in zoom-in-95 duration-200 whitespace-nowrap"
                  >
                    <span>선택된 행사만 보기</span>
                    <span className="bg-pink-500/20 px-1 rounded-md ml-0.5">✕</span>
                  </button>
                </div>
              )}
            </div>

            {/* Full Width Calendar Wrapper with New Styling */}
            <div className="bg-gradient-to-br from-[#dbeafe] to-[#f6e4ff] dark:from-primary/10 dark:to-primary/10 rounded-none md:rounded-[2rem] p-0 md:p-3.5 border-x-0 md:border border-primary/20 shadow-sm relative overflow-hidden mx-[-16px] md:mx-0">
              <div className="w-full bg-white/60 dark:bg-black/40 backdrop-blur-[2px] border-x-0 md:border border-white/40 dark:border-white/10 p-0 md:p-6 shadow-sm min-h-[460px] overflow-hidden rounded-none md:rounded-[1.75rem]">
                <Calendar
                next2Label={null}
                prev2Label={null}
                onChange={(value) => {
                  if (value instanceof Date) {
                    setSelectedDate(value);
                  }
                }}
                onClickDay={(value) => {
                  if (value.getMonth() !== currentMonth.getMonth() || value.getFullYear() !== currentMonth.getFullYear()) {
                    return; // Intercept month transitions from neighboring month day tiles
                  }
                  setSelectedDate(value);

                  const hasEvents = filteredEvents.some((event: any) => {
                    const calDate = new Date(value);
                    calDate.setHours(12, 0, 0, 0);
                    return isEventOnDate(event, calDate);
                  });

                  if (hasEvents) {
                    setTimeout(() => {
                      document.getElementById("events-list")?.scrollIntoView({ behavior: "smooth" });
                    }, 50);
                  }
                }}
                activeStartDate={currentMonth}
                onActiveStartDateChange={({ activeStartDate, action }) => {
                  if (action === "prev" || action === "next" || action === "prev2" || action === "next2") {
                    if (activeStartDate) setCurrentMonth(activeStartDate);
                  }
                }}
                value={selectedDate}
                locale="ko-KR"
                formatDay={(locale, date) => date.getDate().toString()}
                tileClassName={({ date, view }) => {
                  if (view === "month") {
                    const hasEvents = filteredEvents.some((event: any) => {
                      const calDate = new Date(date);
                      calDate.setHours(12, 0, 0, 0);
                      return isEventOnDate(event, calDate);
                    });

                    const isHighlightDate = filteredEvents.some((event: any) => {
                      if (event.id !== highlightId) return false;
                      const calDate = new Date(date);
                      calDate.setHours(12, 0, 0, 0);
                      return isEventOnDate(event, calDate);
                    });

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tileDate = new Date(date);
                    tileDate.setHours(0, 0, 0, 0);
                    const isPast = tileDate < today;

                    const classes = [];
                    if (hasEvents) classes.push("react-calendar__tile--hasEvent");
                    if (isHighlightDate) classes.push("react-calendar__tile--highlightEvent");
                    if (isPast) classes.push("react-calendar__tile--past");
                    return classes.join(" ");
                  }
                }}
                tileContent={({ date, view }) => {
                  if (view === "month") {
                    const dayEvents = filteredEvents.filter((event: any) => {
                      const calDate = new Date(date);
                      calDate.setHours(12, 0, 0, 0);
                      return isEventOnDate(event, calDate);
                    });

                    const channelsWithProfile: any[] = [];
                    const seenChannelIds = new Set();
                    dayEvents.forEach((event: any) => {
                      // focusEventId가 있을 때는 팔로우 필터 무시 — 모든 채널 표시
                      const filteredChannels = (!focusEventId && activeFilters.includes("subscribed"))
                        ? event.channels.filter((ch: any) => userSubscribedChannelIds.includes(ch.id))
                        : event.channels;

                      filteredChannels.forEach((ch: any) => {
                        if (ch && !seenChannelIds.has(ch.id)) {
                          seenChannelIds.add(ch.id);
                          channelsWithProfile.push(ch);
                        }
                      });
                    });

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tileDate = new Date(date);
                    tileDate.setHours(0, 0, 0, 0);
                    const isPast = tileDate < today;

                    if (channelsWithProfile.length > 0) {
                      const hasMore = channelsWithProfile.length >= 6;
                      const displayList = hasMore ? channelsWithProfile.slice(0, 5) : channelsWithProfile;
                      const extraCount = channelsWithProfile.length - 5;

                      return (
                        <div className={cn("grid grid-cols-3 gap-0.5 mt-1 justify-items-center items-center w-full px-1 transition-opacity duration-200", isPast && "opacity-40")}>
                          {displayList.map((ch, idx) => (
                            <div key={idx} className="w-7 h-7 rounded-full border border-background shadow-sm overflow-hidden flex-shrink-0 bg-muted">
                              {ch.image_url ? (
                                <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-indigo-400 text-xs flex items-center justify-center font-bold text-white">
                                  {ch.name.charAt(0)}
                                </div>
                              )}
                            </div>
                          ))}
                          {hasMore && (
                            <div className="w-7 h-7 rounded-full border border-border bg-white flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0 shadow-sm">
                              +{extraCount}
                            </div>
                          )}
                        </div>
                      );
                    }
                  }
                  return null;
                }}
              />
              </div>
            </div>

            {/* Events List Below Calendar */}
            <div id="events-list" className="flex flex-col gap-4 mt-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  {selectedDate.toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <span className="text-sm font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                  {eventsOnSelectedDate.length}개의 행사
                </span>
              </div>

              <div className="flex flex-col gap-3 min-h-[160px]">
                {loading ? (
                  <div className="flex items-center justify-center py-20 animate-pulse text-muted-foreground">
                    정보를 불러오는 중...
                  </div>
                ) : eventsOnSelectedDate.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/20 border border-dashed border-muted rounded-2xl">
                    <p className="font-semibold mb-1">이 날에 진행되는 행사가 없습니다.</p>
                    <p className="text-xs">다른 날짜를 클릭하거나 필터를 변경해보세요.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {eventsOnSelectedDate.map((event: any) => {
                      const isHighlighted = event.id === highlightId;
                      return (
                        <div
                          key={`${event.eventType}-${event.id}`}
                          className={cn(
                            "flex flex-col md:flex-row items-start md:items-center justify-start gap-y-2 md:gap-x-8 p-2 md:p-4 bg-card border border-border rounded-2xl hover:bg-muted/40 transition-all cursor-pointer relative",
                            isHighlighted && "ring-2 ring-pink-500 scale-[1.01] shadow-lg bg-pink-50/5 dark:bg-pink-950/10"
                          )}
                        >
                          {isHighlighted && (
                            <span className="absolute top-2 right-2 bg-pink-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full z-10">
                              선택됨
                            </span>
                          )}

                          {/* 1. 프로필 이미지 + 이름 */}
                          <div className="flex items-center gap-2.5 md:gap-4 w-full md:w-[220px] flex-shrink-0">
                            <div className="flex -space-x-2.5 md:-space-x-4 flex-shrink-0">
                              {/* focusEventId가 있을 때는 팔로우 필터 무시 */}
                              {((!focusEventId && activeFilters.includes("subscribed"))
                                ? event.channels.filter((ch: any) => userSubscribedChannelIds.includes(ch.id))
                                : event.channels
                              ).slice(0, 3).map((ch: any, idx: number) => (
                                <div key={idx} className="w-10 h-10 md:w-16 md:h-16 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0 shadow-sm">
                                  {ch.image_url ? (
                                    <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white font-bold text-xs md:text-lg">
                                      {ch.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm md:text-lg font-bold text-foreground truncate block">
                                {((!focusEventId && activeFilters.includes("subscribed"))
                                  ? event.channels.filter((ch: any) => userSubscribedChannelIds.includes(ch.id))
                                  : event.channels
                                ).map((c: any) => c.name).join(", ") || "일반"}
                              </span>
                            </div>
                          </div>

                          {/* 2. 행사 제목 + 날짜 */}
                          <div className="w-full md:w-[320px] flex-shrink-0 min-w-0 px-0 md:px-2">
                            <a href={event.eventType === "online" ? `/online-events/${event.id}` : `/events/${event.id}`} className="text-sm md:text-lg font-bold text-foreground hover:text-primary transition-all line-clamp-1 block">
                              {event.title}
                            </a>
                            <span className="text-[11px] md:text-sm font-medium text-muted-foreground block mt-0.5 md:mt-1.5">
                              {event.date}
                            </span>
                          </div>

                          {/* 3. 장소 */}
                          <div className="text-sm md:text-base font-medium text-muted-foreground truncate w-full md:w-auto">
                            {event.location}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .react-calendar {
          width: 100%;
          max-width: 100%;
          background: transparent;
          border: none;
          font-family: inherit;
          color: var(--foreground);
        }
        .react-calendar__navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .react-calendar__navigation button {
          color: var(--foreground);
          font-size: 1.25rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .react-calendar__navigation__arrow {
          background: var(--muted) !important;
          border: 1px solid var(--border) !important;
          font-size: 1.5rem !important;
          padding: 0 !important;
          border-radius: 14px !important;
          width: 48px !important;
          height: 48px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .react-calendar__navigation__arrow:hover {
          background: var(--border) !important;
        }
        .react-calendar__navigation__label {
          background: none !important;
          border: none !important;
          font-size: 1.25rem !important;
          pointer-events: none;
        }
        .react-calendar__navigation button:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .react-calendar__month-view__weekdays {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--muted-foreground);
          margin-bottom: 0 !important;
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }
        .react-calendar__month-view__weekdays__weekday {
          padding: 0.75rem 0.5rem !important;
          border-right: 1px solid var(--border) !important;
          border-bottom: 1px solid var(--border) !important;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none;
        }
        .react-calendar__month-view__days {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr);
          gap: 0 !important;
          border-left: 1px solid var(--border);
        }
        .react-calendar__tile {
          min-height: 58px;
          aspect-ratio: auto !important;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          border-radius: 0 !important;
          border-right: 1px solid var(--border) !important;
          border-bottom: 1px solid var(--border) !important;
          background: var(--card);
          color: var(--foreground);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          position: relative;
          padding: 4px 2px 2px 2px;
        }
        .react-calendar__tile abbr {
          margin-bottom: 4px;
          font-weight: 600;
          font-size: 1rem;
        }
        .react-calendar__tile:hover {
          background: var(--muted);
          border-color: var(--border);
        }
        .react-calendar__tile--now {
          background: var(--card) !important;
          font-weight: 700;
        }
        .react-calendar__tile--now abbr {
          background: var(--foreground);
          color: var(--background) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 28px !important;
          height: 28px !important;
          border-radius: 8px !important;
          margin-bottom: 2px;
          font-weight: 700;
        }
        .react-calendar__month-view__days__day:nth-child(7n-1).react-calendar__tile--now abbr {
          background: #3b82f6 !important;
          color: white !important;
        }
        .react-calendar__month-view__days__day:nth-child(7n).react-calendar__tile--now abbr {
          background: #ef4444 !important;
          color: white !important;
        }
        .react-calendar__tile--active {
          background: var(--muted) !important;
          font-weight: 700;
          box-shadow: inset 0 0 0 2.5px var(--foreground) !important;
        }
        .react-calendar__tile--past:not(.react-calendar__tile--active):not(.react-calendar__tile--now) abbr {
          opacity: 0.3;
        }
        .react-calendar [class*="neighboringMonth"],
        .react-calendar [class*="neighboringMonth"] * {
          color: var(--muted-foreground) !important;
          opacity: 0.25 !important;
        }
        .react-calendar__tile--highlightEvent {
          border: 2px solid #3b82f6 !important;
        }
        .react-calendar__month-view__weekdays__weekday:nth-child(6) abbr {
          color: #3b82f6 !important;
        }
        .react-calendar__month-view__weekdays__weekday:nth-child(7) abbr {
          color: #ef4444 !important;
        }
        .react-calendar__month-view__days__day:nth-child(7n-1):not([class*="neighboringMonth"]) {
          color: #3b82f6 !important;
        }
        .react-calendar__month-view__days__day:nth-child(7n):not([class*="neighboringMonth"]) {
          color: #ef4444 !important;
        }
        @media (min-width: 768px) {
          .react-calendar__tile {
            min-height: 140px;
            padding: 8px 4px 4px 4px;
          }
        }
        @media (max-width: 767px) {
          .react-calendar__tile {
            min-height: 58px !important;
            padding: 4px 2px 2px 2px !important;
          }
          .react-calendar__tile abbr {
            font-size: 0.8rem !important;
            margin-bottom: 2px !important;
          }
          .react-calendar__month-view__weekdays__weekday {
            padding: 0.5rem 0.25rem !important;
            font-size: 0.75rem !important;
          }
          .react-calendar__tile .grid {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            gap: 1px !important;
            margin-top: 1px !important;
            padding: 0 !important;
          }
          .react-calendar__tile .grid > div {
            width: 12px !important;
            height: 12px !important;
            border-width: 0.5px !important;
          }
          .react-calendar__tile .grid > div > img,
          .react-calendar__tile .grid > div > div {
            width: 100% !important;
            height: 100% !important;
            font-size: 6px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center animate-pulse">
        <p className="text-muted-foreground text-sm font-medium">로딩 중...</p>
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}
