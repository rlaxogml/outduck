"use client";

import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase/client";
import { MapPin, Search, Filter, Gamepad2, Video, Tv, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

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
  const initialEventId = searchParams.get("eventId");
  const [focusedEventId, setFocusedEventId] = useState<string | null>(initialEventId);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
  });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userBookmarkedEventIds, setUserBookmarkedEventIds] = useState<number[]>([]);
  const [userSubscribedChannelIds, setUserSubscribedChannelIds] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [interactionFilter, setInteractionFilter] = useState<"all" | "subscribed" | "bookmarks" | "ongoing">("all");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
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
        setInteractionFilter("subscribed");
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
    const abortController = new AbortController();

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
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
            const channels = (item.events as any)?.event_channels
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
              baseEventId: item.event_id,
              title: item.title,
              date: formatEventDate(item.start_date, item.end_date),
              rawStartDate: item.start_date,
              location: item.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
              locationsList: item.offline_event_locations?.map((l: any) => l.location).filter(Boolean) || [],
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
      }

      return catMatched && intMatched;
    });
  }, [events, selectedCategories, interactionFilter, userSubscribedChannelIds, userBookmarkedEventIds, focusedEventId]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const toggleInteractionFilter = (filter: "subscribed" | "bookmarks" | "ongoing") => {
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

          const targetEvent = filteredEvents.find((ev) => String(ev.id) === String(focusedEventId));

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

            kakao.maps.event.addListener(map, "idle", () => {
              if (!isMounted) return;
              if (openOverlayRef.current && !userAdjustedMapView) {
                openOverlayRef.current.setMap(map);
              }
            });

            const targetCoords: any[] = [];
            const targetOverlays: any[] = [];

            filteredEvents.forEach((event) => {
              const createMarkerAndPopup = (result: any, status: any, activeLocation: string) => {
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
                        <span class="truncate font-medium text-blue-600 dark:text-blue-400">${activeLocation}</span>
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

                  if (String(event.id) === String(focusedEventId)) {
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

              const currentLocs = event.locationsList && event.locationsList.length > 0 
                ? event.locationsList 
                : [event.location];

              currentLocs.forEach((singleLocation: string) => {
                if (!singleLocation || !singleLocation.trim()) return;
                geocoder.addressSearch(singleLocation.trim(), (result: any, status: any) => {
                  if (!isMounted) return;
                  if (status === kakao.maps.services.Status.OK) {
                    createMarkerAndPopup(result, status, singleLocation.trim());
                  } else {
                    places.keywordSearch(singleLocation.trim(), (data: any, placeStatus: any) => {
                      if (!isMounted) return;
                      if (placeStatus === kakao.maps.services.Status.OK) {
                        createMarkerAndPopup(data, placeStatus, singleLocation.trim());
                      }
                    });
                  }
                });
              });
            });

            setTimeout(() => {
              if (!isMounted) return;
              if (targetCoords.length > 0) {
                userAdjustedMapView = true;
                if (targetCoords.length === 1) {
                  map.setCenter(targetCoords[0]);
                  map.setLevel(3);
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
  }, [isScriptLoaded, loading, filteredEvents, focusedEventId]);

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
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <main className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">🗺️ 오프라인 행사 지도</h1>
              <p className="text-sm text-muted-foreground">현재 등록된 오프라인 행사의 진행 위치를 한눈에 확인해보세요.</p>
            </div>

          </div>

          <div className="relative border border-border rounded-2xl bg-muted overflow-hidden shadow-md h-[650px]">
            {/* New Floating Panel */}
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[60] w-[135px] sm:w-[180px] bg-gradient-to-br from-[#dbeafe] to-[#f6e4ff] dark:from-primary/20 dark:to-primary/20 border border-primary/30 rounded-2xl sm:rounded-[1.75rem] shadow-2xl flex flex-col animate-in slide-in-from-left-4 duration-300 overflow-hidden backdrop-blur-md">
              {/* Master Header Toggle */}
              <div
                className={cn(
                  "p-2.5 sm:p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-primary/10 transition-all bg-white/20 dark:bg-black/10",
                  isSidebarExpanded && "border-b border-primary/10"
                )}
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              >
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground" />
                  <h3 className="text-[12px] sm:text-[13px] font-bold text-foreground tracking-tight">필터 설정</h3>
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
                        className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl border border-pink-400/50 bg-white dark:bg-pink-950/40 text-pink-600 dark:text-pink-300 text-[10px] sm:text-[11px] font-bold shadow-sm transition-all active:scale-[0.98]"
                      >
                        <span className="truncate mr-1">선택 행사만 보기</span>
                        <span className="bg-pink-100 dark:bg-pink-800 px-1.5 py-0.5 rounded-md shrink-0 text-[10px]">✕</span>
                      </button>
                    </div>
                  )}
                  {/* 빠른 필터 Section */}
                  <div className="p-2.5 sm:p-4 border-b border-primary/10">
                    <h4 className="text-[10px] sm:text-[11px] font-bold text-foreground/70 mb-2">빠른 필터</h4>
                    <div className="flex flex-col gap-1 sm:gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col gap-1 sm:gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                        {[
                          { id: "all", label: "전체" },
                          { id: "subscribed", label: "구독 행사" },
                          { id: "bookmarks", label: "찜한 행사" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.id === "all" ? setInteractionFilter("all") : toggleInteractionFilter(item.id as any)}
                            className={cn(
                              "flex items-center justify-center py-1.5 sm:py-2 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all px-0.5 whitespace-nowrap",
                              interactionFilter === item.id
                                ? item.id === "all"
                                  ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                                  : "bg-indigo-100 text-indigo-800 border-2 border-indigo-500 shadow-sm"
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
                  <div className="p-2.5 sm:p-4 border-b border-primary/10">
                    <h4 className="text-[10px] sm:text-[11px] font-bold text-muted-foreground mb-2">장르 및 주제</h4>
                    <div className="flex flex-col gap-1 sm:gap-1.5 animate-in fade-in zoom-in-95 duration-200">
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

                  {/* 추가 필터 (진행 중) */}
                  <div className="p-2.5 sm:p-4">
                    <button
                      onClick={() => toggleInteractionFilter("ongoing")}
                      className={cn(
                        "flex items-center justify-center py-1.5 sm:py-2 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all w-full shadow-sm",
                        interactionFilter === "ongoing"
                          ? "bg-slate-300 text-slate-950 border-2 border-slate-700 shadow-md"
                          : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      진행 중
                    </button>
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
              className={cn("w-full h-[650px] bg-muted transition-opacity duration-700", isMapReady ? "opacity-100" : "opacity-0")}
              style={{ height: "650px", width: "100%" }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
