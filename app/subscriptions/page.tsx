"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SortingFilterBar } from "@/components/sorting-filter-bar";
import { FavoriteChannels } from "@/components/favorite-channels";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { imageColors, formatEventDate, formatOnlineEventDate, extractChannels, getCategory, dedupeById } from "@/lib/event-format";

type SubTab = "followed" | "bookmarked";

// 화면 상태(탭·정렬·지난행사 펼침)를 메모리에 보관 → SPA 이동 후 복원, 콜드 스타트엔 초기화.
let cachedSubsView: { activeTab: SubTab; sortType: "recent" | "upcoming"; showPastEvents: boolean } | null = null;

// 정렬 헬퍼 (컴포넌트 밖에 두어 재생성 방지)
function sortEvents(list: any[], sortType: "recent" | "upcoming") {
  const result = [...list];
  if (sortType === "upcoming") {
    return result
      .filter((e) => !e.isAlways)
      .sort((a, b) => {
        if (!a.startDateValue || !b.startDateValue) return 0;
        return new Date(a.startDateValue).getTime() - new Date(b.startDateValue).getTime();
      });
  }
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<SubTab>(() => cachedSubsView?.activeTab ?? "followed");
  const [user, setUser] = useState<User | null>(null);
  const [sortType, setSortType] = useState<"recent" | "upcoming">(() => cachedSubsView?.sortType ?? "recent");
  const [showPastEvents, setShowPastEvents] = useState(() => cachedSubsView?.showPastEvents ?? true);

  // 딥링크(?tab=bookmarked)로 진입하면 해당 탭으로 연다. (마운트 후 1회 → hydration 안전)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "bookmarked") setActiveTab("bookmarked");
    else if (t === "followed") setActiveTab("followed");
  }, []);

  useEffect(() => {
    cachedSubsView = { activeTab, sortType, showPastEvents };
  }, [activeTab, sortType, showPastEvents]);

  // 탭 전환 시 URL(?tab=)도 동기화. 팔로우 탭은 파라미터 없이 깔끔한 주소, 찜 탭은 ?tab=bookmarked.
  // replaceState라 히스토리를 쌓지 않는다(뒤로가기 스택 안전).
  const changeTab = (t: SubTab) => {
    setActiveTab(t);
    if (typeof window !== "undefined") {
      const url = t === "bookmarked" ? `${window.location.pathname}?tab=bookmarked` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }
  };

  // 팔로우한 채널의 행사 (온·오프라인 합쳐서 반환) — in-memory 캐시.
  const { data: followedData, isPending: followedPending } = useQuery({
    queryKey: ["subscriptions-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: favs } = await supabase
        .from("favorites")
        .select("channel_id")
        .eq("user_id", user!.id);

      const channelIds = (favs || []).map((f) => f.channel_id).filter(Boolean);
      if (channelIds.length === 0) return [] as any[];

      const [{ data: offlineData }, { data: onlineData }] = await Promise.all([
        supabase
          .from("event_channels")
          .select(`
            events!inner(
              event_channels(
                channels(id, name, type, image_url)
              ),
              offline_events!inner(
                id, title, start_date, end_date,
                offline_event_locations(location),
                image_url, reservation_type, created_at
              )
            )
          `)
          .in("channel_id", channelIds),
        supabase
          .from("event_channels")
          .select(`
            events!inner(
              event_channels(
                channels(id, name, type, image_url)
              ),
              online_events!inner(
                id, title, start_at, end_at, image_url, created_at
              )
            )
          `)
          .in("channel_id", channelIds),
      ]);

      const offlineEvents = dedupeById(
        (offlineData as any[] | null || []).flatMap((item: any) => {
          const baseEv = item.events;
          const extracted = extractChannels(baseEv?.event_channels || []);
          return (baseEv?.offline_events || []).map((ev: any) => ({ ...ev, extractedChannels: extracted }));
        }),
      ).map((event: any, index: number) => ({
        id: event.id,
        title: event.title,
        date: formatEventDate(event.start_date, event.end_date),
        location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
        category: getCategory(event.extractedChannels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: event.reservation_type,
        channels: event.extractedChannels.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_date,
        createdAt: event.created_at,
        startDateValue: event.start_date,
        endDateValue: event.end_date,
        eventType: "offline" as const,
      }));

      const onlineEvents = dedupeById(
        (onlineData as any[] | null || []).flatMap((item: any) => {
          const baseEv = item.events;
          const extracted = extractChannels(baseEv?.event_channels || []);
          return (baseEv?.online_events || []).map((ev: any) => ({ ...ev, extractedChannels: extracted }));
        }),
      ).map((event: any, index: number) => ({
        id: event.id,
        title: event.title,
        date: formatOnlineEventDate(event.start_at, event.end_at),
        location: "온라인",
        category: getCategory(event.extractedChannels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: undefined,
        channels: event.extractedChannels.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_at,
        createdAt: event.created_at,
        startDateValue: event.start_at,
        endDateValue: event.end_at,
        eventType: "online" as const,
      }));

      return [...offlineEvents, ...onlineEvents];
    },
  });

  // 찜한 행사 (온·오프라인 합쳐서 반환) — in-memory 캐시.
  const { data: bookmarkedData, isPending: bookmarkedPending } = useQuery({
    queryKey: ["bookmarked-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: offlineBookmarks }, { data: onlineBookmarks }] = await Promise.all([
        supabase
          .from("event_bookmarks")
          .select(`
            created_at,
            events!inner(
              event_channels(
                channels(id, name, type, image_url)
              ),
              offline_events!inner(
                id, title, start_date, end_date,
                offline_event_locations(location),
                image_url, reservation_type, created_at
              )
            )
          `)
          .eq("user_id", user!.id),
        supabase
          .from("event_bookmarks")
          .select(`
            created_at,
            events!inner(
              event_channels(
                channels(id, name, type, image_url)
              ),
              online_events!inner(
                id, title, start_at, end_at, image_url, created_at
              )
            )
          `)
          .eq("user_id", user!.id),
      ]);

      const offlineEvents = (offlineBookmarks as any[] | null || []).flatMap((b: any, index: number) => {
        const baseEv = b.events;
        const extracted = extractChannels(baseEv?.event_channels || []);
        return (baseEv?.offline_events || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          date: formatEventDate(event.start_date, event.end_date),
          location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
          category: getCategory(extracted[0]?.type),
          imageColor: imageColors[index % imageColors.length],
          imageUrl: event.image_url,
          reservationType: event.reservation_type,
          channels: extracted.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
          isAlways: !event.start_date,
          createdAt: b.created_at,
          startDateValue: event.start_date,
          endDateValue: event.end_date,
          eventType: "offline" as const,
        }));
      });

      const onlineEvents = (onlineBookmarks as any[] | null || []).flatMap((b: any, index: number) => {
        const baseEv = b.events;
        const extracted = extractChannels(baseEv?.event_channels || []);
        return (baseEv?.online_events || []).map((event: any) => ({
          id: event.id,
          title: event.title,
          date: formatOnlineEventDate(event.start_at, event.end_at),
          location: "온라인",
          category: getCategory(extracted[0]?.type),
          imageColor: imageColors[index % imageColors.length],
          imageUrl: event.image_url,
          reservationType: undefined,
          channels: extracted.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
          isAlways: !event.start_at,
          createdAt: b.created_at,
          startDateValue: event.start_at,
          endDateValue: event.end_at,
          eventType: "online" as const,
        }));
      });

      return [...offlineEvents, ...onlineEvents];
    },
  });

  const currentEvents = (activeTab === "followed" ? followedData : bookmarkedData) ?? [];
  const loading = !!user && (activeTab === "followed" ? followedPending : bookmarkedPending);

  // "오늘" 기준 타임스탬프를 한 번만 계산
  const todayTimestamp = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }, []);

  const isPastEvent = useMemo(() => {
    return (endDateStr: string | null, startDateStr: string | null) => {
      if (!endDateStr && !startDateStr) return false;
      const dateStr = endDateStr || startDateStr;
      if (!dateStr) return false;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;

      const targetDate = new Date(date);
      targetDate.setHours(23, 59, 59, 999);

      return targetDate.getTime() < todayTimestamp;
    };
  }, [todayTimestamp]);

  const activeEvents = useMemo(
    () => currentEvents.filter((e: any) => !isPastEvent(e.endDateValue, e.startDateValue)),
    [currentEvents, isPastEvent],
  );
  const pastEvents = useMemo(
    () => currentEvents.filter((e: any) => isPastEvent(e.endDateValue, e.startDateValue)),
    [currentEvents, isPastEvent],
  );

  const displayedEvents = useMemo(() => sortEvents(activeEvents, sortType), [activeEvents, sortType]);
  const displayedPastEvents = useMemo(() => sortEvents(pastEvents, "recent"), [pastEvents]);

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser((prev) => (prev?.id === session?.user?.id ? prev : session?.user ?? null));
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((prev) => (prev?.id === session?.user?.id ? prev : session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login redirect failed:", error);
    }
  };

  const emptyText = activeTab === "followed" ? "팔로우한 채널의 행사가 없습니다." : "찜한 행사가 없습니다.";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-0 md:py-3">
        <main className="pb-8 pt-0 md:pt-4 md:pb-8">
          {!user && !loading && (
            <div className="text-center py-20 flex flex-col items-center justify-center border border-dashed border-muted rounded-xl bg-card">
              <p className="text-lg font-semibold text-muted-foreground mb-3">로그인이 필요합니다</p>
              <p className="text-sm text-muted-foreground mb-4">로그인하고 팔로우한 채널의 행사와 찜한 행사를 한눈에 모아보세요!</p>
              <button
                onClick={handleGoogleLogin}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
              >
                로그인 하러 가기
              </button>
            </div>
          )}

          {user && (
            <>
              {/* Favorite Channels section */}
              <FavoriteChannels user={user} />

              {/* Tabs: 팔로우 채널 행사 / 찜한 행사 */}
              <div className="flex w-full border-b border-border mt-1 md:mt-2 relative">
                <button
                  className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
                  onClick={() => changeTab("followed")}
                >
                  <span className={cn(
                    "transition-colors duration-200",
                    activeTab === "followed" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
                  )}>
                    팔로우 채널 행사
                  </span>
                </button>
                <button
                  className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
                  onClick={() => changeTab("bookmarked")}
                >
                  <span className={cn(
                    "transition-colors duration-200",
                    activeTab === "bookmarked" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
                  )}>
                    찜한 행사
                  </span>
                </button>

                {/* Sliding Underbar */}
                <div
                  className="absolute bottom-0 left-0 h-[3px] bg-[linear-gradient(to_right,#3b82f6_0%,#8b5cf6_60%,#ec4899_100%)] rounded-t-full transition-transform duration-300 ease-out"
                  style={{ width: "50%", transform: `translateX(${activeTab === "followed" ? 0 : 100}%)` }}
                />
              </div>

              {/* Sorting Filter */}
              <SortingFilterBar
                sortType={sortType}
                onSortChange={setSortType}
                recentLabel={activeTab === "bookmarked" ? "최근 저장" : "최근 등록"}
              />

              <div className="p-4 min-h-[600px]">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i} className="relative overflow-hidden animate-pulse pt-0">
                        <div className="aspect-[5/3] bg-muted-foreground/30 relative">
                          <div className="absolute top-2 left-2 w-16 h-6 bg-muted-foreground/30 rounded" />
                          <div className="absolute -bottom-6 left-8">
                            <div className="w-18 h-18 rounded-full border-2 border-black/60 bg-muted" />
                          </div>
                        </div>
                        <CardContent className="py-3 px-6">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div className="space-y-2 w-2/3">
                              <div className="h-7 bg-muted-foreground/30 rounded" />
                              <div className="h-7 bg-muted-foreground/30 rounded w-1/2" />
                            </div>
                            <div className="h-8 bg-muted-foreground/30 rounded w-1/4 mt-1" />
                          </div>
                          <div className="h-6 bg-muted-foreground/20 rounded w-1/2 mb-1" />
                          <div className="h-6 bg-muted-foreground/20 rounded w-1/3" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div key={`${activeTab}-${sortType}`}>
                    {displayedEvents.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                        {emptyText}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        {displayedEvents.map((event: any, index: number) => (
                          <EventCard
                            key={`${event.eventType}-${event.id}`}
                            id={event.id}
                            title={event.title}
                            date={event.date}
                            location={event.location}
                            category={event.category}
                            imageColor={event.imageColor}
                            imageUrl={event.imageUrl}
                            reservationType={event.reservationType}
                            channels={event.channels}
                            user={user}
                            eventType={event.eventType}
                            isRightCard={index % 2 === 1}
                          />
                        ))}
                      </div>
                    )}

                    {/* 지나간 행사(접기) — 찜한 행사 탭에서만 노출 */}
                    {activeTab === "bookmarked" && displayedPastEvents.length > 0 && (
                      <div className="mt-8 border-t border-border pt-6">
                        <button
                          onClick={() => setShowPastEvents(!showPastEvents)}
                          className="w-full py-3.5 px-5 bg-card hover:bg-slate-50 dark:hover:bg-muted/10 border border-border rounded-xl flex items-center justify-between transition-all group font-bold text-sm text-foreground shadow-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span>지나간 찜한 행사</span>
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                              {displayedPastEvents.length}
                            </span>
                          </span>
                          {showPastEvents ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          )}
                        </button>

                        {showPastEvents && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 animate-in fade-in slide-in-from-top-3 duration-250">
                            {displayedPastEvents.map((event: any, index: number) => (
                              <div key={`${event.eventType}-${event.id}`} className="opacity-70 saturate-50 hover:opacity-100 hover:saturate-100 transition-all duration-300">
                                <EventCard
                                  id={event.id}
                                  title={event.title}
                                  date={event.date}
                                  location={event.location}
                                  category={event.category}
                                  imageColor={event.imageColor}
                                  imageUrl={event.imageUrl}
                                  reservationType={event.reservationType}
                                  channels={event.channels}
                                  user={user}
                                  eventType={event.eventType}
                                  isRightCard={index % 2 === 1}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
