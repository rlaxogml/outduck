"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { supabase } from "@/lib/supabase/client";
import { MapPin, Search } from "lucide-react";

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
  const mapRef = useRef<any>(null);

  const cleanKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "").trim();

  // 1. Fetch events from Supabase and pre-generate marker base64 images
  useEffect(() => {
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
            location,
            image_url,
            offline_event_channels(
              channels(
                id,
                name,
                image_url
              )
            )
          `)
          .not("location", "is", null);

        if (error) throw error;

        if (data) {
          const formatted = data.map((item: any) => {
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
              location: item.location,
              channelName: channel?.name || "기타",
              channelImage: channel?.image_url || null,
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="63" viewBox="0 0 56 63">
                    <polygon points="28,63 18,47 38,47" fill="#FBBF24" stroke="#D97706" stroke-width="2" />
                    <circle cx="28" cy="28" r="25" fill="#FBBF24" stroke="#D97706" stroke-width="2.5" />
                    <circle cx="28" cy="28" r="22" fill="#FEF3C7" />
                    <text x="28" y="34" font-family="sans-serif" font-size="18" font-weight="bold" fill="#B45309" text-anchor="middle">
                      ${ev.channelName.slice(0, 1)}
                    </text>
                  </svg>
                `;

                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = 64;
                  canvas.height = 72;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) {
                    resolve("data:image/svg+xml;charset=UTF-8," + encodeURIComponent(fallbackSvg));
                    return;
                  }

                  // 1. Draw bottom arrow
                  ctx.beginPath();
                  ctx.moveTo(32, 72);
                  ctx.lineTo(22, 54);
                  ctx.lineTo(42, 54);
                  ctx.closePath();
                  ctx.fillStyle = "#FBBF24";
                  ctx.strokeStyle = "#D97706";
                  ctx.lineWidth = 2;
                  ctx.fill();
                  ctx.stroke();

                  // 2. Draw yellow circle border
                  ctx.beginPath();
                  ctx.arc(32, 32, 28, 0, Math.PI * 2);
                  ctx.closePath();
                  ctx.fillStyle = "#FBBF24";
                  ctx.strokeStyle = "#D97706";
                  ctx.lineWidth = 3;
                  ctx.fill();
                  ctx.stroke();

                  // 3. Clip and draw image
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(32, 32, 25, 0, Math.PI * 2);
                  ctx.closePath();
                  ctx.clip();
                  ctx.drawImage(img, 7, 7, 50, 50);
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
      } catch (err) {
        console.error("Error fetching events for map:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // 2. Initialize Kakao Map and place markers
  useEffect(() => {
    const hasKakao = typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
    if (!isScriptLoaded && !hasKakao) return;
    if (loading) return;

    const interval = setInterval(() => {
      const kakao = window.kakao;
      if (kakao?.maps && typeof kakao.maps.load === "function") {
        clearInterval(interval);

        kakao.maps.load(() => {
          const container = document.getElementById("map-container");
          if (!container) return;

          container.innerHTML = "";

          const defaultCenter = new kakao.maps.LatLng(37.566535, 126.9779692);
          const geocoder = new kakao.maps.services.Geocoder();
          const places = new kakao.maps.services.Places();
          const bounds = new kakao.maps.LatLngBounds();
          let boundsChanged = false;
          let openOverlay: any = null;
          let overlayRevealTimer: number | null = null;
          let userAdjustedMapView = false;

          // Search for any target event right away to center the map immediately
          const targetEvent = events.find((ev) => String(ev.id) === String(eventIdParam));

          const initializeMapAndPlaceMarkers = (centerCoords: any, level: number) => {
            const options = {
              center: centerCoords,
              level: level,
            };

            const map = new kakao.maps.Map(container, options);
            mapRef.current = map;

            setTimeout(() => {
              map.relayout();
              map.setCenter(centerCoords);
            }, 300);

            const animateToMarker = (coords: any, done?: () => void) => {
              const currentLevel = map.getLevel();
              const focusLevel = 4;
              const panMs = 360;
              const zoomMs = 320;

              map.panTo(coords);
              window.setTimeout(() => {
                if (currentLevel !== focusLevel) {
                  map.setLevel(focusLevel, {
                    anchor: coords,
                    animate: { duration: zoomMs },
                  });
                }
                if (done) {
                  window.setTimeout(done, currentLevel !== focusLevel ? zoomMs + 20 : 20);
                }
              }, panMs);
            };

            kakao.maps.event.addListener(map, "idle", () => {
              if (openOverlay && !userAdjustedMapView) {
                openOverlay.setMap(map);
              }
            });

            const targetCoords: any[] = [];
            const targetOverlays: any[] = [];

            events.forEach((event) => {
              const createMarkerAndPopup = (result: any, status: any) => {
                if (status === kakao.maps.services.Status.OK) {
                  const coords = new kakao.maps.LatLng(result[0].y, result[0].x);

                  bounds.extend(coords);
                  boundsChanged = true;

                  // 1. Native Marker with dynamic Canvas/SVG MarkerImage
                  const markerImage = new kakao.maps.MarkerImage(
                    event.canvasDataUrl,
                    new kakao.maps.Size(52, 58),
                    { offset: new kakao.maps.Point(26, 58) }
                  );

                  const marker = new kakao.maps.Marker({
                    position: coords,
                    image: markerImage,
                    zIndex: 2,
                  });
                  marker.setMap(map);

                  // 2. Info bubble popup overlay
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
                    if (overlayRevealTimer) {
                      window.clearTimeout(overlayRevealTimer);
                      overlayRevealTimer = null;
                    }
                    infoOverlay.setMap(null);
                    openOverlay = null;
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
                    if (overlayRevealTimer) {
                      window.clearTimeout(overlayRevealTimer);
                      overlayRevealTimer = null;
                    }
                    if (openOverlay) openOverlay.setMap(null);
                    openOverlay = null;

                    animateToMarker(coords, () => {
                      overlayRevealTimer = null;
                      infoOverlay.setMap(map);
                      openOverlay = infoOverlay;
                    });
                  });
                }
              };

              geocoder.addressSearch(event.location, (result: any, status: any) => {
                if (status === kakao.maps.services.Status.OK) {
                  createMarkerAndPopup(result, status);
                } else {
                  places.keywordSearch(event.location, (data: any, placeStatus: any) => {
                    if (placeStatus === kakao.maps.services.Status.OK) {
                      createMarkerAndPopup(data, placeStatus);
                    }
                  });
                }
              });
            });

            setTimeout(() => {
              if (targetCoords.length > 0) {
                userAdjustedMapView = true;
                if (targetCoords.length === 1) {
                  map.setCenter(targetCoords[0]);
                  map.setLevel(4);
                  targetOverlays[0].setMap(map);
                  openOverlay = targetOverlays[0];
                } else {
                  const specificBounds = new kakao.maps.LatLngBounds();
                  targetCoords.forEach((c) => specificBounds.extend(c));
                  map.setBounds(specificBounds);
                }
              } else if (boundsChanged && !userAdjustedMapView) {
                map.setBounds(bounds);
              }
            }, 1100);
          };

          if (targetEvent) {
            // Geocode target event location immediately to center the map without any jumping/flashing
            geocoder.addressSearch(targetEvent.location, (result: any, status: any) => {
              if (status === kakao.maps.services.Status.OK) {
                const centerCoords = new kakao.maps.LatLng(result[0].y, result[0].x);
                initializeMapAndPlaceMarkers(centerCoords, 4);
              } else {
                places.keywordSearch(targetEvent.location, (data: any, placeStatus: any) => {
                  if (placeStatus === kakao.maps.services.Status.OK) {
                    const centerCoords = new kakao.maps.LatLng(data[0].y, data[0].x);
                    initializeMapAndPlaceMarkers(centerCoords, 4);
                  } else {
                    initializeMapAndPlaceMarkers(defaultCenter, 5);
                  }
                });
              }
            });
          } else {
            initializeMapAndPlaceMarkers(defaultCenter, 5);
          }
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isScriptLoaded, loading, events, eventIdParam]);

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
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight">🗺️ 오프라인 행사 지도</h1>
              <p className="text-sm text-muted-foreground">현재 등록된 오프라인 행사의 진행 위치를 한눈에 확인해보세요.</p>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 border border-border px-4 py-2 rounded-xl">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-muted-foreground">행사 위치 <span className="text-foreground">{events.length}</span>곳</span>
            </div>
          </div>

          <div className="relative border border-border rounded-2xl bg-muted overflow-hidden shadow-sm h-[650px]">
            {loading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-foreground">행사 및 지도를 불러오는 중...</p>
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="absolute inset-0 bg-background/80 z-50 flex flex-col items-center justify-center text-center p-6">
                <div className="h-16 w-16 items-center justify-center rounded-full bg-muted flex mb-3 text-muted-foreground">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-foreground">등록된 오프라인 행사가 없습니다.</h3>
                <p className="text-xs text-muted-foreground mt-1">지도를 표시할 수 있는 행사가 등록되면 이곳에서 볼 수 있습니다.</p>
              </div>
            )}

            <div id="map-container" className="w-full h-[650px] bg-muted" style={{ height: "650px", width: "100%" }} />
          </div>
        </main>
      </div>

      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanKey}&libraries=services&autoload=false`}
        onLoad={() => setIsScriptLoaded(true)}
        strategy="afterInteractive"
      />
    </div>
  );
}
