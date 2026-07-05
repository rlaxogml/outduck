"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { SortingFilterBar } from "@/components/sorting-filter-bar";
import { FavoriteChannels } from "@/components/favorite-channels";
import { EventTabs } from "@/components/event-tabs";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";
import { imageColors, formatEventDate, formatOnlineEventDate, extractChannels, getCategory, dedupeById } from "@/lib/event-format";

// 화면 상태(탭·정렬)를 메모리에 보관 → SPA 이동 후 복원, 콜드 스타트엔 초기화.
let cachedSubsView: { activeTab: "offline" | "online"; sortType: "recent" | "upcoming" } | null = null;

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<"offline" | "online">(() => cachedSubsView?.activeTab ?? "offline");
  const [user, setUser] = useState<User | null>(null);
  const [sortType, setSortType] = useState<"recent" | "upcoming">(() => cachedSubsView?.sortType ?? "recent");

  useEffect(() => {
    cachedSubsView = { activeTab, sortType };
  }, [activeTab, sortType]);

  // 팔로우한 채널의 행사 목록 — in-memory 캐시로 조회.
  // 다른 화면 갔다 돌아와도 재요청 없이 캐시를 즉시 재사용한다.
  const { data: subscribedEvents, isPending } = useQuery({
    queryKey: ["subscriptions-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // 1. 내가 팔로우한 채널 id
      const { data: favs } = await supabase
        .from("favorites")
        .select("channel_id")
        .eq("user_id", user!.id);

      const channelIds = (favs || []).map((f) => f.channel_id).filter(Boolean);
      if (channelIds.length === 0) {
        return { offlineEvents: [] as any[], onlineEvents: [] as any[] };
      }

      // 2. 해당 채널들의 오프라인/온라인 행사 병렬 조회
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
      }));

      return { offlineEvents, onlineEvents };
    },
  });

  const offlineEvents = subscribedEvents?.offlineEvents ?? [];
  const onlineEvents = subscribedEvents?.onlineEvents ?? [];
  const loading = !!user && isPending;

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

  const activeOfflineEvents = useMemo(() => offlineEvents.filter((e) => !isPastEvent(e.endDateValue, e.startDateValue)), [offlineEvents, isPastEvent]);
  const activeOnlineEvents = useMemo(() => onlineEvents.filter((e) => !isPastEvent(e.endDateValue, e.startDateValue)), [onlineEvents, isPastEvent]);

  const displayedOfflineEvents = useMemo(() => {
    const result = [...activeOfflineEvents];
    if (sortType === "upcoming") {
      return result
        .filter((e) => !e.isAlways)
        .sort((a, b) => {
          if (!a.startDateValue || !b.startDateValue) return 0;
          return new Date(a.startDateValue).getTime() - new Date(b.startDateValue).getTime();
        });
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeOfflineEvents, sortType]);

  const displayedOnlineEvents = useMemo(() => {
    const result = [...activeOnlineEvents];
    if (sortType === "upcoming") {
      return result
        .filter((e) => !e.isAlways)
        .sort((a, b) => {
          if (!a.startDateValue || !b.startDateValue) return 0;
          return new Date(a.startDateValue).getTime() - new Date(b.startDateValue).getTime();
        });
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeOnlineEvents, sortType]);

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-0 md:py-3">
        <main className="pb-8 pt-0 md:pt-4 md:pb-8">
          {!user && !loading && (
            <div className="text-center py-20 flex flex-col items-center justify-center border border-dashed border-muted rounded-xl bg-card">
              <p className="text-lg font-semibold text-muted-foreground mb-3">로그인이 필요합니다</p>
              <p className="text-sm text-muted-foreground mb-4">로그인하고 내가 팔로우한 채널들의 행사를 한눈에 모아보세요!</p>
            </div>
          )}

          {user && (
            <>
              {/* Favorite Channels section */}
              <FavoriteChannels user={user} />

              {/* Tabs */}
              <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />

              {/* Sorting Filter */}
              <SortingFilterBar sortType={sortType} onSortChange={setSortType} />

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
                    {activeTab === "offline" && (
                      <>
                        {displayedOfflineEvents.length === 0 ? (
                          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                            팔로우한 채널의 오프라인 행사가 없습니다.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            {displayedOfflineEvents.map((event, index) => (
                              <EventCard
                                key={event.id}
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
                                eventType="offline"
                                isRightCard={index % 2 === 1}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === "online" && (
                      <>
                        {displayedOnlineEvents.length === 0 ? (
                          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                            팔로우한 채널의 온라인 행사가 없습니다.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            {displayedOnlineEvents.map((event, index) => (
                              <EventCard
                                key={event.id}
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
                                eventType="online"
                                isRightCard={index % 2 === 1}
                              />
                            ))}
                          </div>
                        )}
                      </>
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
