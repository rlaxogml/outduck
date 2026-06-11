"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { trackPerformance } from "@/lib/performance";

interface WeeklyEvent {
  id: number;
  baseEventId?: number;
  title: string;
  startDateValue: string;
  endDateValue: string | null;
  eventType: "online" | "offline";
  dateStr: string;
  location?: string;
  channels: { id: number; name: string; image_url: string }[];
  schedules?: any[];
}

let cachedAllEvents: WeeklyEvent[] | null = null;
let cachedBookmarkedEventIds: number[] | null = null;
let cachedSubscribedChannelIds: number[] | null = null;

export function MiniCalendar({
  user,
  initialEvents = [],
  initialBookmarks = [],
  initialSubscribedChannelIds = [],
}: {
  user: User | null;
  initialEvents?: WeeklyEvent[];
  initialBookmarks?: number[];
  initialSubscribedChannelIds?: number[];
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<WeeklyEvent[]>(() => cachedAllEvents || initialEvents);
  const [bookmarkedEventIds, setBookmarkedEventIds] = useState<number[]>(() => cachedBookmarkedEventIds || initialBookmarks);
  const [subscribedChannelIds, setSubscribedChannelIds] = useState<number[]>(() => cachedSubscribedChannelIds || initialSubscribedChannelIds);
  const [activeFilter, setActiveFilter] = useState<"all" | "subscribed" | "bookmarked">("all");
  const [loading, setLoading] = useState(() => cachedAllEvents === null && initialEvents.length === 0);
  const [mounted, setMounted] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (user) {
      setActiveFilter("subscribed");
    } else {
      setActiveFilter("all");
    }
  }, [user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getWeekDates = (baseDate: Date) => {
    const dates = [];
    const day = baseDate.getDay(); // 0 = Sun
    
    if (day === 0) {
      // Special requirement: On Sunday, show coming Monday-Saturday first, and current Sunday last.
      for (let i = 1; i <= 6; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        dates.push(d);
      }
      dates.push(new Date(baseDate)); // Current Sunday at index 6
      return dates;
    }

    // Standard Monday-start logic for Monday to Saturday
    const diff = baseDate.getDate() - day + 1; 
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(diff + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentDate);
  // Safely find min/max bounds since Sunday special order is not sequential
  const sortedWeekDates = [...weekDates].sort((a, b) => a.getTime() - b.getTime());
  const weekStart = sortedWeekDates[0].toLocaleDateString("sv-SE");
  const weekEnd = sortedWeekDates[6].toLocaleDateString("sv-SE");

  const [initWeekStart] = useState(() => weekStart);
  const [initWeekEnd] = useState(() => weekEnd);

  useEffect(() => {
    setBookmarkedEventIds(initialBookmarks);
  }, [initialBookmarks]);

  useEffect(() => {
    setSubscribedChannelIds(initialSubscribedChannelIds);
  }, [initialSubscribedChannelIds]);

  useEffect(() => {
    // Skip fetching if we are on the initial week and initial pre-fetched events are provided
    const isInitialWeek = weekStart === initWeekStart && weekEnd === initWeekEnd;
    const skipFetch = isInitialWeek && initialEvents.length > 0;

    if (skipFetch) {
      console.log("MiniCalendar: Using initial pre-fetched weekly events, skipping DB call.");
      return;
    }

    console.log("MiniCalendar: Fetching weekly events from Supabase...", { weekStart, weekEnd, hasUser: !!user });
    let ignore = false;
    const safetyTimeout = setTimeout(() => {
      if (!ignore) {
        console.warn("MiniCalendar: Loading safety timeout reached (15s). Forcing loading to false.");
        setHasTimedOut(true);
        setLoading(false);
      }
    }, 15000);

    const fetchWeeklyEvents = async () => {
      try {
        setLoading(true);
        
        let bookmarkedEventIds: number[] = [];
        let subscribedChannelIds: number[] = [];

        if (user) {
          console.log("MiniCalendar: Fetching bookmarks and subscriptions for user:", user.id);
          const [{ data: bData }, { data: fData }] = await Promise.all([
            trackPerformance(
              "미니 캘린더 북마크 조회 (Client)",
              "client",
              () => supabase.from("event_bookmarks").select("event_id").eq("user_id", user.id)
            ),
            trackPerformance(
              "미니 캘린더 구독 채널 조회 (Client)",
              "client",
              () => supabase.from("favorites").select("channel_id").eq("user_id", user.id)
            ),
          ]);
          if (ignore) return;
          if (bData) {
            bookmarkedEventIds = bData.map(d => d.event_id).filter(Boolean);
          }
          if (fData) {
            subscribedChannelIds = fData.map(f => f.channel_id).filter(Boolean);
          }
          console.log("MiniCalendar: User subscriptions fetched.", {
            bookmarksCount: bookmarkedEventIds.length,
            subscriptionsCount: subscribedChannelIds.length
          });
        }

        console.log("MiniCalendar: Fetching offline and online events from weekStart to weekEnd...");
        const offlineQuery = supabase
          .from("offline_events")
          .select(`
            id, event_id, title, start_date, end_date,
            offline_event_locations(location),
            events(
              event_channels(channels(id, name, image_url)),
              event_schedules(date, day_of_week, reservation_type)
            )
          `)
          .lte("start_date", weekEnd)
          .gte("end_date", weekStart);

        const [offRes, onRes] = await Promise.all([
          trackPerformance(
            "미니 캘린더 오프라인 일정 조회 (Client)",
            "client",
            () => offlineQuery
          ),
          trackPerformance(
            "미니 캘린더 온라인 일정 조회 (Client)",
            "client",
            () => supabase
              .from("online_events")
              .select(`
                id, event_id, title, start_at, end_at,
                events(event_channels(channels(id, name, image_url)))
              `)
              .lte("start_at", weekEnd)
              .or(`end_at.gte.${weekStart},end_at.is.null`)
          )
        ]);

        if (ignore) return;

        const allRawOffline = offRes.data || [];
        const allRawOnline = onRes.data || [];
        console.log("MiniCalendar: Offline/Online events fetched.", {
          offlineCount: allRawOffline.length,
          onlineCount: allRawOnline.length
        });

        const formatOfflineEventDate = (start: string, end: string | null) => {
          return end
            ? `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`
            : start?.replaceAll("-", ".") ?? "상시";
        };

        const formatOnlineEventDate = (start: string | null, end: string | null) => {
          if (!start) return "상시";
          const parseDate = (dStr: string) => {
            const d = new Date(dStr);
            return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
          };
          return end ? `${parseDate(start)} ~ ${parseDate(end)}` : parseDate(start);
        };

        const formattedOffline: WeeklyEvent[] = allRawOffline.map((e: any) => ({
          id: e.id,
          baseEventId: e.event_id,
          title: e.title,
          startDateValue: e.start_date,
          endDateValue: e.end_date,
          eventType: "offline" as const,
          dateStr: formatOfflineEventDate(e.start_date, e.end_date),
          location: e.offline_event_locations?.[0]?.location || "장소 정보 없음",
          channels: e.events?.event_channels?.map((c: any) => c.channels).filter(Boolean) || [],
          schedules: e.events?.event_schedules || []
        }));

        const formattedOnline: WeeklyEvent[] = allRawOnline.map((e: any) => {
          const sDate = e.start_at ? new Date(e.start_at).toLocaleDateString("sv-SE") : null;
          const eDate = e.end_at ? new Date(e.end_at).toLocaleDateString("sv-SE") : null;
          return {
            id: e.id,
            baseEventId: e.event_id,
            title: e.title,
            startDateValue: sDate || "",
            endDateValue: eDate,
            eventType: "online" as const,
            dateStr: formatOnlineEventDate(e.start_at, e.end_at),
            location: "온라인",
            channels: e.events?.event_channels?.map((c: any) => c.channels).filter(Boolean) || []
          };
        }).filter(e => e.startDateValue !== "");

        const combined = [...formattedOffline, ...formattedOnline];

        if (!ignore) {
          cachedAllEvents = combined;
          cachedBookmarkedEventIds = bookmarkedEventIds;
          cachedSubscribedChannelIds = subscribedChannelIds;

          setAllEvents(combined);
          setBookmarkedEventIds(bookmarkedEventIds);
          setSubscribedChannelIds(subscribedChannelIds);
          setHasTimedOut(false);
        }
      } catch (error) {
        if (!ignore) console.error("MiniCalendar: Fail load mini cal:", error);
      } finally {
        if (!ignore) setLoading(false);
        clearTimeout(safetyTimeout);
        console.log("MiniCalendar: Fetch weekly events finished.");
      }
    };

    fetchWeeklyEvents();

    return () => {
      console.log("MiniCalendar: Cleaning up fetch weekly events useEffect.");
      ignore = true;
      clearTimeout(safetyTimeout);
    };
  }, [weekStart, weekEnd, user]);

  const filteredEvents = allEvents.filter(ev => {
    if (activeFilter === "all") return true;
    if (!user) return false;
    if (activeFilter === "bookmarked") {
      return ev.baseEventId && bookmarkedEventIds.includes(ev.baseEventId);
    }
    if (activeFilter === "subscribed") {
      return ev.channels.some(ch => subscribedChannelIds.includes(ch.id));
    }
    return true;
  });

  const getEventsForDate = (dateStr: string) => {
    return filteredEvents.filter(e => {
      const start = e.startDateValue;
      const end = e.endDateValue || start;
      const isInRange = dateStr >= start && dateStr <= end;
      if (!isInRange) return false;

      if (e.schedules && e.schedules.length > 0) {
        const targetDate = new Date(dateStr);
        const dayOfWeekMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const dayOfWeek = dayOfWeekMap[targetDate.getDay()];

        return e.schedules.some((s: any) => {
          if (s.date && s.date === dateStr) {
            return s.reservation_type !== "휴무";
          }
          if (!s.date && s.day_of_week?.toLowerCase() === dayOfWeek) {
            return s.reservation_type !== "휴무";
          }
          return false;
        });
      }

      return true;
    });
  };

  const changeWeek = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (offset * 7));
    setCurrentDate(d);
  };

  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
  const currentDayEvents = getEventsForDate(selectedDate || "");

  if (!mounted) {
    return (
      <div className="mt-4 mb-10 px-2 sm:px-4 mx-auto max-w-6xl animate-pulse">
        <div className="flex items-center gap-2 mb-3.5 ml-1">
          <div className="w-1.5 h-5 bg-muted-foreground/20 rounded-full" />
          <div className="h-5 bg-muted-foreground/20 rounded w-24" />
        </div>
        <div className="w-full h-32 rounded-xl bg-muted-foreground/10 border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  return (

    <div className="mt-4 mb-10 px-4 sm:px-4 mx-auto max-w-6xl">

        <div className="flex flex-row items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-primary rounded-full" />
            <h2 className="text-sm md:text-lg font-bold text-foreground whitespace-nowrap">
              이번 주 일정
            </h2>
            <Link 
              href="/calendar" 
              className="ml-1.5 hidden md:flex items-center gap-0.5 text-[11px] md:text-xs font-semibold text-muted-foreground hover:text-primary transition-all group bg-muted/40 hover:bg-primary/10 px-2 py-0.5 md:py-1 rounded-full border border-border/30 hover:border-primary/20"
            >
              전체보기
              <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "px-2.5 py-1 font-medium rounded-md transition-all whitespace-nowrap",
                activeFilter === "all" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              전체
            </button>
            <button
              onClick={() => setActiveFilter("subscribed")}
              className={cn(
                "px-2.5 py-1 font-medium rounded-md transition-all whitespace-nowrap",
                activeFilter === "subscribed" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground",
                !user && "opacity-50 cursor-not-allowed"
              )}
              disabled={!user}
            >
              구독
            </button>
            <button
              onClick={() => setActiveFilter("bookmarked")}
              className={cn(
                "px-2.5 py-1 font-medium rounded-md transition-all whitespace-nowrap",
                activeFilter === "bookmarked" 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground",
                !user && "opacity-50 cursor-not-allowed"
              )}
              disabled={!user}
            >
              찜한 행사
            </button>
          </div>
        </div>

        {/* Calendar Grid (Matching Full Calendar Style) */}
        <div className="w-[calc(100%+32px)] sm:w-full mx-[-16px] sm:mx-0 rounded-none sm:rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-gradient-to-br from-[#dbeafe]/50 to-[#f6e4ff]/50 dark:from-primary/10 dark:to-primary/10">
          <div className="grid grid-cols-7 text-center bg-white/20 dark:bg-slate-900/20">
            {dayNames.map((name, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "py-2 border-r border-b border-slate-300 dark:border-slate-700 text-sm sm:text-base font-bold",
                  idx === 5 ? "text-blue-500" : idx === 6 ? "text-red-500" : "text-muted-foreground"
                )}
              >
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weekDates.map((date, idx) => {
              const dateStr = date.toLocaleDateString("sv-SE");
              const todayStr = new Date().toLocaleDateString("sv-SE");
              const isSelected = selectedDate === dateStr;
              const isToday = todayStr === dateStr;
              const isPast = dateStr < todayStr;
              const dateEvents = getEventsForDate(dateStr);

              const seenChannelIds = new Set();
              const channelsWithProfile: any[] = [];
              dateEvents.forEach(ev => {
                ev.channels.forEach(ch => {
                  if (ch && !seenChannelIds.has(ch.id)) {
                    seenChannelIds.add(ch.id);
                    channelsWithProfile.push(ch);
                  }
                });
              });

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (selectedDate === dateStr) {
                      setSelectedDate(null);
                    } else {
                      setSelectedDate(dateStr);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-start min-h-[60px] sm:min-h-[110px] md:min-h-[150px] border-r border-b border-slate-300 dark:border-slate-700 cursor-pointer transition-all relative p-1",
                    isToday ? "bg-primary/10 z-10" : "bg-white/20 dark:bg-slate-900/20 backdrop-blur-[1px] hover:bg-white/40 dark:hover:bg-black/40",
                    isSelected && "ring-inset ring-2 ring-primary shadow-md z-20 bg-white dark:bg-slate-900",
                    isToday && !isSelected && "ring-inset ring-1 ring-primary/40"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold mt-1 w-6 h-6 flex items-center justify-center rounded-lg transition-opacity",
                    isToday ? "bg-primary text-white scale-110 shadow-sm" : "",
                    idx === 5 && !isToday ? "text-blue-500" : idx === 6 && !isToday ? "text-red-500" : "",
                    isPast && !isToday && "opacity-30"
                  )}>
                    {date.getDate()}
                  </span>

                  {/* Day Avatar Grid */}
                  {channelsWithProfile.length > 0 && (
                    <div className={cn("grid grid-cols-3 gap-0.5 mt-1.5 justify-items-center items-center w-full px-0.5 sm:px-1 transition-opacity", isPast && !isToday && "opacity-40")}>
                      {channelsWithProfile.slice(0, 5).map((ch, i) => (
                        <div key={i} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-background bg-muted overflow-hidden shadow-sm">
                          {ch.image_url ? (
                            <img src={ch.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-indigo-400 flex items-center justify-center text-[8px] font-bold text-white">
                              {ch.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                      {channelsWithProfile.length > 5 && (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-border bg-white flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                          +{channelsWithProfile.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Event List (Matching Calendar Page Style) */}
        {selectedDate && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 mt-6">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h3 className="text-base font-bold text-foreground">
                {new Date(selectedDate).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <span className="text-xs font-bold bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">
                {currentDayEvents.length}개의 행사
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[100px]">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-xs animate-pulse">로딩 중...</div>
              ) : currentDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 border border-dashed border-muted rounded-xl">
                  {hasTimedOut ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">일정 정보를 불러오는 중입니다...</p>
                      <p className="text-xs text-muted-foreground mt-1">연결이 원활하지 않아 시간이 다소 걸리고 있습니다. 잠시만 대기해주세요.</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold">이 날에 진행되는 일정이 없습니다.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {currentDayEvents.map((event) => (
                    <Link
                      key={`${event.eventType}-${event.id}`}
                      href={event.eventType === "online" ? `/online-events/${event.id}` : `/events/${event.id}`}
                      className="flex items-center justify-start gap-4 md:gap-x-8 p-3 md:p-4 bg-card border border-border rounded-xl md:rounded-2xl hover:bg-muted/40 transition-all cursor-pointer relative shadow-sm"
                    >
                      {/* 1. Channels Avatar Group + Names */}
                      <div className="flex items-center gap-3 w-[130px] sm:w-[180px] flex-shrink-0">
                        <div className="flex -space-x-3 flex-shrink-0">
                          {event.channels.slice(0, 2).map((ch, idx) => (
                            <div key={idx} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-background overflow-hidden bg-muted flex-shrink-0 shadow-sm">
                              {ch.image_url ? (
                                <img src={ch.image_url} alt={ch.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white font-bold text-xs">
                                  {ch.name.charAt(0)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="min-w-0 hidden sm:block">
                          <span className="text-sm font-bold text-foreground truncate block">
                            {event.channels.map(c => c.name).join(", ") || "일반"}
                          </span>
                        </div>
                      </div>

                      {/* 2. Event Title & Date */}
                      <div className="flex-1 min-w-0 px-1">
                        <h4 className="text-sm sm:text-lg font-bold text-foreground hover:text-primary transition-all line-clamp-1">
                          {event.title}
                        </h4>
                        <span className="text-[11px] sm:text-sm font-medium text-muted-foreground block mt-0.5 sm:mt-1">
                          {event.dateStr}
                        </span>
                      </div>

                      {/* 3. Location */}
                      <div className="flex-shrink-0 min-w-0 text-xs sm:text-base font-medium text-muted-foreground hidden sm:block truncate max-w-[180px]">
                        {event.location}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

    </div>

  );
}
