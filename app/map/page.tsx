"use client";

import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase/client";
import { MapPin, Search, Filter, Gamepad2, Video, Tv, Check, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
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
  const [interactionFilter, setInteractionFilter] = useState<"all" | "subscribed" | "bookmarks" | "ongoing" | "within_weeks">("all");
  const [weeksThreshold, setWeeksThreshold] = useState<number>(2);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
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
        const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
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
            offline_event_locations!inner(
              location
            )
          `)
          .or(`end_date.gte.${todayStr},end_date.is.null`)
          .abortSignal(abortController.signal);

        if (error) throw error;

        if (data) {
          const formatted = data.map((item: any) => {
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

            filteredEvents.forEach((event) => {
              const createMarkerAndPopup = (result: any, status: any, activeLocation: string) => {
                if (!isMounted) return;
                if (status === kakao.maps.services.Status.OK) {
                  const coords = new kakao.maps.LatLng(result[0].y, result[0].x);

                  bounds.extend(coords);
                  boundsChanged = true;

                  const markerWidth = isMobile ? 54 : 68;
                  const markerHeight = isMobile ? 60 : 76;
                  const offsetX = isMobile ? 27 : 34;
                  const offsetY = isMobile ? 60 : 76;

                  const markerImage = new kakao.maps.MarkerImage(
                    event.canvasDataUrl,
                    new kakao.maps.Size(markerWidth, markerHeight),
                    { offset: new kakao.maps.Point(offsetX, offsetY) }
                  );

                  // 축제(festival) 채널인 경우 마커가 다른 마커보다 항상 위에 노출되도록 zIndex 설정
                  const isFestival = event.channelType === "festival" || event.channels?.some((c: any) => c.type === "festival");
                  const markerZIndex = isFestival ? 10 : 2;

                  const marker = new kakao.maps.Marker({
                    position: coords,
                    image: markerImage,
                    zIndex: markerZIndex,
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
                    <div class="grid grid-cols-10 gap-2 mt-3.5 w-full select-none">
                      <button class="detail-btn col-span-8 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer">상세 보기</button>
                      <button class="zoom-btn col-span-2 h-10 bg-background dark:bg-slate-900 border border-border/80 hover:bg-muted text-foreground rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                      </button>
                    </div>
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

                  infoContent.querySelector(".zoom-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    map.setLevel(3, {
                      anchor: coords,
                      animate: { duration: 320 }
                    });
                  });

                  const infoOverlay = new kakao.maps.CustomOverlay({
                    position: coords,
                    content: infoContent,
                    yAnchor: 1.35,
                    zIndex: 20,
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

                    // 1. Smoothly pan to the marker without zooming
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

                    // 2. Update and synchronize popup buttons for correct scale view
                    if (!isMounted) return;
                    const currentLevel = map.getLevel();
                    const isZoomedOut = currentLevel > 3;
                    const dBtn = infoContent.querySelector(".detail-btn") as HTMLButtonElement;
                    const zBtn = infoContent.querySelector(".zoom-btn") as HTMLButtonElement;
                    if (dBtn && zBtn) {
                      if (isZoomedOut) {
                        dBtn.className = "detail-btn col-span-8 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer";
                        zBtn.style.display = "flex";
                      } else {
                        dBtn.className = "detail-btn col-span-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all duration-200 active:scale-[0.98] shadow-sm flex items-center justify-center cursor-pointer";
                        zBtn.style.display = "none";
                      }
                    }

                    infoOverlay.setMap(map);
                    openOverlayRef.current = infoOverlay;
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
              
              // 1. Sync the Kakao Map canvas to the DOM size first
              map.relayout();
              
              // 2. Allow a brief 50ms delay for the rendering engine to register the new dimensions,
              // then perform the bounding and centering calculations on the updated canvas bounds.
              setTimeout(() => {
                if (!isMounted) return;

                if (targetCoords.length > 0) {
                  userAdjustedMapView = true;
                  if (targetCoords.length === 1) {
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
                    
                    // Ensure startup popup matches level 3 styling on first load
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
              }, 50);
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
                    map.setCenter(targetMarker.getPosition());
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 py-2 md:px-0 md:py-0 mb-1 md:mb-2 shrink-0">
            <div className="space-y-1">
              <h1 className="text-sm md:text-3xl font-extrabold tracking-tight">🗺️ 오프라인 행사 지도</h1>
            </div>
          </div>

          {/* Mobile Flat Collapsible Premium Filter Widget */}
          <div className="block md:hidden shrink-0 px-4 pb-3">
            {isFilterOpen ? (
              /* EXPANDED FILTER PANEL */
              <div className="bg-gradient-to-br from-[#dbeafe] to-[#f6e4ff] dark:from-slate-900/95 dark:to-slate-800/95 border border-primary/30 rounded-2xl shadow-xl p-3.5 flex flex-col gap-3.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                  {/* Header Row */}
                  <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsFilterOpen(false)}>
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-[13px] font-extrabold text-foreground tracking-tight">필터 설정</h3>
                    </div>
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  {/* Horizontal Sections */}
                  <div className="space-y-3.5 pt-1.5 border-t border-primary/10">
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
                          { id: "subscribed", label: "구독 행사" },
                          { id: "bookmarks", label: "찜한 행사" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleInteractionFilter(item.id as any)}
                            className={cn(
                              "flex items-center justify-center px-3.5 py-1.5 text-[10px] font-bold rounded-full border transition-all shadow-sm select-none",
                              interactionFilter === item.id
                                ? "border-indigo-500 bg-indigo-100 text-indigo-800 font-extrabold"
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
                  className="w-fit bg-gradient-to-br from-[#dbeafe] to-[#f6e4ff] dark:from-slate-900/90 dark:to-slate-800/90 border border-primary/30 rounded-full shadow-md px-4 py-2 flex items-center gap-2 cursor-pointer select-none backdrop-blur-md animate-in fade-in duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[12px] font-extrabold text-foreground tracking-tight">필터 설정</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
                </div>
              )}
            </div>

            <div className={cn("relative flex-1 w-[calc(100%+32px)] md:w-full border-t md:border border-border rounded-none md:rounded-2xl bg-muted overflow-hidden shadow-none md:shadow-md md:h-[650px] mx-[-16px] md:mx-0 transition-all duration-300")}>
              {/* New Floating Panel (PC only) */}
              <div className="hidden md:flex absolute top-2 left-2 sm:top-4 sm:left-4 z-[60] w-[135px] sm:w-[180px] bg-gradient-to-br from-[#dbeafe] to-[#f6e4ff] dark:from-primary/20 dark:to-primary/20 border border-primary/30 rounded-2xl sm:rounded-[1.75rem] shadow-2xl flex flex-col animate-in slide-in-from-left-4 duration-300 overflow-hidden backdrop-blur-md">
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
                  <div className="p-2.5 sm:p-4 border-b border-primary/10">
                    <h4 className="text-[11px] sm:text-[12px] font-bold text-foreground/70 mb-2.5">빠른 필터</h4>
                    <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                        {[
                          { id: "all", label: "전체" },
                          { id: "subscribed", label: "구독 행사" },
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
              @media (max-width: 767px) {
                .map-outer-container {
                  height: calc(100vh - env(safe-area-inset-bottom, 0px) - 56px) !important;
                  overflow: hidden !important;
                }
                .map-inner-container {
                  height: calc(100vh - env(safe-area-inset-bottom, 0px) - 112px) !important;
                  overflow: hidden !important;
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
                <Maximize2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs tracking-tight">전체 보기</span>
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
