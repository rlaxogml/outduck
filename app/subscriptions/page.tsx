"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { FavoriteChannels } from "@/components/favorite-channels";
import { EventTabs } from "@/components/event-tabs";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineEvents, setOfflineEvents] = useState<any[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<any[]>([]);

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
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      }
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
          .from("offline_event_channels")
          .select(`
            offline_events (
              id,
              title,
              start_date,
              end_date,
              location,
              image_url,
              reservation_type,
              created_at,
              offline_event_channels (
                channels (
                  id,
                  name,
                  type,
                  image_url
                )
              )
            )
          `)
          .in("channel_id", channelIds);

        // 3. Fetch all online events for these channels
        const { data: onlineData } = await supabase
          .from("online_event_channels")
          .select(`
            online_events (
              id,
              title,
              start_at,
              end_at,
              image_url,
              created_at,
              online_event_channels (
                channels (
                  id,
                  name,
                  type,
                  image_url
                )
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
          if (t === "vtuber") return "버튜버";
          if (t === "youtuber") return "유튜버";
          return "기타";
        };

        if (offlineData) {
          const raw = offlineData
            .map((b: any) => b.offline_events)
            .filter(Boolean);

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
            const channels = extractChannels(event.offline_event_channels);
            return {
              id: event.id,
              title: event.title,
              date: formatEventDate(event.start_date, event.end_date),
              location: event.location,
              category: getCategory(channels[0]?.type),
              imageColor: imageColors[index % imageColors.length],
              imageUrl: event.image_url,
              reservationType: event.reservation_type,
              channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
              isAlways: !event.start_date,
              createdAt: event.created_at,
              startDateValue: event.start_date,
            };
          });
          setOfflineEvents(formatted);
        }

        if (onlineData) {
          const raw = onlineData
            .map((b: any) => b.online_events)
            .filter(Boolean);

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
            const channels = extractChannels(event.online_event_channels);
            return {
              id: event.id,
              title: event.title,
              date: formatOnlineEventDate(event.start_at, event.end_at),
              location: "온라인",
              category: getCategory(channels[0]?.type),
              imageColor: imageColors[index % imageColors.length],
              imageUrl: event.image_url,
              reservationType: undefined,
              channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
              isAlways: !event.start_at,
              createdAt: event.created_at,
              startDateValue: event.start_at,
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
      <div className="mx-auto max-w-5xl px-4 py-3">
        <Header />

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
              <FavoriteChannels />

              {/* Tabs */}
              <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />

              <div className="p-4">
                {loading ? (
                  <div className="grid grid-cols-2 gap-4">
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
                  <>
                    {activeTab === "offline" && (
                      <>
                        {offlineEvents.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            구독한 채널의 오프라인 행사가 없습니다.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            {offlineEvents.map((event) => (
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
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === "online" && (
                      <>
                        {onlineEvents.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            구독한 채널의 온라인 행사가 없습니다.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            {onlineEvents.map((event) => (
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
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
