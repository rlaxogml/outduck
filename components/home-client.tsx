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
import { Building2, ArrowRight, UserCircle } from "lucide-react";
import { trackPerformance } from "@/lib/performance";

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
  endDateValue: string | null;
};

interface HomeClientProps {
  initialOfflineEvents: Event[];
  initialOnlineEvents: Event[];
  initialPosters?: any[];
}

export function HomeClient({
  initialOfflineEvents,
  initialOnlineEvents,
  initialPosters = [],
}: HomeClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortType, setSortType] = useState<"recent" | "upcoming">("upcoming");

  const [offlineEvents, setOfflineEvents] = useState<Event[]>(initialOfflineEvents);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>(initialOnlineEvents);
  const [user, setUser] = useState<User | null>(null);
  const [isCompanyUser, setIsCompanyUser] = useState(false);
  const [isHostUser, setIsHostUser] = useState(false);
  const [userBookmarks, setUserBookmarks] = useState<number[]>([]);
  const [userFavorites, setUserFavorites] = useState<any[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, activeCategory, sortType]);

  useEffect(() => {
    console.log("HomeClient: Component mounted and session check starting...");
    let isMounted = true;

    // 1. 즉시 로컬스토리지에서 로그인 세션 및 사용자 메타 복구 (0초 렌더링 최적화)
    try {
      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
      const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
      const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        const currentUser = parsed?.currentSession?.user;
        if (currentUser && isMounted) {
          setUser(currentUser);
          console.log("HomeClient: Restored cached user session from localStorage:", currentUser.id);
          
          // 사용자 메타데이터 캐시 복구
          const metaKey = `outduck-user-meta-${currentUser.id}`;
          const cachedMeta = localStorage.getItem(metaKey);
          if (cachedMeta) {
            const { isCompany, isHost, bookmarks, favorites } = JSON.parse(cachedMeta);
            if (isCompany !== undefined) setIsCompanyUser(isCompany);
            if (isHost !== undefined) setIsHostUser(isHost);
            if (Array.isArray(bookmarks)) setUserBookmarks(bookmarks);
            if (Array.isArray(favorites)) setUserFavorites(favorites);
            console.log("HomeClient: Restored cached user metadata from localStorage");
          }
        }
      }
    } catch (e) {
      console.warn("HomeClient: Failed to restore session cache:", e);
    }

    const syncSession = async () => {
      try {
        console.log("HomeClient: Calling supabase.auth.getSession()...");
        const { data: { session } } = await trackPerformance(
          "메인 페이지 세션 조회 (Client)",
          "auth",
          () => supabase.auth.getSession()
        );
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
      setIsHostUser(false);
      setUserBookmarks([]);
      setUserFavorites(null);
      return;
    }

    let isMounted = true;
    
    const loadUserData = async (userId: string) => {
      console.log("HomeClient: Initiating independent user data queries...");

      const updateMetaCache = (updates: any) => {
        try {
          const metaKey = `outduck-user-meta-${userId}`;
          const cached = localStorage.getItem(metaKey);
          const current = cached ? JSON.parse(cached) : {};
          const next = { ...current, ...updates };
          localStorage.setItem(metaKey, JSON.stringify(next));
        } catch (e) {
          console.warn("HomeClient: Failed to write to meta cache:", e);
        }
      };

      // 1. 회사 파트너 계정 확인
      trackPerformance(
        "회사 파트너 계정 확인 (Client)",
        "client",
        () => supabase.from("companies").select("id").eq("user_id", userId).maybeSingle()
      ).then(res => {
        if (isMounted) {
          const hasCompany = !!res.data;
          setIsCompanyUser(hasCompany);
          updateMetaCache({ isCompany: hasCompany });
        }
      }).catch(err => {
        console.error("HomeClient: Failed to check company status:", err);
      });

      // 2. 주최자 계정 확인
      trackPerformance(
        "주최자 계정 확인 (Client)",
        "client",
        () => supabase.from("channels").select("id").eq("owner_id", userId).limit(1).maybeSingle()
      ).then(res => {
        if (isMounted) {
          const hasHost = !!res.data;
          setIsHostUser(hasHost);
          updateMetaCache({ isHost: hasHost });
        }
      }).catch(err => {
        console.error("HomeClient: Failed to check host status:", err);
      });

      // 3. 미니 캘린더/관심채널 북마크 통합 조회
      trackPerformance(
        "미니 캘린더/관심채널 북마크 통합 조회 (Client)",
        "client",
        () => supabase.from("event_bookmarks").select("event_id").eq("user_id", userId)
      ).then(res => {
        if (isMounted && res.data) {
          const bms = res.data.map(d => d.event_id).filter(Boolean);
          setUserBookmarks(bms);
          updateMetaCache({ bookmarks: bms });
        }
      }).catch(err => {
        console.error("HomeClient: Failed to fetch bookmarks:", err);
      });

      // 4. 관심 채널 목록 통합 조회
      trackPerformance(
        "관심 채널 목록 통합 조회 (Client)",
        "client",
        async () => {
          try {
            // 1. RPC 호출 시도 (최적화 경로)
            const { data, error } = await supabase.rpc("get_favorite_channels_with_counts", { p_user_id: userId });
            if (!error && data) {
              // 원래의 favorites 테이블 형식과 호환되도록 매핑 (active_event_count 추가)
              return data.map((row: any) => ({
                channel_id: row.id,
                created_at: row.favorite_created_at,
                active_event_count: row.active_event_count,
                channels: {
                  id: row.id,
                  name: row.name,
                  type: row.type,
                  image_url: row.image_url,
                  team_id: row.team_id,
                  is_team: row.is_team
                }
              }));
            }
            if (error) {
              console.warn("HomeClient: RPC failed, falling back to query:", error.message);
            }
          } catch (e) {
            console.warn("HomeClient: RPC error, falling back to query:", e);
          }

          // 2. 원래 테이블 조회 폴백 (RPC가 없거나 실패한 경우)
          const { data, error } = await supabase.from("favorites")
            .select("channel_id, created_at, channels(id, name, type, image_url, team_id, is_team)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error) throw error;
          return data;
        }
      ).then(favs => {
        if (isMounted) {
          const finalFavs = favs || [];
          setUserFavorites(finalFavs);
          
          // Strip active_event_count before saving to meta cache to prevent showing stale counts on next load
          const favsForMetaCache = finalFavs.map((fav: any) => ({
            ...fav,
            active_event_count: undefined
          }));
          updateMetaCache({ favorites: favsForMetaCache });

          // 기존 관심채널 컴포넌트용 로컬스토리지 키도 동기화 (배지 숫자는 캐시하지 않음)
          try {
            const mappedForFavChannels = finalFavs.map((fav: any) => ({
              id: fav.channels?.id,
              name: fav.channels?.name || "기타",
              type: fav.channels?.type,
              image_url: fav.channels?.image_url || null,
              team_id: fav.channels?.team_id,
              is_team: fav.channels?.is_team || false,
              activeEventCount: undefined, // 배지 숫자는 캐시하지 않음
              favoriteCreatedAt: fav.created_at
            })).filter((c: any) => c.id !== undefined);
            
            localStorage.setItem(`outduck-favorites-${userId}`, JSON.stringify(mappedForFavChannels));
          } catch (e) {}
        }
      }).catch(err => {
        console.error("HomeClient: Failed to fetch favorites:", err);
        if (isMounted) {
          setUserFavorites(prev => prev || []); // 캐시된 값이 없을 때만 빈 배열로 스켈레톤 해제
        }
      });
    };

    loadUserData(user.id);

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
      const catMap: Record<string, string> = {
        game: "게임",
        youtuber: "유튜버",
        vtuber: "버튜버",
        festival: "축제",
      };
      result = result.filter(e => e.category === catMap[activeCategory]);
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
      // Upcoming sort: Ongoing first (sorted by earliest end date), then Future (sorted by earliest start date), then Always at the bottom.
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      const todayMs = new Date(today).getTime();

      const isOngoing = (ev: Event) => {
        if (ev.isAlways) return false;
        if (!ev.startDateValue) return false;
        
        const startOnly = ev.startDateValue.split("T")[0];
        const startMs = new Date(startOnly).getTime();
        if (startMs > todayMs) return false; // Starts in the future

        if (ev.endDateValue) {
          const endOnly = ev.endDateValue.split("T")[0];
          const endMs = new Date(endOnly).getTime();
          if (endMs < todayMs) return false; // Ended in the past
        }
        return true;
      };

      result = [...result].sort((a, b) => {
        if (a.isAlways && !b.isAlways) return 1;
        if (!a.isAlways && b.isAlways) return -1;
        if (a.isAlways && b.isAlways) return 0;

        const isOngoingA = isOngoing(a);
        const isOngoingB = isOngoing(b);

        if (isOngoingA && !isOngoingB) return -1;
        if (!isOngoingA && isOngoingB) return 1;

        if (isOngoingA && isOngoingB) {
          // Both ongoing: earliest end date first
          if (a.endDateValue && b.endDateValue) {
            const timeA = new Date(a.endDateValue.split("T")[0]).getTime();
            const timeB = new Date(b.endDateValue.split("T")[0]).getTime();
            if (timeA !== timeB) return timeA - timeB;
          } else if (a.endDateValue && !b.endDateValue) {
            return -1;
          } else if (!a.endDateValue && b.endDateValue) {
            return 1;
          }
          // Fallback to start date ascending
          const startA = a.startDateValue ? new Date(a.startDateValue.split("T")[0]).getTime() : 0;
          const startB = b.startDateValue ? new Date(b.startDateValue.split("T")[0]).getTime() : 0;
          return startA - startB;
        } else {
          // Both future: earliest start date first
          const startA = a.startDateValue ? new Date(a.startDateValue.split("T")[0]).getTime() : 0;
          const startB = b.startDateValue ? new Date(b.startDateValue.split("T")[0]).getTime() : 0;
          return startA - startB;
        }
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
      <Header />

      {/* Poster Slider */}
      <section className="max-w-7xl mx-auto px-4 mb-4 md:mb-6 pt-2 md:pt-2">
        <PosterSlider initialPosters={initialPosters} />
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pt-0 pb-3 md:pt-0 md:pb-3">
        <main className="pb-8">
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
          <FavoriteChannels
            user={user}
            initialFavorites={userFavorites}
          />

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
