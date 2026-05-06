"use client";

import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase/client";
import { MapPin, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MapContent />
    </Suspense>
  );
}

function MapContent() {
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId");

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
  });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userBookmarkedEventIds, setUserBookmarkedEventIds] = useState<number[]>([]);
  const [userSubscribedChannelIds, setUserSubscribedChannelIds] = useState<number[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>(["all"]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [drawnMarkersCount, setDrawnMarkersCount] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);

  const mapRef = useRef<any>(null);
  const isMapInitialized = useRef(false);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const openOverlayRef = useRef<any>(null);
  const overlayRevealTimerRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  const cleanKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "").trim();

  // 1. Sync User Session and Fetch favorites & bookmarks
  useEffect(() => {
    const abortController = new AbortController();

    const syncSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      userIdRef.current = currentUser?.id ?? null;
      setUser(currentUser);

      if (currentUser) {
        try {
          const [{ data: bookmarksData }, { data: favoritesData }] = await Promise.all([
            supabase.from("event_bookmarks").select("offline_event_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
            supabase.from("favorites").select("channel_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
          ]);

          if (bookmarksData) {
            const newIds = bookmarksData.map(b => b.offline_event_id).filter(Boolean);
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
            supabase.from("event_bookmarks").select("offline_event_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
            supabase.from("favorites").select("channel_id").eq("user_id", currentUser.id).abortSignal(abortController.signal),
          ]);

          if (bookmarksData) {
            const newIds = bookmarksData.map(b => b.offline_event_id).filter(Boolean);
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
    const abortController = new AbortController();

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("offline_events")
          .select(`
            id,
            title,
            start_date,
            end_date,
            image_url,
            offline_event_channels(
              channels(
                id,
                name,
                type,
                image_url
              )
            ),
            offline_event_locations(
              location
            )
          `)
          .abortSignal(abortController.signal);

        if (error) throw error;

        if (data) {
          const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
          const filteredData = data.filter((item: any) => {
            if (!item.offline_event_locations || item.offline_event_locations.length === 0) return false;
            if (item.end_date && item.end_date < todayStr) return false;
            return true;
          });

          const formatted = filteredData.map((item: any) => {
            const channels = item.offline_event_channels
              ?.map((ec: any) => ec.channels)
              .filter(Boolean) || [];
            const channel = channels[0];

            const formatEventDate = (start: string | null, end: string | null) => {
              if (!start) return "상시";
              return end
                ? `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`
                : start.replaceAll("-", ".");
            };

            return {
              id: item.id,
              title: item.title,
              date: formatEventDate(item.start_date, item.end_date),
              location: item.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
              channelName: channel?.name || "기타",
              channelImage: channel?.image_url || null,
              channelType: channel?.type || null,
              channels,
            };
          });

          const eventsWithMarkerImages = await Promise.all(
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

          setEvents(eventsWithMarkerImages);
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
      if (activeFilters.includes("all")) return true;

      const activeCategories = activeFilters.filter(f => f === "game" || f === "youtuber" || f === "vtuber");
      const activeInteractions = activeFilters.filter(f => f === "subscribed" || f === "bookmarks");

      const catMatched = activeCategories.length === 0 || event.channels?.some((c: any) => 
        c.type && activeCategories.includes(c.type.trim().toLowerCase())
      );
      
      let intMatched = true;

      if (activeInteractions.length > 0) {
        intMatched = activeInteractions.some(f => {
          if (f === "subscribed") return event.channels?.some((c: any) => userSubscribedChannelIds.includes(c.id));
          if (f === "bookmarks") return userBookmarkedEventIds.includes(event.id);
          return false;
        });
      }

      return catMatched && intMatched;
    });
  }, [events, activeFilters, userSubscribedChannelIds, userBookmarkedEventIds]);

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) => {
      if (filterId === "all") return ["all"];
      const withoutAll = prev.filter((f) => f !== "all");

      if (withoutAll.includes(filterId)) {
        const next = withoutAll.filter((f) => f !== filterId);
        return next.length === 0 ? ["all"] : next;
      } else {
        return [...withoutAll, filterId];
      }
    });
  };

  // 3. Initialize Kakao Map and place markers
  useEffect(() => {
    let isMounted = true;
    const hasKakao = typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
    if (!isScriptLoaded && !hasKakao) return;
    if (loading) return;

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
          setDrawnMarkersCount(0);

          const targetEvent = filteredEvents.find((ev) => String(ev.id) === String(eventIdParam));

          const initializeMapAndPlaceMarkers = (centerCoords: any, level: number, initialLoad: boolean) => {
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
              const focusLevel = 4;
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

            kakao.maps.event.addListener(map, "idle", () => {
              if (!isMounted) return;
              if (openOverlayRef.current && !userAdjustedMapView) {
                openOverlayRef.current.setMap(map);
              }
            });

            const targetCoords: any[] = [];
            const targetOverlays: any[] = [];

            filteredEvents.forEach((event) => {
              const createMarkerAndPopup = (result: any, status: any) => {
                if (!isMounted) return;
                if (status === kakao.maps.services.Status.OK) {
                  const coords = new kakao.maps.LatLng(result[0].y, result[0].x);

                  bounds.extend(coords);
                  boundsChanged = true;

                  const markerImage = new kakao.maps.MarkerImage(
                    event.canvasDataUrl,
                    new kakao.maps.Size(68, 76),
                    { offset: new kakao.maps.Point(34, 76) }
                  );

                  const marker = new kakao.maps.Marker({
                    position: coords,
                    image: markerImage,
                    zIndex: 2,
                  });
                  marker.setMap(map);

                  const infoContent = document.createElement("div");
                  infoContent.className = "relative bg-background border border-border shadow-2xl rounded-2xl p-4 min-w-[260px] max-w-[320px] -translate-y-3 cursor-default select-none z-50 animate-in fade-in duration-200";
                  infoContent.innerHTML = `
                    <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-background border-b border-r border-border rotate-45"></div>
                    <div class="flex justify-between items-start gap-4 mb-2">
                      <h4 class="font-bold text-sm text-foreground line-clamp-2 pr-2 leading-snug">${event.title}</h4>
                      <button class="close-btn text-muted-foreground hover:text-foreground text-xl leading-none font-semibold">&times;</button>
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
                        <span class="truncate">${event.location}</span>
                      </p>
                    </div>
                    <button class="detail-btn mt-3.5 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-opacity active:scale-[0.98] shadow-sm">상세 보기</button>
                  `;

                  infoContent.querySelector(".close-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (overlayRevealTimerRef.current) {
                      window.clearTimeout(overlayRevealTimerRef.current);
                      overlayRevealTimerRef.current = null;
                    }
                    infoOverlay.setMap(null);
                    openOverlayRef.current = null;
                  });

                  infoContent.querySelector(".detail-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    window.location.href = `/events/${event.id}`;
                  });

                  const infoOverlay = new kakao.maps.CustomOverlay({
                    position: coords,
                    content: infoContent,
                    yAnchor: 1.35,
                  });

                  if (String(event.id) === String(eventIdParam)) {
                    targetCoords.push(coords);
                    targetOverlays.push(infoOverlay);
                  }

                  kakao.maps.event.addListener(marker, "click", () => {
                    userAdjustedMapView = true;
                    if (overlayRevealTimerRef.current) {
                      window.clearTimeout(overlayRevealTimerRef.current);
                      overlayRevealTimerRef.current = null;
                    }
                    if (openOverlayRef.current) openOverlayRef.current.setMap(null);
                    openOverlayRef.current = null;

                    animateToMarker(coords, () => {
                      if (!isMounted) return;
                      overlayRevealTimerRef.current = null;
                      infoOverlay.setMap(map);
                      openOverlayRef.current = infoOverlay;
                    });
                  });

                  markersRef.current.push(marker);
                  overlaysRef.current.push(infoOverlay);
                  
                  successCount++;
                  setDrawnMarkersCount(successCount);
                }
              };

              geocoder.addressSearch(event.location, (result: any, status: any) => {
                if (!isMounted) return;
                if (status === kakao.maps.services.Status.OK) {
                  createMarkerAndPopup(result, status);
                } else {
                  places.keywordSearch(event.location, (data: any, placeStatus: any) => {
                    if (!isMounted) return;
                    if (placeStatus === kakao.maps.services.Status.OK) {
                      createMarkerAndPopup(data, placeStatus);
                    }
                  });
                }
              });
            });

            setTimeout(() => {
              if (!isMounted) return;
              if (targetCoords.length > 0) {
                userAdjustedMapView = true;
                if (targetCoords.length === 1) {
                  map.setCenter(targetCoords[0]);
                  map.setLevel(4);
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
            }, 1100);
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
  }, [isScriptLoaded, loading, filteredEvents, eventIdParam]);

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Header />
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <Header />

        <main className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">🗺️ 오프라인 행사 지도</h1>
              <p className="text-sm text-muted-foreground">현재 등록된 오프라인 행사의 진행 위치를 한눈에 확인해보세요.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 relative z-50">
              {/* Filter Bubble */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl border transition-all bg-card border-border select-none",
                    isFilterOpen && "bg-muted"
                  )}
                >
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">필터</span>
                </button>

                {isFilterOpen && (
                  <div className="absolute top-full left-0 mt-3 p-4 bg-card border border-border rounded-3xl shadow-2xl z-50 min-w-[240px] flex flex-col gap-4 animate-in fade-in-0 zoom-in-95 duration-150 select-none">
                    <div className="absolute top-[-6px] left-5 w-3 h-3 bg-card border-l border-t border-border transform rotate-45" />

                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5 ml-1">
                        전체
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => toggleFilter("all")}
                          className={cn(
                            "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer select-none",
                            activeFilters.includes("all")
                              ? "border-amber-400 text-amber-500 bg-amber-500/10 font-bold"
                              : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500 bg-muted/40"
                          )}
                        >
                          전체
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5 ml-1">
                        장르 및 주제
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: "game", label: "게임" },
                          { id: "youtuber", label: "유튜버" },
                          { id: "vtuber", label: "버튜버" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => toggleFilter(cat.id)}
                            className={cn(
                              "px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer select-none",
                              activeFilters.includes(cat.id)
                                ? "border-amber-400 text-amber-500 bg-amber-500/10 font-bold"
                                : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500 bg-muted/40"
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User specific Filters */}
              {user && (
                <div className="flex items-center gap-1.5">
                  {[
                    { id: "subscribed", label: "구독 행사만" },
                    { id: "bookmarks", label: "찜한 행사만" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleFilter(cat.id)}
                      className={cn(
                        "px-3.5 py-2 text-sm rounded-xl border transition-all whitespace-nowrap select-none",
                        activeFilters.includes(cat.id)
                          ? "bg-foreground text-background border-foreground font-medium shadow-sm"
                          : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground bg-card"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 bg-muted/50 border border-border px-4 py-2 rounded-xl h-[42px]">
                <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-muted-foreground">행사 위치 <span className="text-foreground">{drawnMarkersCount}</span>곳</span>
              </div>
            </div>
          </div>

          <div className="relative border border-border rounded-2xl bg-muted overflow-hidden shadow-sm h-[650px]">
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
              className={cn("w-full h-[650px] bg-muted transition-opacity duration-700", isMapReady ? "opacity-100" : "opacity-0")} 
              style={{ height: "650px", width: "100%" }} 
            />
          </div>
        </main>
      </div>
    </div>
  );
}
