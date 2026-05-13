"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { EventTabs } from "@/components/event-tabs";
import { CategoryFilter } from "@/components/category-filter";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { PosterSlider } from "@/components/poster-slider";
import { OrganizerSection } from "@/components/organizer-section";
import { FavoriteChannels } from "@/components/favorite-channels";
import { MiniCalendar } from "@/components/mini-calendar";
import dynamic from "next/dynamic";

const GoogleAd = dynamic(() => import("@/components/google-ad").then(m => m.GoogleAd), { ssr: false });

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

interface HomeClientProps {
  initialOfflineEvents: Event[];
  initialOnlineEvents: Event[];
}

export function HomeClient({ initialOfflineEvents, initialOnlineEvents }: HomeClientProps) {
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortType, setSortType] = useState<"recent" | "upcoming">("recent");

  const [offlineEvents, setOfflineEvents] = useState<Event[]>(initialOfflineEvents);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>(initialOnlineEvents);
  const [user, setUser] = useState<User | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, activeCategory, sortType]);

  useEffect(() => {
    const syncSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
      } catch (err) {
        console.error(err);
      }
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));
    });

    return () => subscription.unsubscribe();
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
          festival: "동인 행사",
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

      <Header />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-3">
        <main className="pb-8">
          {/* Poster Slider */}
          <section className="py-4">
            <PosterSlider />
          </section>

          {/* Organizer Section */}
          <OrganizerSection user={user} />

          {/* Favorite Channels */}
          <FavoriteChannels />

          {/* Mini Calendar Section */}
          <MiniCalendar user={user} />

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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {filteredEvents.slice(0, visibleCount).map((event, index) => (
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
                  isRightCard={index % 2 === 1}
                  isPriority={index < 4}
                />
              ))}
            </div>

            {filteredEvents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                해당 카테고리의 행사가 없습니다.
              </div>
            )}

            {visibleCount < filteredEvents.length && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="px-6 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-full shadow-sm hover:bg-secondary/80 transition-colors"
                >
                  더보기 ({visibleCount} / {filteredEvents.length})
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
