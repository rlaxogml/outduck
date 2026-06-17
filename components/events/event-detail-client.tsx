"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, linkifyHtml } from "@/lib/utils";
import { Heart, MapPin, Calendar, Clock, Info, User as UserIcon, X, ChevronDown, ChevronLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { CommentsSection } from "@/components/events/comments-section";
import dynamic from "next/dynamic";
import { trackPerformance } from "@/lib/performance";
import { revalidatePaths } from "@/app/actions/events";

const EventNoticesBoard = dynamic(() => import("@/components/events/event-notices-board"), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-muted-foreground text-sm font-bold animate-pulse">불러오는 중...</div>
});

export type ScheduleItem = {
  id: number;
  day_of_week: string | null;
  date: string | null;
  open_time: string | null;
  close_time: string | null;
  reservation_type: string | null;
};

export type EventDetail = {
  id: number;
  event_id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  locationsList: string[];
  image_url: string | null;
  reservation_type: string | null;
  reservation_starts_at: string | null;
  reservation_ends_at: string | null;
  links: { link_name: string; link_url: string }[] | null;
  channels: { id: number; name: string; image_url: string; type: string; owner_id: string; company?: string | null }[];
  images: { id: number; image_url: string; order: number }[];
  schedules: ScheduleItem[];
};

const reservationBadgeColors: Record<string, string> = {
  "예약 필수": "bg-red-500 text-white",
  "예약필수": "bg-red-500 text-white",
  "예약 우대": "bg-orange-500 text-white",
  "예약우대": "bg-orange-500 text-white",
  "일부 예약": "bg-orange-500 text-white",
  "일부예약": "bg-orange-500 text-white",
  "자유 입장": "bg-green-500 text-white",
  "자유입장": "bg-green-500 text-white",
  "티켓팅": "bg-purple-500 text-white",
  "휴무": "bg-slate-500 text-white",
};

export function EventDetailClient({ initialEvent }: { initialEvent: EventDetail }) {
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail>(initialEvent);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userCompData, setUserCompData] = useState<{name: string} | null>(null);
  const [heartAnim, setHeartAnim] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [isMapAvailable, setIsMapAvailable] = useState(true);
  const [activeTab, setActiveTab] = useState<'main' | 'notices'>('main');

  const eventId = event.id;

  useEffect(() => {
    if (!event?.location) return;

    let isMounted = true;
    const checkGeocodability = () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps) return;

      kakao.maps.load(() => {
        if (!isMounted) return;
        const geocoder = new kakao.maps.services.Geocoder();
        const places = new kakao.maps.services.Places();
        
        const locs = event.locationsList && event.locationsList.length > 0
          ? event.locationsList
          : [event.location];

        let geocodableCount = 0;
        let checksCompleted = 0;

        const checkSingleLoc = (loc: string) => {
          geocoder.addressSearch(loc.trim(), (result: any, status: any) => {
            if (!isMounted) return;
            if (status === kakao.maps.services.Status.OK) {
              geocodableCount++;
              nextCheck();
            } else {
              places.keywordSearch(loc.trim(), (data: any, placeStatus: any) => {
                if (!isMounted) return;
                if (placeStatus === kakao.maps.services.Status.OK) {
                  geocodableCount++;
                }
                nextCheck();
              });
            }
          });
        };

        const nextCheck = () => {
          checksCompleted++;
          if (checksCompleted === locs.length) {
            setIsMapAvailable(geocodableCount > 0);
          }
        };

        locs.forEach(loc => checkSingleLoc(loc));
      });
    };

    const interval = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).kakao && (window as any).kakao.maps) {
        clearInterval(interval);
        checkGeocodability();
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [event?.location, event?.locationsList]);

  const isPastEvent = useMemo(() => {
    if (!event) return false;
    const endDateStr = event.end_date;
    const startDateStr = event.start_date;
    if (!endDateStr && !startDateStr) return false;
    const dateStr = endDateStr || startDateStr;
    if (!dateStr) return false;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);

    return targetDate < today;
  }, [event]);

  const searchParams = useSearchParams();
  useEffect(() => {
    const noticeId = searchParams.get("notice_id");
    const activeTabParam = searchParams.get("activeTab");
    const tabParam = searchParams.get("tab");
    
    if (noticeId || activeTabParam === "notices" || tabParam === "notices") {
      setActiveTab("notices");
    }
  }, [searchParams]);

  const isOwner = useMemo(() => {
    if (!user || !event) return false;
    return event.channels.some(ch => {
      if (ch.owner_id === user.id) return true;
      if (userCompData?.name && ch.company === userCompData.name) return true;
      return false;
    });
  }, [user, event, userCompData]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("클립보드에 저장됐습니다");
    }
  };

  // Sort and process schedules
  const processedSchedules = useMemo(() => {
    if (!event?.schedules || event.schedules.length === 0) return [];
    
    const dayOrder: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const koreanDayNames: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

    const isWeekly = event.schedules.some(s => s.day_of_week);
    
    if (isWeekly) {
      return [...event.schedules]
        .filter(s => s.day_of_week)
        .sort((a, b) => {
          const orderA = dayOrder[a.day_of_week!.toLowerCase()] ?? 99;
          const orderB = dayOrder[b.day_of_week!.toLowerCase()] ?? 99;
          return orderA - orderB;
        })
        .map(s => {
          const lowerDay = s.day_of_week!.toLowerCase();
          const label = koreanDayNames[lowerDay] || s.day_of_week!;
          
          let timeText = "시간 정보 없음";
          if (s.reservation_type === "휴무") {
            timeText = "휴무";
          } else if (s.open_time && s.close_time) {
            timeText = `${s.open_time.substring(0, 5)} - ${s.close_time.substring(0, 5)}`;
          }

          return {
            id: s.id,
            label,
            timeText,
            reservationType: s.reservation_type || "자유 입장",
            isOff: s.reservation_type === "휴무",
            dayOfWeek: lowerDay
          };
        });
    } else {
      return [...event.schedules]
        .filter(s => s.date)
        .sort((a, b) => a.date!.localeCompare(b.date!))
        .map(s => {
          const dateParts = s.date!.split("-");
          const label = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : s.date!;
          
          let timeText = "시간 정보 없음";
          if (s.reservation_type === "휴무") {
            timeText = "휴무";
          } else if (s.open_time && s.close_time) {
            timeText = `${s.open_time.substring(0, 5)} - ${s.close_time.substring(0, 5)}`;
          }

          return {
            id: s.id,
            label,
            timeText,
            reservationType: s.reservation_type || "자유 입장",
            isOff: s.reservation_type === "휴무",
            dayOfWeek: undefined as string | undefined
          };
        });
    }
  }, [event?.schedules]);

  // Parallelized Session and Bookmark fetch
  useEffect(() => {
    let active = true;
    const syncSessionAndBookmark = async () => {
      const { data: { session } } = await trackPerformance("유저 세션 조회 (Client)", "auth", () =>
        supabase.auth.getSession()
      );
      if (!active) return;
      setUser(session?.user ?? null);

      if (session?.user) {
        // Query company info and bookmark status in parallel
        const companyPromise = trackPerformance("주최사 데이터 조회 (Client)", "api", () =>
          supabase.from("companies").select("name").eq("user_id", session.user.id).maybeSingle()
        );
        const bookmarkPromise = trackPerformance("관심 북마크 여부 조회 (Client)", "api", () =>
          supabase
            .from("event_bookmarks")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("event_id", event.event_id)
            .maybeSingle()
        );

        const [compRes, bookmarkRes] = await Promise.all([companyPromise, bookmarkPromise]);
        if (!active) return;
        setUserCompData(compRes.data);
        setIsBookmarked(!!bookmarkRes.data);
      }
    };

    syncSessionAndBookmark();
    return () => {
      active = false;
    };
  }, [event.event_id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleBookmark = async () => {
    if (!user) {
      toast("로그인이 필요합니다.");
      return;
    }
    
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 300);

    if (!event?.event_id) return;

    if (isBookmarked) {
      await supabase
        .from("event_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", event.event_id);
      setIsBookmarked(false);
      toast("관심 행사가 해제되었습니다");
    } else {
      await supabase
        .from("event_bookmarks")
        .insert({ user_id: user.id, event_id: event.event_id });
      setIsBookmarked(true);
      toast("관심 행사가 저장되었습니다");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("정말 이 행사를 삭제하시겠습니까? (관련 위치 및 공동 주최 정보도 함께 삭제됩니다)")) return;

    try {
      if (!event?.event_id) throw new Error("이벤트 정보를 찾을 수 없습니다.");

      if (event.image_url && event.image_url.includes("/storage/v1/object/public/event_images/event-main-image/")) {
        const parts = event.image_url.split("event-main-image/");
        const fileName = parts[parts.length - 1];
        if (fileName) {
          try {
            await supabase.storage.from("event_images").remove([`event-main-image/${fileName}`]);
          } catch (storageErr) {
            console.error("Failed to delete event main image from storage:", storageErr);
          }
        }
      }

      if (event.images && event.images.length > 0) {
        const supportPathsToDelete: string[] = [];
        event.images.forEach(img => {
          if (img.image_url && img.image_url.includes("/storage/v1/object/public/event_images/event-support/")) {
            const parts = img.image_url.split("event-support/");
            const fileName = parts[parts.length - 1];
            if (fileName) {
              supportPathsToDelete.push(`event-support/${fileName}`);
            }
          }
        });
        if (supportPathsToDelete.length > 0) {
          try {
            await supabase.storage.from("event_images").remove(supportPathsToDelete);
          } catch (storageErr) {
            console.error("Failed to delete support images from storage:", storageErr);
          }
        }
      }

      await supabase.from("offline_event_locations").delete().eq("offline_event_id", eventId);
      await supabase.from("event_channels").delete().eq("event_id", event.event_id);
      await supabase.from("event_bookmarks").delete().eq("event_id", event.event_id);
      await supabase.from("event_images").delete().eq("event_id", event.event_id);
      
      const { error: delOffErr } = await supabase.from("offline_events").delete().eq("id", eventId);
      if (delOffErr) throw delOffErr;

      const { error: delBaseErr } = await supabase.from("events").delete().eq("id", event.event_id);
      if (delBaseErr) throw delBaseErr;
      
      toast.success("행사가 삭제되었습니다.");
      try {
        const channelIds = event.channels?.map(c => c.id) || [];
        const pathsToRevalidate = [
          "/",
          "/calendar",
          ...channelIds.map(id => `/channels/${id}`)
        ];
        await revalidatePaths(pathsToRevalidate);
      } catch (err) {
        console.error("Revalidation error:", err);
      }
      router.refresh();
      router.push("/");
    } catch (err: any) {
      console.error(err);
      toast.error("행사 삭제 중 오류가 발생했습니다.");
    }
  };

  const formatDateNoYear = (dateStr: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}월 ${day}일`;
    }
    const dotParts = dateStr.split(".");
    if (dotParts.length === 3) {
      const month = parseInt(dotParts[1], 10);
      const day = parseInt(dotParts[2], 10);
      return `${month}월 ${day}일`;
    }
    return dateStr;
  };

  const formatDateWithYear = (dateStr: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${year}년 ${month}월 ${day}일`;
    }
    const dotParts = dateStr.split(".");
    if (dotParts.length === 3) {
      const year = dotParts[0];
      const month = parseInt(dotParts[1], 10);
      const day = parseInt(dotParts[2], 10);
      return `${year}년 ${month}월 ${day}일`;
    }
    return dateStr;
  };

  const formatEventPeriod = (start: string, end: string | null) => {
    if (isPastEvent) {
      if (end && start !== end) {
        return `${formatDateWithYear(start)} ~ ${formatDateWithYear(end)}`;
      }
      return start ? formatDateWithYear(start) : "상시 진행";
    }

    if (end && start !== end) {
      return `${formatDateNoYear(start)} ~ ${formatDateNoYear(end)}`;
    }
    return start ? formatDateNoYear(start) : "상시 진행";
  };

  const formatReservationPeriod = (start: string | null, end: string | null) => {
    const formatDateTime = (isoStr: string | null) => {
      if (!isoStr) return "";
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      const mm = date.getMonth() + 1;
      const dd = date.getDate();
      const hh = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      return `${mm}월 ${dd}일 \u00A0${hh}:${min}분`;
    };

    if (start && end) {
      return `${formatDateTime(start)} ~ ${formatDateTime(end)}`;
    } else if (start) {
      return `${formatDateTime(start)} 부터`;
    } else if (end) {
      return `${formatDateTime(end)} 까지`;
    }
    return "";
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    return time.substring(0, 5);
  };

  const urlRegex = /(https?:\/\/[^\s]+|(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9.-]+\.(?:com|net|org|co\.kr|kr|io|tv|me|link|info|page|xyz|site|run|space|app|co|ee|so)(?:\/[^\s]*)?)/g;
  const descriptionWithLinks = event.description ? event.description.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      let href = part;
      if (!/^https?:\/\//i.test(part)) {
        href = `https://${part}`;
      }
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">{part}</a>;
    }
    return part;
  }) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-12">
      <Header />

      {/* 1. Hero Section Container with floating back and map buttons */}
      <div className="mx-auto max-w-2xl md:max-w-6xl relative mt-2 md:mt-6 mb-4 md:mb-6 px-0">
        {/* Floating Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute left-6 md:-left-24 top-2 md:top-8 z-40 flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-full border border-border/60 bg-white/90 dark:bg-muted/90 text-foreground shadow-md backdrop-blur-sm hover:scale-105 active:scale-95 transition-all"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="w-5 h-5 md:w-8 md:h-8 stroke-[2.5]" />
        </button>

        {/* Floating Map Button (Mobile Only) */}
        {!isPastEvent && isMapAvailable && (
          <button
            onClick={() => router.push(`/map?eventId=${event.id}`)}
            className="absolute right-6 top-2 z-40 flex items-center justify-center w-10 h-10 rounded-full border border-border/60 bg-white/90 dark:bg-muted/90 text-foreground shadow-md backdrop-blur-sm hover:scale-105 active:scale-95 transition-all md:hidden"
            aria-label="위치보기"
          >
            <MapPin className="w-5 h-5 stroke-[2.5] text-primary" />
          </button>
        )}

        {/* Hero Card content */}
        <div className="bg-background border-b border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:rounded-3xl md:border md:border-slate-200/80 overflow-hidden">
          {/* Top Section (Responsive Row-Reverse on Desktop) */}
          <div className="flex flex-col md:flex-row-reverse md:gap-8 md:p-8 md:items-center">
            {/* Right (Image) on Desktop, Top on Mobile */}
            <div className="w-full md:w-[55%] shrink-0 relative">
              <div className="w-full aspect-[16/9] bg-muted relative md:rounded-2xl overflow-hidden md:shadow-md">
                {event.image_url ? (
                  <img 
                    src={event.image_url} 
                    alt={event.title} 
                    className="w-full h-full object-cover cursor-pointer" 
                    onClick={() => setSelectedImage(event.image_url)}
                  />
                ) : (
                   <div className="w-full h-full bg-gradient-to-br from-indigo-500/80 to-purple-600/80" />
                )}
              </div>
            </div>

            {/* Left (Info) on Desktop, Below on Mobile */}
            <div className="w-full md:w-[45%] px-5 md:px-0 pt-0 md:pt-0 pb-6 md:pb-0 flex flex-col justify-center">
              {/* Profile & Name Section (Desktop & Mobile) */}
              {event.channels.length > 0 && (
                <div className="relative -mt-8 md:mt-0 mb-3 md:mb-4 z-20 flex items-center gap-3">
                  <div className="flex items-center -space-x-3">
                    {event.channels.map((channel, i) => (
                      <div 
                        key={channel.id} 
                        className="transition-transform hover:scale-105 hover:z-30 cursor-pointer relative" 
                        style={{ zIndex: 20 - i }}
                        onClick={() => router.push(`/channels/${channel.id}`)}
                      >
                        <div className="w-14 h-14 md:w-12 md:h-12 rounded-full border-4 md:border-2 border-background shadow-md overflow-hidden bg-muted flex items-center justify-center">
                          {channel.image_url ? (
                            <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg md:text-base font-bold text-muted-foreground">{channel.name.charAt(0)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:flex flex-col pt-1 md:pt-0">
                    <span className="text-[15px] md:text-base font-semibold text-muted-foreground">
                      {event.channels.map(c => c.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Desktop-only Title Section */}
              <div className="hidden md:block">
                <div className="flex items-start justify-between md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h1 className="text-xl md:text-2xl font-bold tracking-tight break-keep leading-tight text-foreground">
                        {event.title}
                      </h1>
                      {isPastEvent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-500 dark:bg-slate-805 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 select-none">
                          지나간 행사
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile-only Title, Location, and Heart/Share Buttons */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                    <h1 className="text-xl font-extrabold tracking-tight break-keep leading-tight text-foreground">
                      {event.title}
                    </h1>
                    {isPastEvent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-500 dark:bg-slate-805 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 select-none ml-1">
                        지나간 행사
                      </span>
                    )}
                  </div>
                  
                  <div className="relative pr-20">
                    {event.channels.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5 mb-1 text-[14px] font-semibold text-muted-foreground">
                        <span className="truncate">{event.channels.map(c => c.name).join(', ')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{event.location || "장소 정보 없음"}</span>
                    </div>

                    <div className="absolute right-0 bottom-[-8px] flex items-center gap-0.5">
                      <button
                        onClick={handleBookmark}
                        className={cn(
                          "p-1.5 transition-all active:scale-95 duration-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800",
                          isBookmarked ? "text-pink-500" : "text-[#6a83a8] dark:text-[#8ba3c7]"
                        )}
                        aria-label="관심 저장"
                      >
                        <Heart
                          className={cn(
                            "w-[24px] h-[24px] transition-all",
                            isBookmarked ? "fill-pink-500 stroke-pink-500" : "stroke-current"
                          )}
                        />
                      </button>
                      <button
                        onClick={handleShare}
                        className="p-1.5 text-[#6a83a8] dark:text-[#8ba3c7] hover:text-foreground transition-all active:scale-95 duration-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="공유"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[24px] h-[24px]">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                          <polyline points="16 6 12 2 8 6"></polyline>
                          <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Action Row */}
              {isOwner && (
                <div className="flex gap-2 mt-4 md:mt-6">
                  <button 
                    onClick={() => router.push(`/events/${event.id}/edit`)}
                    className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
                  >
                    행사 수정
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-2 bg-destructive/10 text-destructive text-sm font-semibold rounded-xl hover:bg-destructive/20 transition-colors"
                  >
                    행사 삭제
                  </button>
                </div>
              )}

              {/* Action Buttons Row for PC/Desktop Only (Save, Location, Share) */}
              <div className="hidden md:flex justify-start gap-3 items-center mt-8 pt-0 border-t-0 border-border/40">
                <button 
                  onClick={handleBookmark} 
                  className={cn(
                    "flex flex-row justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold shadow-sm transition-colors",
                    isBookmarked 
                      ? "text-pink-500 bg-pink-500 text-white border-pink-500 hover:bg-pink-600" 
                      : "text-[#3a5378] dark:text-[#a0b8d6] bg-background border-[#4f6b94]/30 dark:border-[#627fa6]/30 hover:bg-[#4f6b94]/10 dark:hover:bg-[#627fa6]/10"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <Heart className={cn("w-4 h-4", isBookmarked ? "fill-white" : "")} />
                  </div>
                  <span className="text-sm font-semibold">{isBookmarked ? "관심저장" : "저장"}</span>
                </button>

                {!isPastEvent && isMapAvailable && (
                  <button 
                    onClick={() => router.push(`/map?eventId=${event.id}`)}
                    className="flex flex-row justify-center gap-2 px-4 py-3 rounded-xl border border-[#4f6b94]/30 dark:border-[#627fa6]/30 bg-background hover:bg-[#4f6b94]/10 dark:hover:bg-[#627fa6]/10 text-[#3a5378] dark:text-[#a0b8d6] text-sm font-semibold shadow-sm transition-colors"
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold">위치보기</span>
                  </button>
                )}

                <button 
                  onClick={handleShare}
                  className="flex flex-row justify-center gap-2 px-4 py-3 rounded-xl border border-[#4f6b94]/30 dark:border-[#627fa6]/30 bg-background hover:bg-[#4f6b94]/10 dark:hover:bg-[#627fa6]/10 text-[#3a5378] dark:text-[#a0b8d6] text-sm font-semibold shadow-sm transition-colors"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold">공유</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Content & Tabs Container */}
      <div className="mx-0 md:mx-auto max-w-2xl md:max-w-6xl bg-background md:rounded-3xl border-y md:border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden">
        
        {/* Tabs Header */}
        <div className="flex items-center border-b border-border/60 bg-background">
          <button
            onClick={() => setActiveTab('main')}
            className={cn(
              "flex-1 py-4 text-[15px] md:text-base font-bold transition-all border-b-[3px]",
              activeTab === 'main' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/80 bg-muted/20"
            )}
          >
            메인
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={cn(
              "flex-1 py-4 text-[15px] md:text-base font-bold transition-all border-b-[3px]",
              activeTab === 'notices' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground/80 bg-muted/20"
            )}
          >
            공지·안내
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 md:p-8">
          
          {/* --- MAIN TAB --- */}
          {activeTab === 'main' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col select-text divide-y divide-slate-100 dark:divide-slate-800/60 pb-0">
                
                {/* 1. 장소 (Location) */}
                {isPastEvent ? (
                  <div className="flex items-start gap-4 py-4 sm:py-5 first:pt-0 -mx-4 px-4 last:pb-0">
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <MapPin className="w-[22px] h-[22px] stroke-[2]" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      {event.locationsList && event.locationsList.length > 0 ? (
                        event.locationsList.map((loc, idx) => (
                          <span key={idx} className="font-semibold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 break-keep leading-snug">
                            {loc}
                          </span>
                        ))
                      ) : (
                        <span className="font-semibold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 break-keep leading-snug">
                          {event.location || "장소 정보 없음"}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={isMapAvailable ? () => router.push(`/map?eventId=${event.id}`) : undefined}
                    className={cn(
                      "flex items-start gap-4 py-4 sm:py-5 first:pt-0 rounded-xl -mx-4 px-4 last:pb-0",
                      isMapAvailable && "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group"
                    )}
                  >
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <MapPin className={cn("w-[22px] h-[22px] stroke-[2]", isMapAvailable && "group-hover:text-primary transition-colors")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-2">
                        {event.locationsList && event.locationsList.length > 0 ? (
                          event.locationsList.map((loc, idx) => (
                            <div key={idx} className="inline-flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "font-semibold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 break-keep leading-snug",
                                isMapAvailable && "group-hover:text-primary transition-colors"
                              )}>
                                {loc}
                              </span>
                              {isMapAvailable && idx === 0 && (
                                <span className="text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-0.5 px-2 rounded font-bold select-none ml-1 opacity-80 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                                  지도보기
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "font-semibold text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 break-keep leading-snug",
                              isMapAvailable && "group-hover:text-primary transition-colors"
                            )}>
                              {event.location || "장소 정보 없음"}
                            </span>
                            {isMapAvailable && (
                              <span className="text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-0.5 px-2 rounded font-bold select-none ml-1 opacity-80 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                                  지도보기
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 행사 기간 (Event Period) */}
                <div 
                  onClick={() => router.push(`/calendar?event=${event.id}`)}
                  className="flex items-start gap-4 py-4 sm:py-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all rounded-xl -mx-4 px-4 group last:pb-0"
                >
                  <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                    <Calendar className="w-[22px] h-[22px] stroke-[2] group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug">
                    <div className="flex items-start gap-x-3 gap-y-1.5 flex-wrap leading-snug">
                      <div className="inline-flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">행사 기간</span>
                        <span className="text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-0.5 px-2 rounded font-bold select-none opacity-80 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0">
                          일정보기
                        </span>
                      </div>
                      
                      <div className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-primary transition-colors break-keep text-[16px] md:text-[18px]">
                        {(() => {
                          const text = formatEventPeriod(event.start_date, event.end_date);
                          const scheduleButton = (event.start_time || event.end_time || processedSchedules.length > 0) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsScheduleExpanded(!isScheduleExpanded);
                              }}
                              className="inline-flex items-center gap-1 text-[12px] font-extrabold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-xl shadow-[0_2px_6px_-2px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] select-none ml-3 animate-in fade-in duration-300 shrink-0"
                            >
                              <span>상세 일정</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isScheduleExpanded ? "rotate-180" : "")} />
                            </button>
                          );

                          return (
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <span>{text}</span>
                              {scheduleButton}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Detailed times/schedules if any */}
                    {(event.start_time || event.end_time || processedSchedules.length > 0) && isScheduleExpanded && (
                      <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/40 max-w-md animate-in slide-in-from-top-1 duration-200">
                          {processedSchedules.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span>
                                {event.start_time ? formatTime(event.start_time) : ""}
                                {event.start_time && event.end_time ? " - " : ""}
                                {event.end_time ? formatTime(event.end_time) : ""}
                              </span>
                            </div>
                          ) : (
                            processedSchedules.map((s, idx) => {
                              const dayOrder: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
                              const nextItem = processedSchedules[idx + 1];
                              let hasGap = false;
                              
                              if (s.dayOfWeek && nextItem && nextItem.dayOfWeek) {
                                const currIdx = dayOrder[s.dayOfWeek];
                                const nextIdx = dayOrder[nextItem.dayOfWeek];
                                if (typeof currIdx === "number" && typeof nextIdx === "number") {
                                  hasGap = (nextIdx - currIdx > 1);
                                }
                              }

                              return (
                                <Fragment key={s.id}>
                                  <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-bold text-slate-500 dark:text-slate-400 select-none w-4">{s.label}</span>
                                    <span className={cn(
                                      "font-semibold tracking-tight",
                                      s.isOff ? "text-red-500 font-extrabold" : "text-slate-700 dark:text-slate-300"
                                    )}>
                                      {s.timeText}
                                    </span>
                                    {s.reservationType !== "자유 입장" && !s.isOff && (
                                      <span className="text-[10.5px] font-bold text-slate-400 select-none tracking-tight opacity-90">
                                        ({s.reservationType})
                                      </span>
                                    )}
                                  </div>
                                  
                                  {hasGap && (
                                    <div className="py-2 flex items-center text-[#4f6b94]/30 max-w-[140px] select-none">
                                      <svg className="w-full h-[5px]" viewBox="0 0 120 5" preserveAspectRatio="none">
                                        <path 
                                          d="M 0 2.5 C 5 5, 5 0, 10 2.5 C 15 5, 15 0, 20 2.5 C 25 5, 25 0, 30 2.5 C 35 5, 35 0, 40 2.5 C 45 5, 45 0, 50 2.5 C 55 5, 55 0, 60 2.5 C 65 5, 65 0, 70 2.5 C 75 5, 75 0, 80 2.5 C 85 5, 85 0, 90 2.5 C 95 5, 95 0, 100 2.5 C 105 5, 105 0, 110 2.5 C 115 5, 115 0, 120 2.5" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          strokeWidth="1.5" 
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    </div>
                                  )}
                                </Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 입장 방식 & 예약 기간 (Admission Method & Reservation Period) */}
                {(event.reservation_type || event.reservation_starts_at || event.reservation_ends_at) && (
                  <div className="flex items-start gap-4 py-4 sm:py-5 last:pb-0">
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <Info className="w-[22px] h-[22px] stroke-[2]" />
                    </div>
                    <div className="flex-1 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug flex flex-wrap items-center gap-x-6 sm:gap-x-10 gap-y-2">
                      {event.reservation_type && (
                        <div className="inline-flex items-center">
                          <span className="font-bold mr-2 text-slate-900 dark:text-slate-100">입장 방식</span>
                          <span className={cn(
                            "px-3 py-0.5 rounded text-[14px] md:text-[15px] font-semibold select-none shadow-sm",
                            reservationBadgeColors[event.reservation_type] || "bg-slate-500 text-white"
                          )}>
                            {event.reservation_type}
                          </span>
                        </div>
                      )}
                      
                      {event.reservation_type && (event.reservation_starts_at || event.reservation_ends_at) && (
                        <span className="text-slate-300 dark:text-slate-700 select-none hidden sm:inline">|</span>
                      )}

                      {(event.reservation_starts_at || event.reservation_ends_at) && (
                        <div className="flex items-start gap-x-2.5 gap-y-1.5 flex-wrap leading-snug">
                          <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0 mt-0.5">예약 기간</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium text-[16px] md:text-[18px]">
                            {(() => {
                              const text = formatReservationPeriod(event.reservation_starts_at || null, event.reservation_ends_at || null);
                              const parts = text.split(" ~ ");
                              if (parts.length === 2) {
                                return (
                                  <span className="flex flex-col">
                                    <span>{parts[0]}</span>
                                    <span className="mt-0.5 pl-1.5">
                                      ~ {parts[1]}
                                    </span>
                                  </span>
                                );
                              }
                              return text;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. 주최자 (Organizer) */}
                {event.channels.length > 0 && (
                  <div className="flex items-start gap-4 py-4 sm:py-5 last:pb-0">
                    <div className="w-6 h-6 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <UserIcon className="w-[22px] h-[22px] stroke-[2]" />
                    </div>
                    <div className="flex-1 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug">
                      <div className="font-bold mb-3 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100">주최자</div>
                      <div className="flex flex-wrap gap-2.5">
                        {event.channels.map(channel => (
                          <button 
                            key={channel.id} 
                            onClick={() => router.push(`/channels/${channel.id}`)}
                            className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full pr-4 p-1 border border-slate-200 dark:border-slate-850 shadow-sm transition-all hover:scale-[1.02]"
                          >
                            <Avatar className="w-7 h-7 border border-background shadow-sm">
                              <AvatarImage src={channel.image_url || undefined} className="object-cover bg-muted" />
                              <AvatarFallback className="bg-muted text-[11px] font-bold">{channel.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[14px] md:text-[15px] font-bold text-slate-800 dark:text-slate-200 pr-0.5">{channel.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. 링크 (Links) - Optional */}
                {event.links && event.links.filter(l => l.link_name.trim() && l.link_url.trim()).length > 0 ? (
                  <div className="flex items-start gap-4 py-4 sm:py-5 last:pb-0">
                    <div className="w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-center">
                      <Link2 className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="flex-1 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100 leading-snug">
                      <div className="font-bold mb-3 text-[16px] md:text-[18px] text-slate-900 dark:text-slate-100">링크</div>
                      <div className="flex flex-col gap-4">
                        {event.links
                          .filter(l => l.link_name.trim() && l.link_url.trim())
                          .map((link, idx) => (
                            <div key={idx} className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-[16px] md:text-[18px]">
                              <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0">
                                {link.link_name}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 shrink-0">:</span>
                              <a
                                href={link.link_url.startsWith("http") ? link.link_url : `https://${link.link_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 dark:text-blue-400 hover:underline font-medium break-all text-[16px] md:text-[18px]"
                              >
                                {link.link_url.replace(/^(https?:\/\/)?(www\.)?/, "")}
                              </a>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>
            </div>
          )}

          {/* --- NOTICES TAB --- */}
          {activeTab === 'notices' && event && (
            <EventNoticesBoard
              eventId={event.event_id}
              eventChannels={event.channels}
              isOwner={isOwner}
              user={user}
            />
          )}
        </div>
      </div>

      {/* 3. Event Description Container */}
      {activeTab === 'main' && event.description && (
        <div className="mx-0 md:mx-auto max-w-2xl md:max-w-6xl bg-background md:rounded-3xl p-6 md:p-10 border-y md:border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 overflow-hidden animate-in fade-in duration-300">
          <h2 className="text-[17px] md:text-xl font-bold mb-6 text-foreground flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full inline-block"></span>
            행사 정보
          </h2>
          {(() => {
            const isHtml = /<[a-z][\s\S]*>/i.test(event.description);
            if (isHtml) {
              return (
                <div 
                  className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 leading-relaxed break-words ql-editor-display"
                  dangerouslySetInnerHTML={{ __html: linkifyHtml(event.description) }}
                />
              );
            }
            return (
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium">
                {descriptionWithLinks}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. Additional Images Card */}
      {activeTab === 'main' && event.images && event.images.length > 0 && (
        <div className="mx-0 md:mx-auto max-w-2xl md:max-w-6xl bg-background md:rounded-3xl py-8 border-y md:border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-12 overflow-hidden animate-in fade-in duration-300">
          <h2 className="text-[17px] md:text-xl font-bold mb-6 px-5 md:px-10 text-foreground flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary rounded-full inline-block"></span>
            행사 사진
          </h2>
          <div className="flex flex-nowrap overflow-x-auto pb-4 snap-x">
            {event.images.map((img, i) => (
              <div 
                key={img.id} 
                className={`shrink-0 snap-start ${i === 0 ? 'pl-5 md:pl-10' : 'pl-4'} ${i === event.images.length - 1 ? 'pr-5 md:pr-10' : ''}`}
              >
                <div className="w-56 md:w-72 aspect-square bg-muted rounded-2xl overflow-hidden shadow-sm border border-border/40">
                  <img 
                    src={img.image_url} 
                    alt="행사 이미지" 
                    className="w-full h-full object-cover transition-transform hover:scale-105 cursor-pointer" 
                    onClick={() => setSelectedImage(img.image_url)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Comments Section */}
      {activeTab === 'main' && (
        <div className="mx-0 md:mx-auto max-w-2xl md:max-w-6xl bg-background md:rounded-3xl p-6 md:p-10 border-y md:border border-border/60 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-12 overflow-hidden animate-in fade-in duration-300">
          <CommentsSection eventId={event.event_id} isOrganizer={isOwner} user={user} />
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src={selectedImage} 
              alt="확대 이미지" 
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .ql-editor-display img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin-top: 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .ql-editor-display a {
          color: #3b82f6 !important;
          text-decoration: underline !important;
          font-weight: bold;
        }
        .ql-editor-display a:hover {
          color: #2563eb !important;
        }
        .ql-editor-display p {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
