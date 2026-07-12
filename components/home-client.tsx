"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { EventTabs } from "@/components/event-tabs";
import { CategoryFilter } from "@/components/category-filter";
import { EventCard } from "@/components/event-card";
import { supabase } from "@/lib/supabase/client";
import { fetchMoreEvents, fetchLatestEvents } from "@/app/actions/events";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { PosterSlider } from "@/components/poster-slider";
import { OrganizerSection } from "@/components/organizer-section";
import { FavoriteChannels } from "@/components/favorite-channels";
import { Building2, ArrowRight, UserCircle } from "lucide-react";
import { trackPerformance } from "@/lib/performance";

type Event = {
  id: number;
  baseEventId?: number;
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
  eventType?: "offline" | "online";
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const HOME_SCROLL_STORAGE_KEY = "outduck-home-scroll-state";

// 홈에서 로딩한 이벤트 + 페이지네이션 상태를 메모리에 보관.
// SPA 이동엔 살아남아 돌아왔을 때 재요청·재페이지네이션 없이 즉시 복원되고,
// 하드 리로드/앱 콜드 스타트엔 모듈이 새로 로드되며 사라진다(= 그때만 새로 받음).
let cachedHomeState: {
  offline: Event[];
  online: Event[];
  freshOffline: Event[];
  freshOnline: Event[];
  visibleCount: number;
  hasMoreOffline: boolean;
  hasMoreOnline: boolean;
} | null = null;

// 신선도 머지 스로틀: 마지막 조회 후 이 시간(60초) 안이면 재조회하지 않는다.
// 모듈 변수라 SPA 이동에도 유지 → 홈을 자주 드나들어도 요청이 몰리지 않는다.
// 클라이언트 모듈 로드(≈최초 페이지 로드/하이드레이션) 시각으로 초기화해, SSR 직후 첫 진입엔 재조회를 건너뛴다.
const HOME_FRESHNESS_INTERVAL_MS = 60 * 1000;
let lastHomeFreshAt = typeof window !== "undefined" ? Date.now() : 0;


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
  const [activeTab, setActiveTab] = useState<"all" | "offline" | "online">("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortType, setSortType] = useState<"recommended" | "recent" | "upcoming">("recommended");

  const [offlineEvents, setOfflineEvents] = useState<Event[]>(() => cachedHomeState?.offline ?? initialOfflineEvents);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>(() => cachedHomeState?.online ?? initialOnlineEvents);

  // 신선도 머지로 발견한 "새로 등록된 행사" 오버레이. 페이지네이션(offlineEvents.length 기반)을
  // 건드리지 않도록 base 목록과 분리해 보관하고, 표시할 때만 dedup 병합한다.
  const [freshOffline, setFreshOffline] = useState<Event[]>(() => cachedHomeState?.freshOffline ?? []);
  const [freshOnline, setFreshOnline] = useState<Event[]>(() => cachedHomeState?.freshOnline ?? []);

  // 콜백에서 최신 base 목록을 stale closure 없이 참조하기 위한 ref.
  const offlineEventsRef = useRef(offlineEvents);
  offlineEventsRef.current = offlineEvents;
  const onlineEventsRef = useRef(onlineEvents);
  onlineEventsRef.current = onlineEvents;

  // 홈 재진입/포커스 시 최신 등록 행사를 조회해 base에 없는 것만 오버레이에 추가한다.
  // 기존 목록·순서·페이지네이션·셔플은 그대로 두고 "새 행사만" 끼워 넣어, 추천순이 흔들리지 않는다.
  const runFreshnessMerge = useCallback(async () => {
    if (Date.now() - lastHomeFreshAt < HOME_FRESHNESS_INTERVAL_MS) return;
    lastHomeFreshAt = Date.now();

    try {
      const { offline, online } = await fetchLatestEvents(40);

      if (offline) {
        setFreshOffline((prev) => {
          const baseIds = new Set(offlineEventsRef.current.map((e) => e.id));
          const kept = prev.filter((e) => !baseIds.has(e.id)); // base에 편입된 건 오버레이에서 제거
          const have = new Set(kept.map((e) => e.id));
          const added = offline.filter((e: Event) => !baseIds.has(e.id) && !have.has(e.id));
          if (added.length === 0 && kept.length === prev.length) return prev;
          return [...added, ...kept];
        });
      }

      if (online) {
        setFreshOnline((prev) => {
          const baseIds = new Set(onlineEventsRef.current.map((e) => e.id));
          const kept = prev.filter((e) => !baseIds.has(e.id));
          const have = new Set(kept.map((e) => e.id));
          const added = online.filter((e: Event) => !baseIds.has(e.id) && !have.has(e.id));
          if (added.length === 0 && kept.length === prev.length) return prev;
          return [...added, ...kept];
        });
      }
    } catch (e) {
      // 신선도 갱신 실패는 조용히 무시 (기존 목록 유지)
    }
  }, []);

  // 홈 진입(mount)·창 포커스·탭 복귀 시 신선도 머지 실행 (스로틀은 runFreshnessMerge 내부에서 처리).
  useEffect(() => {
    runFreshnessMerge();
    const onFocus = () => runFreshnessMerge();
    const onVisible = () => {
      if (document.visibilityState === "visible") runFreshnessMerge();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runFreshnessMerge]);

  // Synchronous state initialization from cached session and metadata to prevent hydration flickers and layout shifts
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
        const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
        const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          return parsed?.user ?? null;
        }
      } catch (e) {}
    }
    return null;
  });

  const [isCompanyUser, setIsCompanyUser] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
        const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
        const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          const currentUser = parsed?.user;
          if (currentUser) {
            const metaKey = `outduck-user-meta-${currentUser.id}`;
            const cachedMeta = localStorage.getItem(metaKey);
            if (cachedMeta) {
              const { isCompany } = JSON.parse(cachedMeta);
              return !!isCompany;
            }
          }
        }
      } catch (e) {}
    }
    return false;
  });

  const [isHostUser, setIsHostUser] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
        const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
        const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          const currentUser = parsed?.user;
          if (currentUser) {
            const metaKey = `outduck-user-meta-${currentUser.id}`;
            const cachedMeta = localStorage.getItem(metaKey);
            if (cachedMeta) {
              const { isHost } = JSON.parse(cachedMeta);
              return !!isHost;
            }
          }
        }
      } catch (e) {}
    }
    return false;
  });

  const [userBookmarks, setUserBookmarks] = useState<number[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
        const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
        const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          const currentUser = parsed?.user;
          if (currentUser) {
            const metaKey = `outduck-user-meta-${currentUser.id}`;
            const cachedMeta = localStorage.getItem(metaKey);
            if (cachedMeta) {
              const { bookmarks } = JSON.parse(cachedMeta);
              if (Array.isArray(bookmarks)) return bookmarks;
            }
          }
        }
      } catch (e) {}
    }
    return [];
  });

  const [userFavorites, setUserFavorites] = useState<any[] | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const projectId = projectUrl ? new URL(projectUrl).hostname.split('.')[0] : null;
        const sessionKey = projectId ? `sb-${projectId}-auth-token` : null;
        const sessionData = sessionKey ? localStorage.getItem(sessionKey) : null;
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          const currentUser = parsed?.user;
          if (currentUser) {
            const metaKey = `outduck-user-meta-${currentUser.id}`;
            const cachedMeta = localStorage.getItem(metaKey);
            if (cachedMeta) {
              const { favorites } = JSON.parse(cachedMeta);
              if (Array.isArray(favorites)) return favorites;
            }
          }
        }
      } catch (e) {}
    }
    return null;
  });

  const [visibleCount, setVisibleCount] = useState(() => cachedHomeState?.visibleCount ?? 10);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const [shuffleToken, setShuffleToken] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const token = sessionStorage.getItem("outduck-home-shuffle-token");
        if (token) return Number(token);
      } catch (e) {}
    }
    return Math.floor(Math.random() * 10000);
  });

  // Client-side initialization flag. Initialized to true on client-side routing transitions
  // to immediately render the recommendations without an intermediate chronological fallback screen.
  const [isMounted, setIsMounted] = useState(() => {
    if (typeof window !== "undefined") {
      return !!(window as any).__outduck_initialized;
    }
    return false;
  });
  const isFirstRender = useRef(true);
  const isFirstTabPersist = useRef(true);
  const isFirstSortPersist = useRef(true);

  // Regenerate the shuffle token on a hard reload / first load so the recommended order varies
  // per session, while staying stable across in-session client navigation.
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // One-time cleanup: the seen-decay recommendation system was removed, so drop its
        // now-unused localStorage keys left over in existing users' browsers.
        localStorage.removeItem("outduck-seen-decay-cache");
        localStorage.removeItem("outduck-last-visible-ids");

        // window.__outduck_initialized is only undefined on a hard reload or first page load.
        const isReload = !(window as any).__outduck_initialized;
        (window as any).__outduck_initialized = true;

        let token = sessionStorage.getItem("outduck-home-shuffle-token");
        if (!token || isReload) {
          token = String(Math.floor(Math.random() * 10000));
          sessionStorage.setItem("outduck-home-shuffle-token", token);
          setShuffleToken(Number(token));
        } else {
          setShuffleToken((prev) => {
            const numToken = Number(token);
            return prev === numToken ? prev : numToken;
          });
        }
      }
    } catch (e) {
      console.warn("HomeClient: Failed to initialize shuffle token:", e);
    } finally {
      setIsMounted(true);
    }
  }, []);

  // Reset visible count when the user changes tab/category/sort (show the filtered list from the top).
  // NOTE: The recommendation shuffle token is intentionally NOT regenerated here. The order only
  // changes on a new session or a hard refresh (handled by the mount effect above) — never on
  // client-side navigation, tab restore, or filter changes.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setVisibleCount(10);
  }, [activeTab, activeCategory, sortType]);

  // Restore the previously selected event tab after mount (avoids SSR hydration mismatch).
  // Uses sessionStorage so it survives in-session navigation/refresh but resets on a full
  // app cold start (close & reopen) back to the default "offline" tab.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("outduck-active-event-tab");
      if ((saved === "all" || saved === "offline" || saved === "online") && saved !== activeTab) {
        setActiveTab(saved);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selected event tab in sessionStorage so navigation/refresh keep the same tab,
  // while a full app cold start resets to the default (offline) tab.
  // Skip the very first run so it doesn't clobber the saved value before the restore effect applies it.
  useEffect(() => {
    if (isFirstTabPersist.current) {
      isFirstTabPersist.current = false;
      return;
    }
    try {
      sessionStorage.setItem("outduck-active-event-tab", activeTab);
    } catch (e) {}
  }, [activeTab]);

  // Restore the previously selected sort order after mount (avoids SSR hydration mismatch).
  // sessionStorage: survives in-session navigation/refresh, resets to "recommended" on cold start.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("outduck-home-sort-type");
      if ((saved === "recommended" || saved === "recent" || saved === "upcoming") && saved !== sortType) {
        setSortType(saved);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selected sort order in sessionStorage so navigation/refresh keep the same order,
  // while a full app cold start resets to the default (recommended) order.
  // Skip the very first run so it doesn't clobber the saved value before the restore effect applies it.
  useEffect(() => {
    if (isFirstSortPersist.current) {
      isFirstSortPersist.current = false;
      return;
    }
    try {
      sessionStorage.setItem("outduck-home-sort-type", sortType);
    } catch (e) {}
  }, [sortType]);

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
        const currentUser = parsed?.user;
        if (currentUser && isMounted && (!user || user.id !== currentUser.id)) {
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

      // 5. 선호 장르 동기화 (추천순 정렬에 반영되도록 localStorage로 캐싱)
      supabase
        .from("profiles")
        .select("favorite_topic")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!isMounted || !data) return;
          const topics = Array.isArray(data.favorite_topic) ? data.favorite_topic : [];
          try {
            localStorage.setItem("outduck-interests", JSON.stringify(topics));
          } catch (e) {}
        });
    };

    loadUserData(user.id);

    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredEvents = (() => {
    // "전체" 탭은 오프라인+온라인을 병합해 보여준다. 각 행사에 eventType을 태깅해
    // 카드가 온/오프라인 뱃지를 표시하고, id 충돌(오프/온라인 테이블 id가 겹칠 수 있음)에
    // 대비해 dedup은 eventType+id 복합키로 한다.
    let base: Event[];
    let fresh: Event[];
    if (activeTab === "all") {
      base = [
        ...offlineEvents.map((e) => ({ ...e, eventType: "offline" as const })),
        ...onlineEvents.map((e) => ({ ...e, eventType: "online" as const })),
      ];
      fresh = [
        ...freshOffline.map((e) => ({ ...e, eventType: "offline" as const })),
        ...freshOnline.map((e) => ({ ...e, eventType: "online" as const })),
      ];
    } else if (activeTab === "offline") {
      base = offlineEvents;
      fresh = freshOffline;
    } else {
      base = onlineEvents;
      fresh = freshOnline;
    }

    const uid = (e: Event) => (activeTab === "all" ? `${e.eventType}-${e.id}` : String(e.id));

    // 신선도 오버레이: base에 아직 없는 새 행사만 앞에 얹는다(dedup).
    // 이후 정렬(추천순=셔플)이 각 행사를 결정적 슬롯에 배치하므로 배열 순서는 표시에 영향 없음.
    let result: Event[];
    if (fresh.length > 0) {
      const baseIds = new Set(base.map(uid));
      const newOnes = fresh.filter((e) => !baseIds.has(uid(e)));
      result = newOnes.length > 0 ? [...newOnes, ...base] : base;
    } else {
      result = base;
    }

    // 1. Category Filter
    if (activeCategory === "always") {
      result = result.filter(e => e.isAlways);
    } else if (activeCategory === "youtuber_vtuber") {
      result = result.filter(e => e.category === "유튜버" || e.category === "버튜버");
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
    } else if (sortType === "recommended") {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      const todayMs = new Date(today).getTime();

      if (!isMounted) {
        // Fallback sorting during SSR and hydration to prevent Hydration Mismatch
        // We match exactly what "upcoming" sorting does.
        const isOngoing = (ev: Event) => {
          if (ev.isAlways) return false;
          if (!ev.startDateValue) return false;
          
          const startOnly = ev.startDateValue.split("T")[0];
          const startMs = new Date(startOnly).getTime();
          if (startMs > todayMs) return false;

          if (ev.endDateValue) {
            const endOnly = ev.endDateValue.split("T")[0];
            const endMs = new Date(endOnly).getTime();
            if (endMs < todayMs) return false;
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
            if (a.endDateValue && b.endDateValue) {
              const timeA = new Date(a.endDateValue.split("T")[0]).getTime();
              const timeB = new Date(b.endDateValue.split("T")[0]).getTime();
              if (timeA !== timeB) return timeA - timeB;
            } else if (a.endDateValue && !b.endDateValue) {
              return -1;
            } else if (!a.endDateValue && b.endDateValue) {
              return 1;
            }
            const startA = a.startDateValue ? new Date(a.startDateValue.split("T")[0]).getTime() : 0;
            const startB = b.startDateValue ? new Date(b.startDateValue.split("T")[0]).getTime() : 0;
            return startA - startB;
          } else {
            const startA = a.startDateValue ? new Date(a.startDateValue.split("T")[0]).getTime() : 0;
            const startB = b.startDateValue ? new Date(b.startDateValue.split("T")[0]).getTime() : 0;
            return startA - startB;
          }
        });
      } else {
        // PERSONAL RECOMMENDATION ALGORITHM ACTIVE CLIENT-SIDE ONLY AFTER HYDRATION
        // Read user interests dynamically from localStorage
        let userInterests: string[] = [];
        try {
          const storedInterests = localStorage.getItem("outduck-interests");
          if (storedInterests) {
            userInterests = JSON.parse(storedInterests);
          }
        } catch (e) {}

        // Read recently viewed channels from localStorage for click history bonus
        let recentViewed: { id: number; count: number }[] = [];
        try {
          const storedViewed = localStorage.getItem("outduck-recent-viewed-channels");
          if (storedViewed) {
            recentViewed = JSON.parse(storedViewed);
          }
        } catch (e) {}

        // Read recent searches from localStorage for search match bonus
        let recentSearches: string[] = [];
        try {
          const storedSearches = localStorage.getItem("outduck-recent-searches");
          if (storedSearches) {
            recentSearches = JSON.parse(storedSearches);
          }
        } catch (e) {}

        // Calculate keys and sort

        const scoredEvents = result.map((event) => {
          let score = 0;

          // A. Time / Schedule Urgency Score
          if (event.isAlways) {
            score += 5;
          } else if (event.startDateValue) {
            const eventStartOnly = event.startDateValue.split("T")[0];
            const eventStartMs = new Date(eventStartOnly).getTime();
            const diffDays = Math.ceil((eventStartMs - todayMs) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              score += 50; // Ongoing
            } else if (diffDays === 0) {
              score += 50; // Starts today
            } else if (diffDays === 1) {
              score += 40; // Starts tomorrow
            } else if (diffDays <= 3) {
              score += 30; // Within 3 days
            } else if (diffDays <= 7) {
              score += 10; // Within a week
            } else {
              score += 2; // Further away
            }
          } else {
            score += 5;
          }

          // B. Preference Score: Followed Channel (+50 points)
          const isFollowedChannel = event.channels?.some(ch => 
            userFavorites?.some(fav => fav.channel_id === ch.id)
          );
          if (isFollowedChannel) {
            score += 50;
          }

          // C. Preference Score: Interest Category (+30 points)
          const isInterestCategory = userInterests.includes(event.category) || 
            (event.category === "유튜버" && userInterests.includes("youtuber")) ||
            (event.category === "게임" && userInterests.includes("game")) ||
            (event.category === "버튜버" && userInterests.includes("vtuber")) ||
            (event.category === "축제" && userInterests.includes("festival"));

          if (isInterestCategory) {
            score += 30;
          }

          // D. View History Bonus (최근 자주 찾아본 채널 매칭: 최대 +30점)
          if (recentViewed.length > 0 && event.channels && event.channels.length > 0) {
            const matchedView = recentViewed.find(v => event.channels.some(ch => ch.id === v.id));
            if (matchedView) {
              score += Math.min(10 + matchedView.count * 2, 30);
            }
          }

          // E. Search Match Bonus (최근 검색어 키워드 매칭: 최대 +30점)
          if (recentSearches.length > 0) {
            const titleLower = event.title.toLowerCase();
            const catLower = event.category.toLowerCase();
            const locLower = (event.location || "").toLowerCase();
            
            const searchMatchCount = recentSearches.filter(keyword => {
              const kw = keyword.toLowerCase().trim();
              return kw.length > 1 && (titleLower.includes(kw) || catLower.includes(kw) || locLower.includes(kw));
            }).length;
            
            if (searchMatchCount > 0) {
              score += Math.min(searchMatchCount * 15, 30);
            }
          }

          score = Math.max(score, 1);

          // Weight conversion using Square Root Scaling (feeds the Efraimidis-Spirakis shuffle below)
          const weight = Math.sqrt(score);

          // F. Seeded Random Key (Efraimidis & Spirakis / Exponential Keys Trick)
          // seededRandom is in range [0, 1). Math.log(u) requires u in (0, 1].
          const u = seededRandom(event.id + shuffleToken) || 0.00001;
          const sortKey = Math.log(u) / weight;

          return { event, sortKey, score };
        });

        // Sort by key descending (closest to 0 is highest)
        scoredEvents.sort((a, b) => b.sortKey - a.sortKey);
        result = scoredEvents.map(se => se.event);
      }
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
  const [hasMoreOffline, setHasMoreOffline] = useState(() => cachedHomeState?.hasMoreOffline ?? (initialOfflineEvents.length === 30));
  const [hasMoreOnline, setHasMoreOnline] = useState(() => cachedHomeState?.hasMoreOnline ?? (initialOnlineEvents.length === 30));

  // 로딩된 이벤트/페이지네이션 상태를 메모리 캐시에 반영 (SPA 이동 후 복원용)
  useEffect(() => {
    cachedHomeState = {
      offline: offlineEvents,
      online: onlineEvents,
      freshOffline,
      freshOnline,
      visibleCount,
      hasMoreOffline,
      hasMoreOnline,
    };
  }, [offlineEvents, onlineEvents, freshOffline, freshOnline, visibleCount, hasMoreOffline, hasMoreOnline]);

  // 4. Infinite Scroll Observer to seamlessly load additional events as the user scrolls
  useEffect(() => {
    // Determine if we can fetch more based on current tab
    // "전체" 탭은 오프라인·온라인 중 하나라도 더 있으면 계속 불러온다.
    const hasMore = activeTab === "all"
      ? (hasMoreOffline || hasMoreOnline)
      : activeTab === "offline" ? hasMoreOffline : hasMoreOnline;

    // visibleCount controls the smooth client-side reveal, we fetch when we get close to the end
    if (!hasMore && visibleCount >= filteredEvents.length) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore) {
          // If we reached the end of the client-side list, fetch more from server
          if (visibleCount >= filteredEvents.length && hasMore) {
            setIsFetchingMore(true);

            if (activeTab === "all") {
              // 전체 탭: 남아있는 쪽(오프라인/온라인)을 병렬로 함께 페이징
              const tasks: Promise<{ type: "offline" | "online"; data: any[] | null }>[] = [];
              if (hasMoreOffline) {
                tasks.push(
                  fetchMoreEvents("offline", offlineEvents.length, 30).then(res => ({ type: "offline" as const, data: res.data }))
                );
              }
              if (hasMoreOnline) {
                tasks.push(
                  fetchMoreEvents("online", onlineEvents.length, 30).then(res => ({ type: "online" as const, data: res.data }))
                );
              }
              const results = await Promise.all(tasks);
              for (const r of results) {
                if (r.data && r.data.length > 0) {
                  if (r.type === "offline") {
                    setOfflineEvents(prev => [...prev, ...r.data as any]);
                    if (r.data.length < 30) setHasMoreOffline(false);
                  } else {
                    setOnlineEvents(prev => [...prev, ...r.data as any]);
                    if (r.data.length < 30) setHasMoreOnline(false);
                  }
                } else {
                  if (r.type === "offline") setHasMoreOffline(false);
                  else setHasMoreOnline(false);
                }
              }
            } else {
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

  // 5. Restore scroll position when coming back to this page.
  // Anchored to the tabs/filter bar (always present, right below the banners
  // and favorite-channels strip) instead of a raw page-top pixel offset, so
  // that async banners resizing above it don't throw the restored position off.
  const hasRestoredScrollRef = useRef(false);
  const isRestoringScrollRef = useRef(false);

  useEffect(() => {
    if (hasRestoredScrollRef.current) return;
    hasRestoredScrollRef.current = true;

    const raw = sessionStorage.getItem(HOME_SCROLL_STORAGE_KEY);
    if (!raw) return;

    let saved: {
      anchorDelta: number;
      visibleCount: number;
      activeTab: "all" | "offline" | "online";
      offlineCount: number;
      onlineCount: number;
    };
    try {
      saved = JSON.parse(raw);
    } catch {
      return;
    }

    // Was still above the tabs (inside the banner/favorite-channels zone) when
    // leaving. That content isn't reproducible - banners can appear, disappear,
    // or change size - so there's no meaningful position to restore into it.
    if (typeof saved.anchorDelta !== "number" || saved.anchorDelta <= 0) return;

    isRestoringScrollRef.current = true;

    const ensureLoaded = async (type: "offline" | "online", targetCount: number) => {
      let current = type === "offline" ? offlineEvents.length : onlineEvents.length;
      let more = type === "offline" ? hasMoreOffline : hasMoreOnline;
      while (current < targetCount && more) {
        const { data } = await fetchMoreEvents(type, current, 30);
        if (!data || data.length === 0) {
          if (type === "offline") setHasMoreOffline(false); else setHasMoreOnline(false);
          break;
        }
        if (type === "offline") {
          setOfflineEvents(prev => [...prev, ...data as any]);
        } else {
          setOnlineEvents(prev => [...prev, ...data as any]);
        }
        current += data.length;
        if (data.length < 30) {
          more = false;
          if (type === "offline") setHasMoreOffline(false); else setHasMoreOnline(false);
        }
      }
    };

    (async () => {
      if (saved.activeTab && saved.activeTab !== activeTab) {
        setActiveTab(saved.activeTab);
      }

      await Promise.all([
        ensureLoaded("offline", saved.offlineCount),
        ensureLoaded("online", saved.onlineCount),
      ]);

      setVisibleCount(prev => Math.max(prev, saved.visibleCount));

      let attempts = 0;
      const tryScroll = () => {
        attempts += 1;
        const anchorEl = scrollAnchorRef.current;
        if (anchorEl) {
          const targetY = anchorEl.getBoundingClientRect().top + window.scrollY + saved.anchorDelta;
          window.scrollTo(0, targetY);
        }
        const currentDelta = anchorEl ? -anchorEl.getBoundingClientRect().top : 0;
        const closeEnough = Math.abs(currentDelta - saved.anchorDelta) < 4;
        const reachedBottom = document.documentElement.scrollHeight - window.innerHeight <= window.scrollY;
        if (!closeEnough && !reachedBottom && attempts < 40) {
          // Keep retrying for a couple seconds: banners/images can keep shifting
          // the layout well after the initial paint, past a few animation frames.
          // Re-measuring the anchor live each time keeps this correct regardless.
          setTimeout(() => requestAnimationFrame(tryScroll), 50);
        } else {
          isRestoringScrollRef.current = false;
        }
      };
      requestAnimationFrame(tryScroll);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let ticking = false;
    const save = () => {
      ticking = false;
      if (isRestoringScrollRef.current) return;
      const anchorEl = scrollAnchorRef.current;
      if (!anchorEl) return;
      sessionStorage.setItem(HOME_SCROLL_STORAGE_KEY, JSON.stringify({
        anchorDelta: -anchorEl.getBoundingClientRect().top,
        visibleCount,
        activeTab,
        offlineCount: offlineEvents.length,
        onlineCount: onlineEvents.length,
      }));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(save);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleCount, activeTab, offlineEvents.length, onlineEvents.length]);

  return (
    <div className="min-h-screen bg-background">
      <Header activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {/* Poster Slider */}
      {initialPosters && initialPosters.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mb-1.5 md:mb-6 pt-1 md:pt-2">
          <PosterSlider initialPosters={initialPosters} />
        </section>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pt-0 pb-3 md:pt-0 md:pb-3">
        <main className="pb-8">
          {/* Company Owner Banner */}
          {isMounted && isCompanyUser && (
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
          {isMounted && isHostUser && (
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

          {/* Tabs - also serves as the scroll-restoration anchor point, since it's
              always rendered right after the banners/favorite-channels zone */}
          <div ref={scrollAnchorRef}>
            <EventTabs showAllTab activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Category Filter */}
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            sortType={sortType}
            onSortChange={setSortType}
          />

          {/* Event Grid */}
          <section className="p-4 min-h-[650px]">
            <div key={`${activeTab}-${activeCategory}-${sortType}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {filteredEvents.slice(0, visibleCount).map((event, index) => {
                  const cardType = activeTab === "all" ? (event.eventType ?? "offline") : activeTab;
                  return (
                    <EventCard
                      key={activeTab === "all" ? `${event.eventType}-${event.id}` : event.id}
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
                      eventType={cardType}
                      baseEventId={event.baseEventId}
                      bookmarkedIds={userBookmarks}
                      isRightCard={index % 2 === 1}
                      isPriority={index < 4}
                      showEventTypeBadge={activeTab === "all"}
                    />
                  );
                })}
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
