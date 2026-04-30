"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { PosterSlider } from "@/components/poster-slider";
import { EventTabs } from "@/components/event-tabs";
import { CategoryFilter } from "@/components/category-filter";
import { EventCard } from "@/components/event-card";
import { GoogleAd } from "@/components/google-ad";
import { FavoriteChannels } from "@/components/favorite-channels";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: "자유입장" | "예약필수" | "예약우대" | "티켓팅" | undefined;
  channels: { id: number; name: string; image_url: string }[];
  isAlways: boolean;
  createdAt: string;
  startDateValue: string | null;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortType, setSortType] = useState<"recent" | "upcoming">("recent");

  const [offlineEvents, setOfflineEvents] = useState<Event[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

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
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const offlineQuery = supabase
          .from("offline_events")
          .select(`
            id,
            title,
            start_date,
            end_date,
            location,
            image_url,
            reservation_type,
            created_at,
            offline_event_channels(
              channels(
                id,
                name,
                type,
                image_url
              )
            )
          `)
          .order("start_date", { ascending: true });

        const onlineQuery = supabase
          .from("online_events")
          .select(`
            id,
            title,
            start_at,
            end_at,
            image_url,
            created_at,
            online_event_channels(
              channels(
                id,
                name,
                type,
                image_url
              )
            )
          `)
          .order("start_at", { ascending: true });

        const [{ data: offlineData }, { data: onlineData }] = await Promise.all([
          offlineQuery,
          onlineQuery,
        ]);

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
          const formatted = offlineData.map((event, index) => {
            const channels = extractChannels(event.offline_event_channels);
            return {
              id: event.id,
              title: event.title,
              date: formatEventDate(event.start_date, event.end_date),
              location: event.location,
              category: getCategory(channels[0]?.type),
              imageColor: imageColors[index % imageColors.length],
              imageUrl: event.image_url,
              reservationType: event.reservation_type as Event["reservationType"],
              channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
              isAlways: !event.start_date,
              createdAt: event.created_at,
              startDateValue: event.start_date,
            };
          });
          setOfflineEvents(formatted);
        }

        if (onlineData) {
          const formatted = onlineData.map((event, index) => {
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
        console.error("Failed to fetch events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = (() => {
    let result = activeTab === "offline" ? offlineEvents : onlineEvents;

    // 1. Category Filter
    if (activeCategory === "always") {
      result = result.filter(e => e.isAlways);
    } else if (activeCategory !== "all") {
      if (activeCategory === "youtuber") {
        result = result.filter(e => e.category === "유튜버" || e.category === "버튜버");
      } else {
        const catMap: Record<string, string> = {
          game: "게임",
        };
        result = result.filter(e => e.category === catMap[activeCategory]);
      }
    }

    // 2. Schedule Filter (Exclude "Always" from "Upcoming" unless specifically in "Always" category)
    if (sortType === "upcoming" && activeCategory !== "always") {
      result = result.filter(e => !e.isAlways);
    }

    // 3. Sorting
    if (sortType === "recent") {
      result = [...result].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      // Upcoming sort
      result = [...result].sort((a, b) => {
        if (a.isAlways && !b.isAlways) return 1;
        if (!a.isAlways && b.isAlways) return -1;
        if (!a.startDateValue || !b.startDateValue) return 0;
        return new Date(a.startDateValue).getTime() - new Date(b.startDateValue).getTime();
      });
    }

    return result;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Left Google Ad */}
      <GoogleAd position="left" />

      {/* Right Google Ad */}
      <GoogleAd position="right" />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-3">
        <Header />

        <main className="pb-8">
          {/* Poster Slider */}
          <section className="py-4">
            <PosterSlider />
          </section>

          {/* Favorite Channels */}
          <FavoriteChannels />

          {/* Tabs */}
          <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Category Filter */}
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            sortType={sortType}
            onSortChange={setSortType}
          />

          {/* Event Grid */}
          <section className="p-4">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                불러오는 중...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredEvents.map((event) => (
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
                    eventType={activeTab}
                  />
                ))}
              </div>
            )}

            {!loading && filteredEvents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                해당 카테고리의 행사가 없습니다.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
