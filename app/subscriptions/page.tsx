"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { FavoriteChannels } from "@/components/favorite-channels";
import { EventTabs } from "@/components/event-tabs";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineEvents, setOfflineEvents] = useState<any[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<any[]>([]);
  const [sortType, setSortType] = useState<"recent" | "upcoming">("recent");

  const isPastEvent = (endDateStr: string | null, startDateStr: string | null) => {
    if (!endDateStr && !startDateStr) return false;
    const dateStr = endDateStr || startDateStr;
    if (!dateStr) return false;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    return targetDate < today;
  };

  const activeOfflineEvents = offlineEvents.filter(e => !isPastEvent(e.endDateValue, e.startDateValue));
  const activeOnlineEvents = onlineEvents.filter(e => !isPastEvent(e.endDateValue, e.startDateValue));

  const sortEvents = (list: any[]) => {
    let result = [...list];
    if (sortType === "upcoming") {
      result = result.filter(e => !e.isAlways);
      return result.sort((a, b) => {
        if (!a.startDateValue || !b.startDateValue) return 0;
        return new Date(a.startDateValue).getTime() - new Date(b.startDateValue).getTime();
      });
    } else {
      return result.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
  };

  const displayedOfflineEvents = sortEvents(activeOfflineEvents);
  const displayedOnlineEvents = sortEvents(activeOnlineEvents);

  const imageColors = [
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
    "bg-gradient-to-br from-green-400 to-green-600",
    "bg-gradient-to-br from-orange-400 to-orange-600",
    "bg-gradient-to-br from-purple-400 to-purple-600",
    "bg-gradient-to-br from-red-400 to-red-600",
  ];

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
      if (!session?.user) {
        setLoading(false);
      }
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
      if (!session?.user) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchSubscribedEvents = async () => {
      try {
        setLoading(true);

        // 1. Fetch current user's favorite channels
        const { data: favs } = await supabase
          .from("favorites")
          .select("channel_id")
          .eq("user_id", user.id);

        const channelIds = (favs || []).map(f => f.channel_id).filter(Boolean);

        if (channelIds.length === 0) {
          setOfflineEvents([]);
          setOnlineEvents([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all offline events for these channels
        const { data: offlineData } = await supabase
          .from("event_channels")
          .select(`
            events!inner(
              event_channels(
                channels(
                  id,
                  name,
                  type,
                  image_url
                )
              ),
              offline_events!inner(
                id,
                title,
                start_date,
                end_date,
                offline_event_locations(
                  location
                ),
                image_url,
                reservation_type,
                created_at
              )
            )
          `)
          .in("channel_id", channelIds);

        // 3. Fetch all online events for these channels
        const { data: onlineData } = await supabase
          .from("event_channels")
          .select(`
            events!inner(
              event_channels(
                channels(
                  id,
                  name,
                  type,
                  image_url
                )
              ),
              online_events!inner(
                id,
                title,
                start_at,
                end_at,
                image_url,
                created_at
              )
            )
          `)
          .in("channel_id", channelIds);

        const formatEventDate = (start: string, end: string | null) => {
          return end
            ? `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`
            : start?.replaceAll("-", ".") ?? "상시";
        };

        const formatOnlineEventDate = (start: string | null, end: string | null) => {
          if (!start) return "상시";
          const formatDate = (dateStr: string) => {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "";
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${month}.${day}`;
          };

          const startFormatted = formatDate(start);
          if (!end) return startFormatted;
          const endFormatted = formatDate(end);
          return `${startFormatted} ~ ${endFormatted}`;
        };

        const extractChannels = (eventChannels: any[]) => {
          return (eventChannels || [])
            .map((ec: any) => ec.channels)
            .filter(Boolean) as { id: number; name: string; type: string; image_url: string }[];
        };

        const getCategory = (type?: string) => {
          if (!type) return "기타";
          const t = type.trim().toLowerCase();
          if (t === "game") return "게임";
          if (t === "youtuber") return "유튜버";
          if (t === "festival") return "축제";
          return "기타";
        };

        if (offlineData) {
          const raw = (offlineData as any[]).flatMap((item: any) => {
             const baseEv = item.events;
             const rawCh = baseEv?.event_channels || [];
             const extracted = extractChannels(rawCh);
             return (baseEv?.offline_events || []).map((ev: any) => ({
                ...ev,
                extractedChannels: extracted
             }));
          }).filter(Boolean);
 
          // Deduplicate
          const seenIds = new Set();
          const deduplicated: any[] = [];
          raw.forEach((event: any) => {
            if (event && !seenIds.has(event.id)) {
              seenIds.add(event.id);
              deduplicated.push(event);
            }
          });
 
          const formatted = deduplicated.map((event: any, index: number) => {
            return {
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
            };
          });
          setOfflineEvents(formatted);
        }

        if (onlineData) {
          const raw = (onlineData as any[]).flatMap((item: any) => {
             const baseEv = item.events;
             const rawCh = baseEv?.event_channels || [];
             const extracted = extractChannels(rawCh);
             return (baseEv?.online_events || []).map((ev: any) => ({
                ...ev,
                extractedChannels: extracted
             }));
          }).filter(Boolean);
 
          // Deduplicate
          const seenIds = new Set();
          const deduplicated: any[] = [];
          raw.forEach((event: any) => {
            if (event && !seenIds.has(event.id)) {
              seenIds.add(event.id);
              deduplicated.push(event);
            }
          });
 
          const formatted = deduplicated.map((event: any, index: number) => {
            return {
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
            };
          });
          setOnlineEvents(formatted);
        }
      } catch (error) {
        console.error("Failed to fetch subscribed events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscribedEvents();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <main className="pb-8 py-4">
          {!user && !loading && (
            <div className="text-center py-20 flex flex-col items-center justify-center border border-dashed border-muted rounded-xl bg-card">
              <p className="text-lg font-semibold text-muted-foreground mb-3">로그인이 필요합니다</p>
              <p className="text-sm text-muted-foreground mb-4">로그인하고 내가 구독한 채널들의 행사를 한눈에 모아보세요!</p>
            </div>
          )}

          {user && (
            <>
              {/* Favorite Channels section */}
              <FavoriteChannels user={user} />

              {/* Tabs */}
              <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />

              {/* Sorting Filter */}
              <div className="flex justify-end px-4 py-2 bg-background/50 backdrop-blur-sm sticky top-0 z-30 border-b border-border/40">
                <div className="relative flex items-center bg-muted/50 p-1 rounded-xl w-[180px] h-9 border border-border/30 select-none">
                  {/* Sliding pill background */}
                  <div
                    className={cn(
                      "absolute top-[4px] bottom-[4px] left-[4px] w-[calc(50%-4px)] bg-background rounded-lg shadow-sm border border-border/10 transition-transform duration-300 ease-out z-0",
                      sortType === "recent" ? "translate-x-0" : "translate-x-full"
                    )}
                  />
                  <button
                    className={cn(
                      "flex-1 text-center text-[12px] font-bold transition-colors duration-300 relative z-10 cursor-pointer",
                      sortType === "recent"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setSortType("recent")}
                  >
                    최근 등록
                  </button>
                  <button
                    className={cn(
                      "flex-1 text-center text-[12px] font-bold transition-colors duration-300 relative z-10 cursor-pointer",
                      sortType === "upcoming"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setSortType("upcoming")}
                  >
                    가까운 일정
                  </button>
                </div>
              </div>

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
                  <div
                    key={`${activeTab}-${sortType}`}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
                  >
                    {activeTab === "offline" && (
                      <>
                        {displayedOfflineEvents.length === 0 ? (
                          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                            구독한 채널의 오프라인 행사가 없습니다.
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
                            구독한 채널의 온라인 행사가 없습니다.
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
