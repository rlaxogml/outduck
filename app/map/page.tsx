"use client";

import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase/client";
import { MapPin, Search, Filter, Gamepad2, Video, Tv, Check, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackPerformance, performanceTracker } from "@/lib/performance";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

declare global {
  interface Window {
    kakao: any;
  }
}

const createGroupMarkerCanvas = (count: number): string => {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 88;
  canvas.height = 98;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 1. Draw bottom arrow
  ctx.beginPath();
  ctx.moveTo(44, 98);
  ctx.lineTo(32, 76);
  ctx.lineTo(56, 76);
  ctx.closePath();
  ctx.fillStyle = "#FBBF24"; // Amber-400
  ctx.strokeStyle = "#D97706"; // Amber-600
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  // 2. Draw circle border
  ctx.beginPath();
  ctx.arc(44, 44, 40, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#FBBF24"; // Amber-400
  ctx.strokeStyle = "#D97706"; // Amber-600
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();

  // 3. Draw inner circle bg
  ctx.beginPath();
  ctx.arc(44, 44, 36, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#FEF3C7"; // Amber-100
  ctx.fill();

  // 4. Draw "+n" text
  ctx.fillStyle = "#B45309"; // Amber-700
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`+${count}`, 44, 44);

  try {
    return canvas.toDataURL();
  } catch {
    return "";
  }
};

export default function MapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MapContent />
    </Suspense>
  );
}

// 지도 필터(카테고리·상호작용·주 수)를 메모리에 보관 → SPA 이동 후 복원, 콜드 스타트엔 초기화.
// (이벤트/지도 초기화와 무관한 필터 상태만 다루므로 안전.)
let cachedMapFilters: {
  selectedCategories: string[];
  interactionFilter: "all" | "subscribed" | "bookmarks" | "ongoing" | "within_weeks";
  weeksThreshold: number;
} | null = null;

// 지도 이벤트(마커 캔버스 포함) + 유저 상태를 메모리에 보관 → 재방문 시 재조회·재생성 없이 즉시 복원.
// 단일 스냅샷(한 지도 분량)이라 계속 커지지 않고, 콜드 스타트(하드 리로드)에 초기화된다.
let cachedMapEvents: any[] | null = null;
let cachedMapUserIds: { bookmarked: number[]; subscribed: number[] } | null = null;

function MapContent() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");
  const [focusedEventId, setFocusedEventId] = useState<string | null>(initialEventId);

  // Disable pull-to-refresh gesture on mobile browsers
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. overscroll-behavior handles Android Chrome (ignored by iOS Safari)
    const originalBodyOverscroll = document.body.style.overscrollBehaviorY;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;

    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.overscrollBehaviorY = "none";

    // 2. iOS Safari doesn't support overscroll-behavior, so we must
    //    manually block the pull-to-refresh gesture via a non-passive
    //    touchmove listener. We allow the Kakao map to handle its own
    //    gestures, and let any genuinely scrollable inner area scroll.
    const preventPullToRefresh = (e: TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        e.preventDefault();
        return;
      }

      // Kakao map manages its own touch panning/zooming
      if (target.closest("#map-container")) return;

      // Allow real scroll containers (e.g. the filter list) to scroll
      let el: Element | null = target;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
          return;
        }
        el = el.parentElement;
      }

      e.preventDefault();
    };

    document.addEventListener("touchmove", preventPullToRefresh, { passive: false });

    return () => {
      document.body.style.overscrollBehaviorY = originalBodyOverscroll;
      document.documentElement.style.overscrollBehaviorY = originalHtmlOverscroll;
      document.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
  });
  const [events, setEvents] = useState<any[]>(() => cachedMapEvents ?? []);
  const [loading, setLoading] = useState(() => cachedMapEvents ? false : true);
  const [user, setUser] = useState<any>(null);
  const [userBookmarkedEventIds, setUserBookmarkedEventIds] = useState<number[]>(() => cachedMapUserIds?.bookmarked ?? []);
  const [userSubscribedChannelIds, setUserSubscribedChannelIds] = useState<number[]>(() => cachedMapUserIds?.subscribed ?? []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => cachedMapFilters?.selectedCategories ?? []);
  const [interactionFilter, setInteractionFilter] = useState<"all" | "subscribed" | "bookmarks" | "ongoing" | "within_weeks">(() => cachedMapFilters?.interactionFilter ?? "all");
  const [weeksThreshold, setWeeksThreshold] = useState<number>(() => cachedMapFilters?.weeksThreshold ?? 2);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [drawnMarkersCount, setDrawnMarkersCount] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);

  // 아웃덕 앱(WebView)에서만 내 위치 기능을 켠다. 일반 웹 브라우저에서는 동작하지 않음.
  // 앱 WebView는 커스텀 userAgent에 "OutduckApp"을 붙여 요청한다.
  const isApp = useMemo(
    () => typeof navigator !== "undefined" && /OutduckApp/i.test(navigator.userAgent),
    []
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // 필터 선택을 메모리 캐시에 동기화 (SPA 이동 후 복원용)
  useEffect(() => {
    cachedMapFilters = { selectedCategories, interactionFilter, weeksThreshold };
  }, [selectedCategories, interactionFilter, weeksThreshold]);

  // 유저 상태(북마크·구독)를 메모리 캐시에 동기화 → 재방문 시 필터 재계산 입력이 안 바뀌어 지도 초기화가 안정됨
  useEffect(() => {
    cachedMapUserIds = { bookmarked: userBookmarkedEventIds, subscribed: userSubscribedChannelIds };
  }, [userBookmarkedEventIds, userSubscribedChannelIds]);

  // 앱에서만: 현재 위치를 추적(watchPosition)한다.
  // - 지도 페이지에서만 동작하고, 벗어나면 clearWatch로 중단 → 배터리 절약
  // - enableHighAccuracy:false (WiFi/기지국 기반)로 배터리 부담 최소화
  // - 이동 시 점 갱신은 오버레이 ref로 직접 setPosition → 리렌더/지도 재초기화 없음
  useEffect(() => {
    if (!isApp) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    let watchId: number | null = null;

    const applyPosition = (pos: GeolocationPosition) => {
      if (cancelled) return;
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userLocationRef.current = loc;
      const overlay = userLocationOverlayRef.current;
      if (overlay && typeof window !== "undefined" && window.kakao) {
        // 이미 점이 있으면 위치만 갱신 (state 미변경 → 지도 재초기화 안 함)
        overlay.setPosition(new window.kakao.maps.LatLng(loc.lat, loc.lng));
      } else {
        // 최초 1회만 state 갱신 → 지도 effect가 점을 생성
        setUserLocation(loc);
      }
    };

    const startWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      watchId = navigator.geolocation.watchPosition(
        applyPosition,
        () => {
          // 권한 거부/실패 시 조용히 무시 (내 위치 마커만 생략)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
      );
    };

    startWatch();
    // 네이티브가 위치 권한을 방금 승인했을 때 추적을 새로 시작
    window.addEventListener("outduck:location-ready", startWatch);
    return () => {
      cancelled = true;
      window.removeEventListener("outduck:location-ready", startWatch);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isApp]);

  // 앱에서만: 기기 방향(나침반)을 받아 파란 점의 방향 콘을 회전시킨다.
  // - Android: deviceorientationabsolute의 alpha (heading = 360 - alpha)
  // - iOS: deviceorientation의 webkitCompassHeading (단, 사용자 제스처로 권한 요청 필요 → 추후)
  // 앱은 세로 고정이라 화면 회전 보정은 불필요. 방향 센서는 별도 권한이 없다.
  useEffect(() => {
    if (!isApp) return;
    if (typeof window === "undefined") return;

    const applyHeading = (rawHeading: number) => {
      const heading = ((rawHeading % 360) + 360) % 360;
      lastHeadingRef.current = heading;
      const beam = userLocationBeamRef.current;
      if (!beam) return;
      // 359°→1° 같은 경계에서 콘이 한 바퀴 도는 현상 방지: 최단 회전으로 누적
      const prev = headingRotationRef.current;
      const delta = (((heading - (prev % 360)) % 360) + 540) % 360 - 180;
      const next = prev + delta;
      headingRotationRef.current = next;
      beam.style.transform = `rotate(${next}deg)`;
      beam.style.opacity = "1";
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const anyE = e as any;
      let heading: number | null = null;
      if (typeof anyE.webkitCompassHeading === "number") {
        heading = anyE.webkitCompassHeading; // iOS: 이미 나침반 방향
      } else if (e.absolute && typeof e.alpha === "number") {
        heading = 360 - e.alpha; // Android(절대 방향)
      }
      if (heading == null || Number.isNaN(heading)) return;
      applyHeading(heading);
    };

    // Android는 deviceorientationabsolute, iOS는 deviceorientation을 사용.
    window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
    window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", handleOrientation as EventListener, true);
    };
  }, [isApp]);

  const mapRef = useRef<any>(null);
  const isMapInitialized = useRef(false);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const openOverlayRef = useRef<any>(null);
  const overlayRevealTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  // 내 위치 표시용 오버레이(파란 점)와 좌표 ref
  const userLocationOverlayRef = useRef<any>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // 방향(나침반) 표시용: 콘 DOM ref, 마지막 heading(0~360), 누적 회전값(360→0 경계 튐 방지)
  const userLocationBeamRef = useRef<HTMLElement | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const headingRotationRef = useRef<number>(0);

  const handleResetBounds = () => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.kakao || !markersRef.current || markersRef.current.length === 0) return;
    
    const kakao = window.kakao;
    const bounds = new kakao.maps.LatLngBounds();
    
    markersRef.current.forEach((marker: any) => {
      bounds.extend(marker.getPosition());
    });
    
    map.setBounds(bounds);
  };

  const cleanKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "").trim();

  // 1. Sync User Session and Fetch favorites & bookmarks
  useEffect(() => {
    const abortController = new AbortController();

    const syncSessionAndData = async () => {
      const { data: { session } } = await trackPerformance(
        "지도시각화 페이지 세션 조회 (Client)",
        "auth",
        () => supabase.auth.getSession()
      );
      const currentUser = session?.user ?? null;
      userIdRef.current = currentUser?.id ?? null;
      setUser(currentUser);

      if (currentUser) {
        // 복원된 필터가 있으면 기본값(팔로우 채널)으로 덮어쓰지 않는다.
        if (!cachedMapFilters) setInteractionFilter("subscribed");
        try {
          const [{ data: bookmarksData }, { data: favoritesData }] = await Promise.all([
            trackPerformance(
              "지도시각화 북마크 조회 (Client)",
              "client",
              () => supabase.from("event_bookmarks").select("event_id").eq("user_id", currentUser.id).abortSignal(abortController.signal)
            ),
            trackPerformance(
              "지도시각화 팔로우 채널 조회 (Client)",
              "client",
              () => supabase.from("favorites").select("channel_id").eq("user_id", currentUser.id).abortSignal(abortController.signal)
            ),
          ]);

          if (bookmarksData) {
            const newIds = bookmarksData.map(b => b.event_id).filter(Boolean);
            setUserBookmarkedEventIds(prev => JSON.stringify(prev) === JSON.stringify(newIds) ? prev : newIds);
          }
          if (favoritesData) {
            const newIds = favoritesData.map(f => f.channel_id).filter(Boolean);
            setUserSubscribedChannelIds(prev => JSON.stringify(prev) === JSON.stringify(newIds) ? prev : newIds);
          }
        } catch (error: any) {
          if (error.name !== "AbortError") console.error(error);
        }
      }
    };
    syncSessionAndData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      const newUserId = currentUser?.id ?? null;

      if (userIdRef.current === newUserId) {
        return;
      }

      userIdRef.current = newUserId;
      setUser(currentUser);

      if (currentUser) {
        try {
          const [{ data: bookmarksData }, { data: favoritesData }] = await Promise.all([
            supabase.from("event_bookmarks").select("event_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
            supabase.from("favorites").select("channel_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
          ]);

          if (bookmarksData) {
            const newIds = bookmarksData.map(b => b.event_id).filter(Boolean);
            setUserBookmarkedEventIds(prev => JSON.stringify(prev) === JSON.stringify(newIds) ? prev : newIds);
          }
          if (favoritesData) {
            const newIds = favoritesData.map(f => f.channel_id).filter(Boolean);
            setUserSubscribedChannelIds(prev => JSON.stringify(prev) === JSON.stringify(newIds) ? prev : newIds);
          }
        } catch (error: any) {
          if (error.name !== "AbortError") console.error(error);
        }
      } else {
        setUserBookmarkedEventIds([]);
        setUserSubscribedChannelIds([]);
      }
    });

    return () => {
      subscription.unsubscribe();
      abortController.abort();
    };
  }, []);

  // 1-1. Wait for global Kakao Map Script to load
  useEffect(() => {
    if (isScriptLoaded) return;
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && window.kakao && window.kakao.maps) {
        clearInterval(interval);
        setIsScriptLoaded(true);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isScriptLoaded]);

  // 2. Fetch events from Supabase and pre-generate marker base64 images
  useEffect(() => {
    // 캐시된 이벤트가 있으면 재조회·캔버스 재생성을 건너뛴다 (재방문 즉시 복원).
    if (cachedMapEvents) return;

    const abortController = new AbortController();

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        const { data, error } = await trackPerformance(
          "지도 오프라인 행사 정보 조회 (Client)",
          "client",
          () => supabase
            .from("offline_events")
            .select(`
              id,
              event_id,
              title,
              start_date,
              end_date,
              image_url,
              events(
                event_channels(
                  channels(
                    id,
                    name,
                    type,
                    image_url
                  )
                )
              ),
              offline_event_locations!inner(
                location,
                latitude,
                longitude
              )
            `)
            .or(`end_date.gte.${todayStr},end_date.is.null`)
            .abortSignal(abortController.signal)
        );

        if (error) throw error;

        if (data) {
          const formatted = data.map((item: any) => {
            const channels = (item.events as any)?.event_channels
              ?.map((ec: any) => ec.channels)
              .filter(Boolean) || [];
            const channel = channels[0];

            const formatEventDate = (start: string | null, end: string | null) => {
              if (!start) return "상시";
              const startPt = start.replaceAll("-", ".").split("T")[0];
              const endPt = end ? end.replaceAll("-", ".").split("T")[0] : null;
              if (startPt === endPt || !endPt) {
                const parts = startPt.split(".");
                if (parts.length === 3) {
                  const month = parseInt(parts[1], 10);
                  const day = parseInt(parts[2], 10);
                  return `${month}월 ${day}일`;
                }
                return startPt;
              }
              return `${startPt} - ${endPt}`;
            };

            return {
              id: item.id,
              baseEventId: item.event_id,
              title: item.title,
              date: formatEventDate(item.start_date, item.end_date),
              rawStartDate: item.start_date,
              location: item.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
              locationsList: item.offline_event_locations?.map((l: any) => ({
                location: l.location,
                latitude: l.latitude,
                longitude: l.longitude
              })).filter((l: any) => l.location) || [],
              channelName: channel?.name || "기타",
              channelImage: channel?.image_url || null,
              channelType: channel?.type || null,
              channels,
            };
          });

          const eventsWithMarkerImages = await trackPerformance(
            "지도 마커 이미지(캔버스) 생성 작업 (Client)",
            "client",
            async () => {
              return await Promise.all(
                formatted.map(async (ev: any) => {
                  const canvasDataUrl = await new Promise<string>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    if (ev.channelImage) {
                      img.src = `/api/proxy-image?url=${encodeURIComponent(ev.channelImage)}`;
                    } else {
                      img.src = "https://via.placeholder.com/150";
                    }

                    const fallbackSvg = `
                      <svg xmlns="http://www.w3.org/2000/svg" width="68" height="76" viewBox="0 0 68 76">
                        <polygon points="34,76 24,56 44,56" fill="#FBBF24" stroke="#D97706" stroke-width="2.5" />
                        <circle cx="34" cy="34" r="30" fill="#FBBF24" stroke="#D97706" stroke-width="3" />
                        <circle cx="34" cy="34" r="26" fill="#FEF3C7" />
                        <text x="34" y="41" font-family="sans-serif" font-size="22" font-weight="bold" fill="#B45309" text-anchor="middle">
                          ${ev.channelName.slice(0, 1)}
                        </text>
                      </svg>
                    `;

                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      canvas.width = 88;
                      canvas.height = 98;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) {
                        resolve("data:image/svg+xml;charset=UTF-8," + encodeURIComponent(fallbackSvg));
                        return;
                      }

                      // 1. Draw bottom arrow
                      ctx.beginPath();
                      ctx.moveTo(44, 98);
                      ctx.lineTo(32, 76);
                      ctx.lineTo(56, 76);
                      ctx.closePath();
                      ctx.fillStyle = "#FBBF24";
                      ctx.strokeStyle = "#D97706";
                      ctx.lineWidth = 2.5;
                      ctx.fill();
                      ctx.stroke();

                      // 2. Draw yellow circle border
                      ctx.beginPath();
                      ctx.arc(44, 44, 40, 0, Math.PI * 2);
                      ctx.closePath();
                      ctx.fillStyle = "#FBBF24";
                      ctx.strokeStyle = "#D97706";
                      ctx.lineWidth = 3.5;
                      ctx.fill();
                      ctx.stroke();

                      // 3. Clip and draw image
                      ctx.save();
                      ctx.beginPath();
                      ctx.arc(44, 44, 36, 0, Math.PI * 2);
                      ctx.closePath();
                      ctx.clip();
                      ctx.drawImage(img, 8, 8, 72, 72);
                      ctx.restore();

                      try {
                        const dataUrl = canvas.toDataURL();
                        resolve(dataUrl);
                      } catch {
                        resolve("data:image/svg+xml;charset=UTF-8," + encodeURIComponent(fallbackSvg));
                      }
                    };

                    img.onerror = () => {
                      resolve("data:image/svg+xml;charset=UTF-8," + encodeURIComponent(fallbackSvg));
                    };
                  });

                  return { ...ev, canvasDataUrl };
                })
              );
            }
          );

          setEvents(eventsWithMarkerImages);
          cachedMapEvents = eventsWithMarkerImages;
        }
      } catch (err: any) {
        if (!err?.message?.includes("AbortError")) {
          console.error("Error fetching events for map:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    return () => abortController.abort();
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (focusedEventId) {
        return String(event.id) === String(focusedEventId);
      }

      // 1. Category Filters
      let catMatched = true;
      if (selectedCategories.length > 0) {
        catMatched = event.channels?.some((c: any) =>
          c.type && selectedCategories.includes(c.type.trim().toLowerCase())
        );
      }

      // 2. Interaction Filters
      let intMatched = true;
      if (interactionFilter === "subscribed") {
        intMatched = event.channels?.some((c: any) => userSubscribedChannelIds.includes(c.id));
      } else if (interactionFilter === "bookmarks") {
        intMatched = userBookmarkedEventIds.includes(event.baseEventId);
      } else if (interactionFilter === "ongoing") {
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        intMatched = !event.rawStartDate || event.rawStartDate <= today;
      } else if (interactionFilter === "within_weeks") {
        const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        const todayMs = new Date(todayStr).getTime();
        const numWeeks = parseInt(weeksThreshold as any) || 0;
        const cutoffMs = todayMs + (numWeeks * 7 * 24 * 60 * 60 * 1000);
        const cutoffStr = new Date(cutoffMs).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        
        intMatched = !event.rawStartDate || event.rawStartDate <= cutoffStr;
      }

      return catMatched && intMatched;
    });
  }, [events, selectedCategories, interactionFilter, userSubscribedChannelIds, userBookmarkedEventIds, focusedEventId, weeksThreshold]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const toggleInteractionFilter = (filter: "subscribed" | "bookmarks" | "ongoing" | "within_weeks") => {
    if ((filter === "subscribed" || filter === "bookmarks") && !user) {
      alert("로그인이 필요한 기능입니다.");
      return;
    }
    setInteractionFilter(prev => prev === filter ? "all" : filter);
  };

  // 3. Initialize Kakao Map and place markers
  useEffect(() => {
    let isMounted = true;
    const hasKakao = typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
    if (!isScriptLoaded && !hasKakao) return;
    if (loading) return;

    const mapInitStartTime = performance.now();
    const interval = setInterval(() => {
      const kakao = window.kakao;
      if (kakao?.maps && typeof kakao.maps.load === "function") {
        clearInterval(interval);

        kakao.maps.load(() => {
          if (!isMounted) return;
          const container = document.getElementById("map-container");
          if (!container) return;

          const defaultCenter = new kakao.maps.LatLng(37.566535, 126.9779692);
          const geocoder = new kakao.maps.services.Geocoder();
          const places = new kakao.maps.services.Places();
          const bounds = new kakao.maps.LatLngBounds();
          let boundsChanged = false;
          let userAdjustedMapView = false;
          let successCount = 0;

          const isFirstMapCreation = !mapRef.current;
          if (!mapRef.current) {
            container.innerHTML = "";
            mapRef.current = new kakao.maps.Map(container, {
              center: defaultCenter,
              level: 5,
            });
          }
          const map = mapRef.current;

          // Clear existing markers and overlays
          markersRef.current.forEach((m: any) => m.setMap(null));
          overlaysRef.current.forEach((o: any) => o.setMap(null));
          markersRef.current = [];
          overlaysRef.current = [];
          if (openOverlayRef.current) openOverlayRef.current.setMap(null);
          openOverlayRef.current = null;
          if (userLocationOverlayRef.current) {
            userLocationOverlayRef.current.setMap(null);
            userLocationOverlayRef.current = null;
          }
          userLocationBeamRef.current = null;
          setDrawnMarkersCount(0);

          // 앱에서 위치가 확보된 경우의 내 위치 좌표 (추적 중이면 ref가 최신)
          const latestLoc = userLocationRef.current || userLocation;
          const userLatLng = latestLoc
            ? new kakao.maps.LatLng(latestLoc.lat, latestLoc.lng)
            : null;

          const targetEvent = filteredEvents.find((ev) => String(ev.id) === String(focusedEventId));

          const initializeMapAndPlaceMarkers = (centerCoords: any, level: number, initialLoad: boolean) => {
            const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

            if (initialLoad) {
              setTimeout(() => {
                if (!isMounted) return;
                map.relayout();
                map.setCenter(centerCoords);
                map.setLevel(level);
              }, 300);
            }

            const animateToMarker = (coords: any, done?: () => void) => {
              const currentLevel = map.getLevel();
              const focusLevel = 3;
              const panMs = 360;
              const zoomMs = 320;

              map.panTo(coords);
              window.setTimeout(() => {
                if (!isMounted) return;
                if (currentLevel !== focusLevel) {
                  map.setLevel(focusLevel, {
                    anchor: coords,
                    animate: { duration: zoomMs },
                  });
                }
                if (done) {
                  window.setTimeout(() => {
                    if (!isMounted) return;
                    done();
                  }, currentLevel !== focusLevel ? zoomMs + 20 : 20);
                }
              }, panMs);
            };

            kakao.maps.event.addListener(map, "dragstart", () => {
              if (openOverlayRef.current) {
                openOverlayRef.current.setMap(null);
                openOverlayRef.current = null;
              }
            });

            kakao.maps.event.addListener(map, "idle", () => {
              if (!isMounted) return;
              if (openOverlayRef.current && !userAdjustedMapView) {
                openOverlayRef.current.setMap(map);
              }
            });

            kakao.maps.event.addListener(map, "zoom_changed", () => {
              if (!isMounted) return;
              if (openOverlayRef.current) {
                const cNode = openOverlayRef.current.getContent();
                if (cNode && cNode.querySelector) {
                  const isZoomedOut = map.getLevel() > 3;
                  const dBtn = cNode.querySelector(".detail-btn");
                  const zBtn = cNode.querySelector(".zoom-btn");
                  if (dBtn && zBtn) {
                    if (isZoomedOut) {
                      dBtn.className = "detail-btn col-span-8 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer";
                      zBtn.style.display = "flex";
                    } else {
                      dBtn.className = "detail-btn col-span-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer";
                      zBtn.style.display = "none";
                    }
                  }
                }
              }
            });

            const targetCoords: any[] = [];
            const targetOverlays: any[] = [];

            const resolvedCoordsList: Array<{ event: any; coords: any; location: string }> = [];
            const addressPromises: Promise<void>[] = [];

            filteredEvents.forEach((event) => {
              const currentLocs = event.locationsList && event.locationsList.length > 0 
                ? event.locationsList 
                : [{ location: event.location, latitude: null, longitude: null }];

              currentLocs.forEach((locObj: any) => {
                const isObj = locObj && typeof locObj === "object";
                const locationName = (isObj ? locObj.location : locObj) || "";
                if (!locationName || !locationName.trim()) return;

                const trimmedLoc = locationName.trim();
                const lat = isObj ? locObj.latitude : null;
                const lng = isObj ? locObj.longitude : null;

                // Skip geocoding if the location indicates a nationwide or online event
                if (trimmedLoc.includes("전국") || trimmedLoc.includes("온라인")) {
                  return;
                }

                // If coordinates are already cached in DB, use them directly (Major performance boost!)
                if (lat !== null && lng !== null) {
                  resolvedCoordsList.push({
                    event,
                    coords: new kakao.maps.LatLng(lat, lng),
                    location: trimmedLoc
                  });
                  return;
                }

                // Fallback to geocoder address search (for legacy data)
                const promise = new Promise<void>((resolve) => {
                  try {
                    geocoder.addressSearch(trimmedLoc, (result: any, status: any) => {
                      if (!isMounted) {
                        resolve();
                        return;
                      }
                      if (status === kakao.maps.services.Status.OK) {
                        resolvedCoordsList.push({
                          event,
                          coords: new kakao.maps.LatLng(result[0].y, result[0].x),
                          location: trimmedLoc
                        });
                        resolve();
                      } else {
                        places.keywordSearch(trimmedLoc, (data: any, placeStatus: any) => {
                          if (!isMounted) {
                            resolve();
                            return;
                          }
                          if (placeStatus === kakao.maps.services.Status.OK) {
                            resolvedCoordsList.push({
                              event,
                              coords: new kakao.maps.LatLng(data[0].y, data[0].x),
                              location: trimmedLoc
                            });
                          }
                          resolve();
                        });
                      }
                    });
                  } catch (err) {
                    console.error("[Map Error] Failed to invoke addressSearch:", err);
                    resolve();
                  }
                });
                addressPromises.push(promise);
              });
            });

            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(resolve, 1000);
            });

            Promise.race([Promise.all(addressPromises), timeoutPromise]).then(() => {
              if (!isMounted) return;

              // 1. Group by coordinates rounded to 5 decimal places (~1.1m accuracy)
              const coordGroups: { [key: string]: { coords: any; location: string; events: any[] } } = {};
              resolvedCoordsList.forEach((item) => {
                const lat = item.coords.getLat();
                const lng = item.coords.getLng();
                const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
                if (!coordGroups[key]) {
                  coordGroups[key] = {
                    coords: item.coords,
                    location: item.location,
                    events: []
                  };
                }
                if (!coordGroups[key].events.some((e: any) => e.id === item.event.id)) {
                  coordGroups[key].events.push(item.event);
                }
              });

              // 2. Sync the Kakao Map canvas to the DOM size first
              map.relayout();

              // 3. Render markers & overlays for each group
              let successCount = 0;

              Object.values(coordGroups).forEach((group) => {
                const { coords, location: activeLocation, events: groupEvents } = group;

                bounds.extend(coords);
                boundsChanged = true;

                const markerWidth = isMobile ? 54 : 68;
                const markerHeight = isMobile ? 60 : 76;
                const offsetX = isMobile ? 27 : 34;
                const offsetY = isMobile ? 60 : 76;

                let markerImageSrc = "";
                let groupCanvasDataUrl = "";

                const firstChannelId = groupEvents[0]?.channels[0]?.id;
                const isAllSameChannel = groupEvents.every((ev: any) => ev.channels[0]?.id === firstChannelId);

                if (groupEvents.length === 1 || isAllSameChannel) {
                  markerImageSrc = groupEvents[0].canvasDataUrl;
                } else {
                  groupCanvasDataUrl = createGroupMarkerCanvas(groupEvents.length);
                  markerImageSrc = groupCanvasDataUrl;
                }

                const markerImage = new kakao.maps.MarkerImage(
                  markerImageSrc,
                  new kakao.maps.Size(markerWidth, markerHeight),
                  { offset: new kakao.maps.Point(offsetX, offsetY) }
                );

                const hasFestival = groupEvents.some((ev) => ev.channelType === "festival" || ev.channels?.some((c: any) => c.type === "festival"));
                const markerZIndex = hasFestival ? 10 : 2;

                const marker = new kakao.maps.Marker({
                  position: coords,
                  image: markerImage,
                  zIndex: markerZIndex,
                });
                marker.setMap(map);

                const infoContent = document.createElement("div");
                infoContent.className = "relative bg-background border border-border shadow-2xl rounded-2xl p-4 w-[300px] cursor-default select-none z-50 animate-in fade-in duration-200";
                infoContent.style.transform = `translateY(${isMobile ? -60 : -76}px)`;

                // Prevent mouse/touch/wheel events from propagating to the Kakao Map to avoid closing overlay while scrolling/interacting
                const stopProp = (e: any) => e.stopPropagation();
                infoContent.addEventListener("mousedown", stopProp);
                infoContent.addEventListener("mousemove", stopProp);
                infoContent.addEventListener("mouseup", stopProp);
                infoContent.addEventListener("click", stopProp);
                infoContent.addEventListener("dblclick", stopProp);
                infoContent.addEventListener("contextmenu", stopProp);
                infoContent.addEventListener("wheel", stopProp);
                infoContent.addEventListener("touchstart", stopProp, { passive: true });
                infoContent.addEventListener("touchmove", stopProp, { passive: true });
                infoContent.addEventListener("touchend", stopProp);

                // Function to render a single event detail view in the custom overlay
                const showSingleEvent = (event: any) => {
                  infoContent.innerHTML = `
                    <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-background border-b border-r border-border rotate-45"></div>
                    <div class="flex justify-between items-start gap-3 mb-2">
                      <div class="flex items-center gap-1 min-w-0 flex-1">
                        <h4 class="font-bold text-sm text-foreground line-clamp-2 leading-snug">${event.title}</h4>
                      </div>
                      <button class="close-btn text-muted-foreground hover:text-foreground text-xl leading-none font-semibold shrink-0">&times;</button>
                    </div>
                    <div class="space-y-1.5 border-t border-border/60 pt-2.5">
                      <p class="text-xs text-muted-foreground flex items-center gap-1">
                        <span class="font-bold text-foreground/80 shrink-0 min-w-[44px]">주최자:</span>
                        <span class="truncate">${event.channelName}</span>
                      </p>
                      <p class="text-xs text-muted-foreground flex items-center gap-1">
                        <span class="font-bold text-foreground/80 shrink-0 min-w-[44px]">일시:</span>
                        <span class="truncate">${event.date}</span>
                      </p>
                      <p class="text-xs text-muted-foreground flex items-center gap-1">
                        <span class="font-bold text-foreground/80 shrink-0 min-w-[44px]">장소:</span>
                        <span class="truncate font-medium text-blue-600 dark:text-blue-400">${activeLocation}</span>
                      </p>
                    </div>
                    <div class="grid grid-cols-10 gap-2 mt-3.5 w-full select-none">
                      <button class="detail-btn col-span-8 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer">상세 보기</button>
                      <button class="zoom-btn col-span-2 h-10 bg-background dark:bg-slate-900 border border-border/80 hover:bg-muted text-foreground rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                      </button>
                    </div>
                  `;

                  infoContent.querySelector(".close-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    infoOverlay.setMap(null);
                    openOverlayRef.current = null;

                    const originalMarkerImage = new kakao.maps.MarkerImage(
                      isAllSameChannel ? groupEvents[0].canvasDataUrl : (groupCanvasDataUrl || groupEvents[0].canvasDataUrl),
                      new kakao.maps.Size(markerWidth, markerHeight),
                      { offset: new kakao.maps.Point(offsetX, offsetY) }
                    );
                    marker.setImage(originalMarkerImage);
                    marker.setZIndex(markerZIndex);
                  });



                  infoContent.querySelector(".detail-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    window.location.href = `/events/${event.id}`;
                  });

                  infoContent.querySelector(".zoom-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    map.setLevel(3, {
                      anchor: coords,
                      animate: { duration: 320 }
                    });
                  });

                  // Change marker image to the specific clicked event's channel image
                  const activeMarkerImage = new kakao.maps.MarkerImage(
                    event.canvasDataUrl,
                    new kakao.maps.Size(markerWidth, markerHeight),
                    { offset: new kakao.maps.Point(offsetX, offsetY) }
                  );
                  marker.setImage(activeMarkerImage);
                  marker.setZIndex(15);
                };

                // Function to render the list of events in the custom overlay
                const showEventList = () => {
                  infoContent.innerHTML = `
                    <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-background border-b border-r border-border rotate-45"></div>
                    <div class="flex justify-between items-start gap-4 mb-2">
                      <h4 class="font-extrabold text-sm text-foreground pr-2 leading-snug">진행 행사 목록 (${groupEvents.length})</h4>
                      <button class="close-btn text-muted-foreground hover:text-foreground text-xl leading-none font-semibold shrink-0">&times;</button>
                    </div>
                    <div class="space-y-2 max-h-[130px] overflow-y-auto pr-1 border-t border-border/60 pt-2.5 custom-scrollbar">
                      ${groupEvents.map((event) => `
                        <div class="event-item border border-border/80 rounded-xl overflow-hidden bg-muted/20 hover:bg-muted/30 transition-all duration-200 cursor-pointer px-3 py-2 flex justify-between items-center" data-event-id="${event.id}">
                          <span class="font-bold text-[12px] text-foreground line-clamp-1 flex-1 pr-2">${event.title}</span>
                          <svg class="w-3 h-3 text-muted-foreground shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5-7.5" /></svg>
                        </div>
                      `).join("")}
                    </div>
                  `;

                  // Reset the marker to group representation when returning to list
                  const originalMarkerImage = new kakao.maps.MarkerImage(
                    isAllSameChannel ? groupEvents[0].canvasDataUrl : (groupCanvasDataUrl || groupEvents[0].canvasDataUrl),
                    new kakao.maps.Size(markerWidth, markerHeight),
                    { offset: new kakao.maps.Point(offsetX, offsetY) }
                  );
                  marker.setImage(originalMarkerImage);
                  marker.setZIndex(markerZIndex);

                  infoContent.querySelector(".close-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    infoOverlay.setMap(null);
                    openOverlayRef.current = null;
                  });

                  infoContent.querySelectorAll(".event-item").forEach((itemNode: any) => {
                    const eventId = itemNode.getAttribute("data-event-id");
                    const event = groupEvents.find((e: any) => String(e.id) === String(eventId));
                    itemNode.addEventListener("click", (e: any) => {
                      e.stopPropagation();
                      if (event) {
                        showSingleEvent(event);
                      }
                    });
                  });
                };

                // Initialize the content based on number of events in this cluster
                if (groupEvents.length === 1) {
                  showSingleEvent(groupEvents[0]);
                } else {
                  showEventList();
                }

                const infoOverlay = new kakao.maps.CustomOverlay({
                  position: coords,
                  content: infoContent,
                  yAnchor: 1.0,
                  zIndex: 20,
                });

                const hasFocusedEvent = groupEvents.some((ev) => String(ev.id) === String(focusedEventId));
                if (hasFocusedEvent) {
                  targetCoords.push(coords);
                  targetOverlays.push(infoOverlay);
                }

                kakao.maps.event.addListener(marker, "click", () => {
                  userAdjustedMapView = true;
                  if (openOverlayRef.current) openOverlayRef.current.setMap(null);
                  openOverlayRef.current = null;

                  const projection = map.getProjection();
                  if (projection) {
                    const markerPoint = projection.pointFromCoords(coords);
                    if (markerPoint) {
                      const targetPoint = new kakao.maps.Point(markerPoint.x, markerPoint.y - 40);
                      const targetCoords = projection.coordsFromPoint(targetPoint);
                      map.panTo(targetCoords);
                    } else {
                      map.panTo(coords);
                    }
                  } else {
                    map.panTo(coords);
                  }

                  if (!isMounted) return;

                  if (groupEvents.length === 1) {
                    showSingleEvent(groupEvents[0]);
                  } else {
                    showEventList();
                  }

                  infoOverlay.setMap(map);
                  openOverlayRef.current = infoOverlay;
                });

                markersRef.current.push(marker);
                overlaysRef.current.push(infoOverlay);

                successCount++;
              });

              setDrawnMarkersCount(successCount);

              // 3-1. 내 위치(파란 점 + 방향 콘) 오버레이 — 앱에서 위치가 확보된 경우만
              if (userLatLng) {
                const dot = document.createElement("div");
                dot.className = "od-user-loc";
                dot.innerHTML = `<span class="od-user-loc-beam"></span><span class="od-user-loc-pulse"></span><span class="od-user-loc-dot"></span>`;
                const userOverlay = new kakao.maps.CustomOverlay({
                  position: userLatLng,
                  content: dot,
                  xAnchor: 0.5,
                  yAnchor: 0.5,
                  // 행사 마커(최대 15)보다 위, 정보 팝업(20)보다는 아래
                  zIndex: 16,
                });
                userOverlay.setMap(map);
                userLocationOverlayRef.current = userOverlay;
                // 방향 콘 DOM을 붙잡아두고, 이미 알고 있는 방향이 있으면 즉시 반영
                userLocationBeamRef.current = dot.querySelector(".od-user-loc-beam");
                if (lastHeadingRef.current != null && userLocationBeamRef.current) {
                  userLocationBeamRef.current.style.transform = `rotate(${headingRotationRef.current}deg)`;
                  userLocationBeamRef.current.style.opacity = "1";
                }
              }

              // 4. Set map viewport bounds
              const safetyDelay = isFirstMapCreation ? 350 : 50;
              setTimeout(() => {
                if (!isMounted) return;

                if (targetCoords.length > 0) {
                  userAdjustedMapView = true;
                  if (userLatLng) {
                    // 이벤트 상세 → 지도 진입: 내 위치 + 선택 행사 마커가 모두 보이도록 뷰를 맞춘다.
                    const bothBounds = new kakao.maps.LatLngBounds();
                    targetCoords.forEach((c) => bothBounds.extend(c));
                    bothBounds.extend(userLatLng);
                    map.setBounds(bothBounds);
                    // 선택 행사 정보창 열기
                    if (targetOverlays[0]) {
                      targetOverlays[0].setMap(map);
                      openOverlayRef.current = targetOverlays[0];
                    }
                  } else if (targetCoords.length === 1) {
                    map.setLevel(3);
                    setTimeout(() => {
                      if (!isMounted) return;
                      const projection = map.getProjection();
                      if (projection) {
                        const markerPoint = projection.pointFromCoords(targetCoords[0]);
                        if (markerPoint) {
                          const targetPoint = new kakao.maps.Point(markerPoint.x, markerPoint.y - 40);
                          const offsetCenter = projection.coordsFromPoint(targetPoint);
                          map.setCenter(offsetCenter);
                        } else {
                          map.setCenter(targetCoords[0]);
                        }
                      } else {
                        map.setCenter(targetCoords[0]);
                      }
                    }, 50);

                    const cNode = targetOverlays[0].getContent();
                    if (cNode && cNode.querySelector) {
                      const dBtn = cNode.querySelector(".detail-btn");
                      const zBtn = cNode.querySelector(".zoom-btn");
                      if (dBtn && zBtn) {
                        dBtn.className = "detail-btn col-span-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer";
                        zBtn.style.display = "none";
                      }
                    }

                    targetOverlays[0].setMap(map);
                    openOverlayRef.current = targetOverlays[0];
                  } else {
                    const specificBounds = new kakao.maps.LatLngBounds();
                    targetCoords.forEach((c) => specificBounds.extend(c));
                    map.setBounds(specificBounds);
                  }
                } else if (boundsChanged && !userAdjustedMapView) {
                  map.setBounds(bounds);
                }
                setIsMapReady(true);
                const duration = performance.now() - mapInitStartTime;
                console.log(`%c[Perf Client] CLIENT - 카카오 지도 및 마커 초기화 완료: ${duration.toFixed(1)}ms`, "color: #10b981; font-weight: bold;");
                performanceTracker.addLog({
                  label: "카카오 지도 및 마커 초기화 완료 (Client)",
                  duration,
                  type: 'client'
                });
              }, safetyDelay);
            }).catch((err) => {
              console.error("[Map Error] Promise.all rejected:", err);
            });
          };

          if (targetEvent) {
            geocoder.addressSearch(targetEvent.location, (result: any, status: any) => {
              if (!isMounted) return;
              if (status === kakao.maps.services.Status.OK) {
                const centerCoords = new kakao.maps.LatLng(result[0].y, result[0].x);
                initializeMapAndPlaceMarkers(centerCoords, 4, !isMapInitialized.current);
                isMapInitialized.current = true;
              } else {
                places.keywordSearch(targetEvent.location, (data: any, placeStatus: any) => {
                  if (!isMounted) return;
                  if (placeStatus === kakao.maps.services.Status.OK) {
                    const centerCoords = new kakao.maps.LatLng(data[0].y, data[0].x);
                    initializeMapAndPlaceMarkers(centerCoords, 4, !isMapInitialized.current);
                    isMapInitialized.current = true;
                  } else {
                    initializeMapAndPlaceMarkers(defaultCenter, 5, !isMapInitialized.current);
                    isMapInitialized.current = true;
                  }
                });
              }
            });
          } else {
            initializeMapAndPlaceMarkers(defaultCenter, 5, !isMapInitialized.current);
            isMapInitialized.current = true;
          }
        });
      }
    }, 100);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isScriptLoaded, loading, filteredEvents, focusedEventId, userLocation]);

  // Active ResizeObserver to trigger map relayout instantly when map container size changes in pixels
  useEffect(() => {
    const container = document.getElementById("map-container");
    if (!container) return;

    let resizeTimer: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (mapRef.current) {
          // Immediately sync Kakao Map internal size calculations
          mapRef.current.relayout();
          
          // Debounce recentering / bounding to prevent stuttering during transition animations
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const map = mapRef.current;
            if (map && window.kakao) {
              if (focusedEventId) {
                if (markersRef.current && markersRef.current.length > 0) {
                  const targetMarker = markersRef.current.find((m: any) => m.getMap() !== null);
                  if (targetMarker) {
                    const uLoc = userLocationRef.current;
                    if (uLoc && window.kakao) {
                      // 내 위치 + 선택 행사가 모두 보이도록 유지
                      const bothBounds = new window.kakao.maps.LatLngBounds();
                      bothBounds.extend(targetMarker.getPosition());
                      bothBounds.extend(new window.kakao.maps.LatLng(uLoc.lat, uLoc.lng));
                      map.setBounds(bothBounds);
                    } else {
                      map.setCenter(targetMarker.getPosition());
                    }
                  }
                }
              } else if (markersRef.current && markersRef.current.length > 0) {
                const bounds = new window.kakao.maps.LatLngBounds();
                let markerCount = 0;
                markersRef.current.forEach((marker: any) => {
                  if (marker.getMap()) {
                    bounds.extend(marker.getPosition());
                    markerCount++;
                  }
                });
                if (markerCount > 0) {
                  map.setBounds(bounds);
                }
              }
            }
          }, 100);
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [focusedEventId, filteredEvents]);

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center max-w-xl mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto mb-4">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground">카카오맵 API 키가 없습니다</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              지도를 표시하려면 환경 변수에 API 키를 설정해야 합니다.
            </p>
            <div className="mt-5 rounded-xl bg-muted/40 p-3.5 font-mono text-xs text-left select-all border border-border">
              NEXT_PUBLIC_KAKAO_MAP_KEY=your_kakao_key
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-outer-container h-[calc(100vh-56px)] md:h-auto md:min-h-screen bg-background">
      <Header />
      <div className="map-inner-container w-full h-[calc(100vh-112px)] md:h-auto md:mx-auto md:max-w-6xl md:px-4 md:py-3 relative">
        <main className="w-full h-full md:h-auto flex flex-col md:block py-0 md:py-6">
          <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 pt-3 pb-1 md:px-0 md:py-0 mb-1 md:mb-2 shrink-0">
            <div className="space-y-1">
              <h1 className="text-sm md:text-3xl font-extrabold tracking-tight">🗺️ 오프라인 행사 지도</h1>
            </div>
          </div>

          {/* Mobile Flat Collapsible Premium Filter Widget */}
          <div className="block md:hidden shrink-0 px-4 pt-3 pb-3">
            {isFilterOpen ? (
              /* EXPANDED FILTER PANEL */
              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-500/20 rounded-2xl shadow-xl p-3.5 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-200">
                  {/* Header Row */}
                  <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsFilterOpen(false)}>
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-[13px] font-extrabold text-foreground tracking-tight">필터 설정</h3>
                    </div>
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  {/* Horizontal Sections */}
                  <div className="space-y-3.5 pt-1.5 border-t border-purple-500/10">
                    {/* Section 1: 빠른 필터 */}
                    <div className="flex flex-col gap-1.5">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-tight">빠른 필터</h4>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setInteractionFilter("all")}
                          className={cn(
                            "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                            interactionFilter === "all"
                              ? "border-slate-700 bg-slate-300 text-slate-950 font-extrabold"
                              : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          전체
                        </button>
                        {[
                          { id: "subscribed", label: "팔로우 채널" },
                          { id: "bookmarks", label: "찜한 행사" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleInteractionFilter(item.id as any)}
                            className={cn(
                              "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                              interactionFilter === item.id
                                ? "border-purple-500 bg-purple-100 text-purple-800 font-extrabold"
                                : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section 2: 장르 및 주제 */}
                    <div className="flex flex-col gap-1.5">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-tight">장르 및 주제</h4>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setSelectedCategories([])}
                          className={cn(
                            "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                            selectedCategories.length === 0
                              ? "border-slate-700 bg-slate-300 text-slate-950 font-extrabold"
                              : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          전체
                        </button>
                        {[
                          { id: "game", label: "게임", activeClass: "border-blue-500 bg-blue-100 text-blue-800" },
                          { id: "youtuber", label: "유튜버", activeClass: "border-red-500 bg-red-100 text-red-800" },
                          { id: "festival", label: "축제", activeClass: "border-amber-500 bg-amber-100 text-amber-800" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={cn(
                              "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                              selectedCategories.includes(cat.id)
                                ? `${cat.activeClass} font-extrabold`
                                : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: 진행 기간 */}
                    <div className="flex flex-col gap-1.5">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-tight">진행 기간</h4>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => toggleInteractionFilter("ongoing")}
                          className={cn(
                            "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                            interactionFilter === "ongoing"
                              ? "border-slate-700 bg-slate-300 text-slate-950 font-extrabold"
                              : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          진행 중
                        </button>

                        <div
                          onClick={() => toggleInteractionFilter("within_weeks")}
                          className={cn(
                            "flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all shadow-sm cursor-pointer select-none gap-0.5 group",
                            interactionFilter === "within_weeks"
                              ? "border-slate-700 bg-slate-300 text-slate-950 font-extrabold"
                              : "border-slate-300/80 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {/* Custom Stepper Buttons for Mobile */}
                          <div className="flex flex-col justify-center gap-0 shrink-0 ml-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              type="button" 
                              className="hover:text-blue-600 active:scale-75 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = parseInt(weeksThreshold as any) || 2;
                                setWeeksThreshold(Math.min(52, current + 1));
                                if (interactionFilter !== "within_weeks") {
                                  setInteractionFilter("within_weeks");
                                }
                              }}
                            >
                              <ChevronUp className="h-2 w-2" />
                            </button>
                            <button 
                              type="button" 
                              className="hover:text-blue-600 active:scale-75 transition-all -mt-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = parseInt(weeksThreshold as any) || 2;
                                setWeeksThreshold(Math.max(1, current - 1));
                                if (interactionFilter !== "within_weeks") {
                                  setInteractionFilter("within_weeks");
                                }
                              }}
                            >
                              <ChevronDown className="h-2 w-2" />
                            </button>
                          </div>

                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={weeksThreshold}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const valStr = e.target.value.replace(/[^0-9]/g, "");
                              const val = parseInt(valStr);
                              if (!isNaN(val) && val > 0) {
                                setWeeksThreshold(Math.min(52, val));
                                if (interactionFilter !== "within_weeks") {
                                  setInteractionFilter("within_weeks");
                                }
                              } else if (valStr === "") {
                                setWeeksThreshold("" as any);
                              }
                            }}
                            onBlur={() => {
                              if (!weeksThreshold) {
                                setWeeksThreshold(2);
                              }
                            }}
                            className={cn(
                              "w-5 text-center bg-transparent focus:outline-none p-0 m-0 shrink-0 border-b border-dashed transition-all leading-none h-3.5 mr-1",
                              interactionFilter === "within_weeks"
                                ? "text-slate-950 border-slate-950 font-extrabold text-[10px]"
                                : "text-slate-600 dark:text-slate-300 border-slate-400 font-bold text-[10px]"
                            )}
                          />
                          <span className="shrink-0 tracking-tight">주 이내</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CLOSED FLAT PILL */
                <div 
                  onClick={() => setIsFilterOpen(true)}
                  className="w-fit bg-purple-50 dark:bg-purple-950 border border-purple-500/20 rounded-full shadow-md px-4 py-2 flex items-center gap-2 cursor-pointer select-none animate-in fade-in duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span className="text-[12px] font-extrabold text-foreground tracking-tight">필터 설정</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
                </div>
              )}
            </div>

            <div className={cn("relative flex-1 w-[calc(100%+32px)] md:w-full border-t md:border border-border rounded-none md:rounded-2xl bg-muted overflow-hidden shadow-none md:shadow-md md:h-[650px] mx-[-16px] md:mx-0 transition-all duration-300")}>
              {/* New Floating Panel (PC only) */}
              <div className="hidden md:flex absolute top-2 left-2 sm:top-4 sm:left-4 z-[60] w-[135px] sm:w-[180px] bg-purple-50 dark:bg-purple-950 border border-purple-500/20 rounded-2xl sm:rounded-[1.75rem] shadow-2xl flex flex-col animate-in slide-in-from-left-4 duration-300 overflow-hidden">
                {/* Master Header Toggle */}
                <div
                  className={cn(
                    "p-2.5 sm:p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-purple-500/10 transition-all bg-white/20 dark:bg-black/10",
                    isSidebarExpanded && "border-b border-purple-500/10"
                  )}
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                >
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground" />
                  <h3 className="text-[13px] sm:text-[14px] font-extrabold text-foreground tracking-tight">필터 설정</h3>
                </div>
                {isSidebarExpanded ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />}
              </div>

              {/* Expandable Content Body */}
              {isSidebarExpanded && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col bg-white/10 dark:bg-black/10">
                  {/* Focus Event Filter Pill */}
                  {focusedEventId && (
                    <div className="p-2 sm:p-3 border-b border-pink-200/40 bg-pink-50/30 dark:bg-pink-950/20">
                      <button
                        onClick={() => setFocusedEventId(null)}
                        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl border border-pink-400/50 bg-white dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 text-[11px] sm:text-[12px] font-extrabold shadow-sm transition-all active:scale-[0.98]"
                      >
                        <span className="truncate mr-1">선택 행사만 보기</span>
                        <span className="bg-pink-100 dark:bg-pink-800 px-1.5 py-0.5 rounded-md shrink-0 text-[10px]">✕</span>
                      </button>
                    </div>
                  )}
                  {/* 빠른 필터 Section */}
                  <div className="p-2.5 sm:p-4 border-b border-purple-500/20">
                    <h4 className="text-[11px] sm:text-[12px] font-bold text-foreground/70 mb-2.5">빠른 필터</h4>
                    <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                        {[
                          { id: "all", label: "전체" },
                          { id: "subscribed", label: "팔로우 채널" },
                          { id: "bookmarks", label: "찜한 행사" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.id === "all" ? setInteractionFilter("all") : toggleInteractionFilter(item.id as any)}
                            className={cn(
                              "flex items-center justify-center py-2 sm:py-2.5 rounded-full text-[12px] sm:text-[13px] font-bold border transition-all px-0.5 whitespace-nowrap shadow-sm",
                              interactionFilter === item.id
                                ? item.id === "all"
                                  ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                                  : "bg-purple-100 text-purple-800 border-2 border-purple-500 shadow-sm"
                                : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 장르 및 주제 Section */}
                  <div className="p-2.5 sm:p-4 border-b border-purple-500/20">
                    <h4 className="text-[11px] sm:text-[12px] font-bold text-muted-foreground mb-2.5">장르 및 주제</h4>
                    <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => setSelectedCategories([])}
                        className={cn(
                          "flex items-center justify-center py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold border transition-all",
                          selectedCategories.length === 0
                            ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                            : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        전체
                      </button>
                      <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                        {[
                          { id: "game", label: "게임", activeClass: "bg-blue-100 text-blue-800 border-2 border-blue-500 shadow-sm" },
                          { id: "youtuber", label: "유튜버", activeClass: "bg-red-100 text-red-800 border-2 border-red-500 shadow-sm" },
                          { id: "festival", label: "축제", activeClass: "bg-amber-100 text-amber-800 border-2 border-amber-500 shadow-sm" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={cn(
                              "flex items-center justify-center py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold border transition-all",
                              selectedCategories.includes(cat.id)
                                ? cat.activeClass
                                : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 진행 기간 Section */}
                  <div className="p-2.5 sm:p-4">
                    <h4 className="text-[11px] sm:text-[12px] font-bold text-muted-foreground mb-2.5">진행 기간</h4>
                    <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                      <button
                        onClick={() => toggleInteractionFilter("ongoing")}
                        className={cn(
                          "flex items-center justify-center py-2 sm:py-2.5 rounded-full text-[12px] sm:text-[13px] font-bold border transition-all w-full shadow-sm",
                          interactionFilter === "ongoing"
                            ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                            : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        진행 중
                      </button>

                      <div
                        onClick={() => toggleInteractionFilter("within_weeks")}
                        className={cn(
                          "flex items-center justify-center py-2 sm:py-2.5 px-3 rounded-full text-[12px] sm:text-[13px] font-bold border transition-all w-full shadow-sm cursor-pointer select-none gap-0.5 group",
                          interactionFilter === "within_weeks"
                            ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                            : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {/* Custom Stepper Buttons (Placed on the left of the number) */}
                        <div className="flex flex-col justify-center gap-0 shrink-0 ml-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            className="hover:text-blue-600 active:scale-75 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = parseInt(weeksThreshold as any) || 2;
                              setWeeksThreshold(Math.min(52, current + 1));
                              if (interactionFilter !== "within_weeks") {
                                setInteractionFilter("within_weeks");
                              }
                            }}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button 
                            type="button" 
                            className="hover:text-blue-600 active:scale-75 transition-all -mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = parseInt(weeksThreshold as any) || 2;
                              setWeeksThreshold(Math.max(1, current - 1));
                              if (interactionFilter !== "within_weeks") {
                                setInteractionFilter("within_weeks");
                              }
                            }}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Underlined Number Input */}
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={weeksThreshold}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const valStr = e.target.value.replace(/[^0-9]/g, "");
                            const val = parseInt(valStr);
                            if (!isNaN(val) && val > 0) {
                              setWeeksThreshold(Math.min(52, val));
                              if (interactionFilter !== "within_weeks") {
                                setInteractionFilter("within_weeks");
                              }
                            } else if (valStr === "") {
                              setWeeksThreshold("" as any);
                            }
                          }}
                          onBlur={() => {
                            if (!weeksThreshold) {
                              setWeeksThreshold(2);
                            }
                          }}
                          className={cn(
                            "w-5 sm:w-6 text-center bg-transparent focus:outline-none p-0 m-0 shrink-0 border-b border-dashed transition-all leading-none h-4 sm:h-4.5 translate-y-[0.5px] mr-1",
                            interactionFilter === "within_weeks"
                              ? "text-slate-950 border-slate-950 focus:border-slate-950 font-extrabold text-[12px] sm:text-[13px]"
                              : "text-slate-800 dark:text-slate-100 border-slate-400 group-hover:border-slate-600 focus:border-slate-800 font-bold text-[12px] sm:text-[13px]"
                          )}
                        />

                        <span className="shrink-0 tracking-tight">주 이내</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(!isMapReady || loading) && filteredEvents.length > 0 && (
              <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-4 transition-opacity duration-500">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm font-bold text-foreground">지도를 불러오는 중입니다...</p>
              </div>
            )}

            {!loading && filteredEvents.length === 0 && (
              <div className="absolute inset-0 bg-background/80 z-50 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
                <div className="h-16 w-16 items-center justify-center rounded-full bg-muted flex mb-3 text-muted-foreground">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-foreground">해당 조건의 등록된 오프라인 행사가 없습니다.</h3>
                <p className="text-xs text-muted-foreground mt-1">다른 조건의 필터를 선택해보세요.</p>
              </div>
            )}

            <div
              id="map-container"
              style={{ touchAction: "none" }}
              className={cn("absolute inset-0 bg-muted transition-opacity duration-700", isMapReady ? "opacity-100" : "opacity-0")}
            />

            <style>{`
              .scrollbar-none::-webkit-scrollbar {
                display: none;
              }
              .scrollbar-none {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              #map-container {
                touch-action: none !important;
              }
              /* 내 위치(파란 점 + 방향 콘) 마커 */
              .od-user-loc {
                position: relative;
                width: 44px;
                height: 44px;
                pointer-events: none;
              }
              .od-user-loc-dot {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                transform: translate(-50%, -50%);
                background: #2563eb;
                border: 3px solid #ffffff;
                border-radius: 9999px;
                box-shadow: 0 0 0 1.5px rgba(37, 99, 235, 0.5), 0 2px 6px rgba(0, 0, 0, 0.45);
                z-index: 2;
              }
              .od-user-loc-pulse {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                transform: translate(-50%, -50%);
                background: rgba(37, 99, 235, 0.3);
                border-radius: 9999px;
                animation: od-user-loc-pulse 2s ease-out infinite;
                z-index: 1;
              }
              @keyframes od-user-loc-pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
                100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
              }
              /* 휴대폰이 향한 방향으로 회전하는 콘(부채꼴). 방향 확보 전엔 숨김. */
              .od-user-loc-beam {
                position: absolute;
                inset: 0;
                opacity: 0;
                transform: rotate(0deg);
                transition: transform 0.15s ease-out, opacity 0.3s ease-out;
                z-index: 1;
              }
              .od-user-loc-beam::before {
                content: "";
                position: absolute;
                left: 50%;
                top: 50%;
                width: 0;
                height: 0;
                border-left: 13px solid transparent;
                border-right: 13px solid transparent;
                border-bottom: 22px solid rgba(37, 99, 235, 0.4);
                transform: translate(-50%, -100%);
              }
              @media (max-width: 767px) {
                body, html {
                  overscroll-behavior-y: none;
                }
                .map-outer-container {
                  height: calc(100vh - env(safe-area-inset-bottom, 0px) - 56px) !important;
                  overflow: hidden !important;
                  overscroll-behavior-y: none;
                }
                .map-inner-container {
                  height: calc(100vh - env(safe-area-inset-bottom, 0px) - 112px) !important;
                  overflow: hidden !important;
                  overscroll-behavior-y: none;
                }
              }
            `}</style>

            {/* Bottom Right Floating Fit Bounds Action Button */}
            {isMapReady && filteredEvents.length > 0 && (
              <button
                onClick={handleResetBounds}
                className="absolute bottom-6 right-8 md:bottom-4 md:right-4 z-40 flex h-10 items-center gap-2 rounded-xl border border-border bg-background/90 backdrop-blur-sm px-3.5 font-bold text-foreground shadow-xl hover:bg-accent hover:text-accent-foreground hover:border-border/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                title="지도를 맞추어 모든 행사 한눈에 보기"
              >
                <Maximize2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-xs tracking-tight">전체 보기</span>
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
