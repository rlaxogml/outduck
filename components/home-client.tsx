"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { EventTabs } from "@/components/event-tabs";
import { CategoryFilter } from "@/components/category-filter";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { fetchMoreEvents } from "@/app/actions/events";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { PosterSlider } from "@/components/poster-slider";
import { OrganizerSection } from "@/components/organizer-section";
import { FavoriteChannels } from "@/components/favorite-channels";
import { MiniCalendar } from "@/components/mini-calendar";
import { GoogleAd } from "@/components/google-ad";
import { Building2, ArrowRight, UserCircle } from "lucide-react";

type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: "자유 입장" | "예약 필수" | "티켓팅" | "휴무" | undefined;
  channels: { id: number; name: string; image_url: string }[];
  isAlways: boolean;
  createdAt: string;
  startDateValue: string | null;
};

interface HomeClientProps {
  initialOfflineEvents: Event[];
  initialOnlineEvents: Event[];
  initialPosters?: any[];
}

export function HomeClient({ initialOfflineEvents, initialOnlineEvents, initialPosters = [] }: HomeClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortType, setSortType] = useState<"recent" | "upcoming">("recent");

  const [offlineEvents, setOfflineEvents] = useState<Event[]>(initialOfflineEvents);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>(initialOnlineEvents);
  const [user, setUser] = useState<User | null>(null);
  const [isCompanyUser, setIsCompanyUser] = useState(false);
  const [isHostUser, setIsHostUser] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, activeCategory, sortType]);

  useEffect(() => {
    console.log("HomeClient: Component mounted and session check starting...");
    let isMounted = true;

    const syncSession = async () => {
      try {
        console.log("HomeClient: Calling supabase.auth.getSession()...");
        const { data: { session } } = await supabase.auth.getSession();
        console.log("HomeClient: getSession resolved.", { hasSession: !!session });
        const currentUser = session?.user ?? null;
        if (isMounted) {
          setUser(prev => prev?.id === currentUser?.id ? prev : currentUser);
        }
      } catch (err) {
        console.error("HomeClient: syncSession failed:", err);
      }
    };
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("HomeClient: onAuthStateChange fired.", { event: _event, hasSession: !!session });
      const currentUser = session?.user ?? null;
      if (isMounted) {
        setUser(prev => prev?.id === currentUser?.id ? prev : currentUser);
      }
    });

    return () => {
      console.log("HomeClient: Cleaning up session synchronization useEffect.");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setIsCompanyUser(false);
      return;
    }

    let isMounted = true;
    const checkCompanyUser = async (userId: string) => {
      console.log("HomeClient: Checking if user is a company user:", userId);
      try {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        console.log("HomeClient: Company check complete. User has company account:", !!data);
        if (data && isMounted) {
          setIsCompanyUser(true);
        }
      } catch (err) {
        console.error("HomeClient: Company user check failed:", err);
      }
    };

    const checkHostUser = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("channels")
          .select("id")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle();

        if (data && isMounted) {
          setIsHostUser(true);
        }
      } catch (err) {
        console.error("HomeClient: Host user check failed:", err);
      }
    };

    checkCompanyUser(user.id);
    checkHostUser(user.id);

    return () => {
      isMounted = false;
    };
  }, [user]);

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
          festival: "축제",
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

  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreOffline, setHasMoreOffline] = useState(initialOfflineEvents.length === 30);
  const [hasMoreOnline, setHasMoreOnline] = useState(initialOnlineEvents.length === 30);

  // 4. Infinite Scroll Observer to seamlessly load additional events as the user scrolls
  useEffect(() => {
    // Determine if we can fetch more based on current tab
    const hasMore = activeTab === "offline" ? hasMoreOffline : hasMoreOnline;
    
    // visibleCount controls the smooth client-side reveal, we fetch when we get close to the end
    if (!hasMore && visibleCount >= filteredEvents.length) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore) {
          // If we reached the end of the client-side list, fetch more from server
          if (visibleCount >= filteredEvents.length && hasMore) {
            setIsFetchingMore(true);
            const currentLength = activeTab === "offline" ? offlineEvents.length : onlineEvents.length;
            
            const { data, error } = await fetchMoreEvents(activeTab, currentLength, 30);
            
            if (data && data.length > 0) {
              if (activeTab === "offline") {
                setOfflineEvents(prev => [...prev, ...data as any]);
                if (data.length < 30) setHasMoreOffline(false);
              } else {
                setOnlineEvents(prev => [...prev, ...data as any]);
                if (data.length < 30) setHasMoreOnline(false);
              }
            } else {
              if (activeTab === "offline") setHasMoreOffline(false);
              else setHasMoreOnline(false);
            }
            setIsFetchingMore(false);
          }
          
          // Reveal 10 more items smoothly
          setTimeout(() => {
            setVisibleCount((prev) => prev + 10);
          }, 150);
        }
      },
      { rootMargin: "250px" } 
    );

    const trigger = document.getElementById("infinite-scroll-trigger");
    if (trigger) {
      observer.observe(trigger);
    }

    return () => {
      if (trigger) {
        observer.unobserve(trigger);
      }
    };
  }, [visibleCount, filteredEvents.length, activeTab, isFetchingMore, hasMoreOffline, hasMoreOnline, offlineEvents.length, onlineEvents.length]);

  return (
    <div className="min-h-screen bg-background">
      {/* Left Google Ad */}
      <GoogleAd position="left" />

      {/* Right Google Ad */}
      <GoogleAd position="right" />

      <Header />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pt-0 pb-3 md:pt-0 md:pb-3">
        <main className="pb-8">
          {/* Poster Slider */}
          <section className="pt-2 pb-4 md:pt-3 md:pb-4">
            <PosterSlider initialPosters={initialPosters} />
          </section>

          {/* Company Owner Banner */}
          {isCompanyUser && (
            <div className="mb-6 p-4 md:p-5 bg-gradient-to-r from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500 text-white rounded-2xl shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm md:text-base font-extrabold text-foreground">회사 파트너십 관리 콘솔</h4>
                  <p className="text-xs text-muted-foreground font-medium">회사 계정으로 로그인하셨습니다.</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/company")}
                className="h-11 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shrink-0 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                콘솔 바로가기 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Host Owner Banner */}
          {isHostUser && (
            <div className="mb-6 p-4 md:p-5 bg-gradient-to-r from-indigo-500/15 to-purple-500/10 border border-indigo-500/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500 text-white rounded-2xl shrink-0">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm md:text-base font-extrabold text-foreground">주최자 관리 콘솔</h4>
                  <p className="text-xs text-muted-foreground font-medium">주최자 계정으로 로그인하셨습니다.</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/host")}
                className="h-11 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shrink-0 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                콘솔 바로가기 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Favorite Channels */}
          <FavoriteChannels user={user} />

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
          <section className="p-4 min-h-[650px]">
            <div
              key={`${activeTab}-${activeCategory}-${sortType}`}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
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
                <div className="text-center py-24 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                  해당 카테고리의 행사가 없습니다.
                </div>
              )}
            </div>

            {visibleCount < filteredEvents.length && (
              <div id="infinite-scroll-trigger" className="mt-8 mb-4 flex justify-center items-center py-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] md:text-xs text-muted-foreground font-semibold">행사를 더 불러오는 중...</span>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
