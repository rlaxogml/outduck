"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Search, Upload, X, Plus, Check, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type Channel = {
  id: number;
  name: string;
  image_url: string | null;
  type: string | null;
};

const TimeInputPair = ({ 
  hour, 
  minute, 
  onHourChange, 
  onMinuteChange,
  size = "default"
}: { 
  hour: string, 
  minute: string, 
  onHourChange: (v: string) => void, 
  onMinuteChange: (v: string) => void,
  size?: "default" | "sm"
}) => {
  const hourRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 23) val = "23";
    onHourChange(val);
    if (val.length === 2) {
      minRef.current?.focus();
    }
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 59) val = "59";
    onMinuteChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isMin: boolean) => {
    if (e.key === "Backspace" && isMin && minute === "") {
      hourRef.current?.focus();
    }
  };

  const isSm = size === "sm";

  return (
    <div className={`flex items-center justify-center bg-white dark:bg-muted/20 border-2 border-border/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all rounded-xl shadow-sm select-none shrink-0
      ${isSm ? "h-9.5 w-[96px] px-2" : "h-11 w-[118px] px-3"}`}
    >
      <input
        ref={hourRef}
        placeholder="__"
        className={`bg-transparent border-0 p-0 text-center font-mono font-extrabold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 shrink-0
          ${isSm ? "w-[20px] text-[13.5px]" : "w-[26px] text-[16px]"}`}
        value={hour}
        onChange={handleHourChange}
        maxLength={2}
      />
      <span className={`text-foreground/45 font-black shrink-0 select-none mx-1 relative bottom-[0.5px]
        ${isSm ? "text-[14px]" : "text-[17px]"}`}
      >:</span>
      <input
        ref={minRef}
        placeholder="__"
        className={`bg-transparent border-0 p-0 text-center font-mono font-extrabold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 shrink-0
          ${isSm ? "w-[20px] text-[13.5px]" : "w-[26px] text-[16px]"}`}
        value={minute}
        onChange={handleMinChange}
        onKeyDown={(e) => handleKeyDown(e, true)}
        maxLength={2}
      />
      <span className={`text-muted-foreground font-bold shrink-0 select-none ml-1
        ${isSm ? "text-[11px]" : "text-[13px]"}`}
      >분</span>
    </div>
  );
};

const DateInputTriple = ({ 
  year, 
  month, 
  day, 
  onYearChange, 
  onMonthChange, 
  onDayChange 
}: { 
  year: string, 
  month: string, 
  day: string, 
  onYearChange: (v: string) => void, 
  onMonthChange: (v: string) => void, 
  onDayChange: (v: string) => void 
}) => {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    onYearChange(val);
    if (val.length === 4) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 12) val = "12";
    onMonthChange(val);
    if (val.length === 2) {
      dayRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 31) val = "31";
    onDayChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "month" | "day") => {
    if (e.key === "Backspace") {
      if (field === "month" && month === "") {
        yearRef.current?.focus();
      } else if (field === "day" && day === "") {
        monthRef.current?.focus();
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={yearRef}
          placeholder="----"
          className="w-16 sm:w-20 h-10 sm:h-11 bg-white border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={year}
          onChange={handleYearChange}
          maxLength={4}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground shrink-0">년</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={monthRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-white border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, "month")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground shrink-0">월</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={dayRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-white border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, "day")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground shrink-0">일</span>
      </div>
    </div>
  );
};

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [ownedChannels, setOwnedChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
  });

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [isManualLocation, setIsManualLocation] = useState(false);
  const currentYear = new Date().getFullYear().toString();
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");
  const [isAlways, setIsAlways] = useState(false);
  const [startTimeHour, setStartTimeHour] = useState("");
  const [startTimeMin, setStartTimeMin] = useState("");
  const [endTimeHour, setEndTimeHour] = useState("");
  const [endTimeMin, setEndTimeMin] = useState("");
  const [reservationType, setReservationType] = useState("자유 입장");
  const [showResSchedule, setShowResSchedule] = useState(false);
  const [resStartYear, setResStartYear] = useState("");
  const [resStartMonth, setResStartMonth] = useState("");
  const [resStartDay, setResStartDay] = useState("");
  const [resStartHour, setResStartHour] = useState("");
  const [resStartMin, setResStartMin] = useState("");
  const [resEndYear, setResEndYear] = useState("");
  const [resEndMonth, setResEndMonth] = useState("");
  const [resEndDay, setResEndDay] = useState("");
  const [resEndHour, setResEndHour] = useState("");
  const [resEndMin, setResEndMin] = useState("");
  const [isResAlways, setIsResAlways] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hostId, setHostId] = useState<string>("");
  const [coHosts, setCoHosts] = useState<Channel[]>([]);
  const [eventBaseId, setEventBaseId] = useState<number | null>(null);

  // Detailed schedule toggles
  const [showScheduleByDay, setShowScheduleByDay] = useState(false);
  const [showScheduleByDate, setShowScheduleByDate] = useState(false);

  // Day of week detailed schedule states
  const [daySchedules, setDaySchedules] = useState<{
    [key: string]: {
      enabled: boolean;
      openHour: string;
      openMin: string;
      closeHour: string;
      closeMin: string;
      reservationType: string;
    }
  }>({
    mon: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    tue: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    wed: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    thu: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    fri: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    sat: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" },
    sun: { enabled: true, openHour: "", openMin: "", closeHour: "", closeMin: "", reservationType: "자유 입장" }
  });

  const updateDaySchedule = (key: string, field: string, value: any) => {
    setDaySchedules(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };
  
  const handleDayToggle = (key: string) => {
    setDaySchedules(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled }
    }));
  };

  const koreanDayMap: { [key: string]: string } = {
    mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일"
  };

  // Specific date detailed schedule states
  // Specific date detailed schedule states
  const [dateSchedules, setDateSchedules] = useState<{
    id: string;
    year: string;
    month: string;
    day: string;
    openHour: string;
    openMin: string;
    closeHour: string;
    closeMin: string;
    reservationType: string;
  }[]>([]);

  const addDateRow = () => {
    setDateSchedules(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        year: "", month: "", day: "",
        openHour: "", openMin: "",
        closeHour: "", closeMin: "",
        reservationType: "자유 입장"
      }
    ]);
  };
  
  const removeDateRow = (id: string) => {
    setDateSchedules(prev => prev.filter(r => r.id !== id));
  };
  
  const updateDateSchedule = (id: string, field: string, value: any) => {
    setDateSchedules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const autoPopulateSchedules = (type: "day" | "date") => {
    const defOpenH = startTimeHour || "";
    const defOpenM = startTimeMin || "";
    const defCloseH = endTimeHour || "";
    const defCloseM = endTimeMin || "";
    const hasStart = startYear && startMonth && startDay;
    const hasEnd = endYear && endMonth && endDay;

    if (type === "day") {
      const newDaySchedules = {
        mon: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        tue: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        wed: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        thu: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        fri: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        sat: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" },
        sun: { enabled: true, openHour: defOpenH, openMin: defOpenM, closeHour: defCloseH, closeMin: defCloseM, reservationType: "자유 입장" }
      };

      if (isAlways) {
        Object.keys(newDaySchedules).forEach(k => {
          newDaySchedules[k as keyof typeof newDaySchedules].enabled = true;
        });
      } else if (hasStart) {
        const sDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay), 0, 0, 0, 0);
        if (hasEnd) {
          const eDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay), 0, 0, 0, 0);
          if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime()) && sDate <= eDate) {
            const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 6) {
              Object.keys(newDaySchedules).forEach(k => {
                newDaySchedules[k as keyof typeof newDaySchedules].enabled = true;
              });
            } else {
              let curr = new Date(sDate);
              let popIter = 0;
              while (curr.getTime() <= eDate.getTime() && popIter < 14) {
                const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
                const dKey = map[curr.getDay()];
                newDaySchedules[dKey as keyof typeof newDaySchedules].enabled = true;
                curr.setDate(curr.getDate() + 1);
                popIter++;
              }
            }
          }
        } else if (!isNaN(sDate.getTime())) {
          const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
          newDaySchedules[map[sDate.getDay()] as keyof typeof newDaySchedules].enabled = true;
        }
      } else {
        Object.keys(newDaySchedules).forEach(k => {
          newDaySchedules[k as keyof typeof newDaySchedules].enabled = true;
        });
      }
      setDaySchedules(newDaySchedules);
    } else if (type === "date") {
      if (hasStart && hasEnd) {
        const sStr = `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`;
        const eStr = `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}`;
        const sDate = new Date(sStr);
        const eDate = new Date(eStr);
        if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime()) && sDate <= eDate) {
          const dates = [];
          let curr = new Date(sDate);
          let count = 0;
          while (curr <= eDate && count < 31) {
            dates.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
            count++;
          }
          const newRows = dates.map(d => ({
            id: Math.random().toString(36).substr(2, 9),
            year: d.getFullYear().toString(),
            month: (d.getMonth() + 1).toString(),
            day: d.getDate().toString(),
            openHour: defOpenH,
            openMin: defOpenM,
            closeHour: defCloseH,
            closeMin: defCloseM,
            reservationType: "자유 입장"
          }));
          setDateSchedules(newRows);
        }
      } else if (hasStart) {
        setDateSchedules([{
          id: Math.random().toString(36).substr(2, 9),
          year: startYear,
          month: startMonth,
          day: startDay,
          openHour: defOpenH,
          openMin: defOpenM,
          closeHour: defCloseH,
          closeMin: defCloseM,
          reservationType: "자유 입장"
        }]);
      }
    }
  };

  const getVisibleDayKeys = () => {
    if (isAlways) return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const hasStart = startYear && startMonth && startDay;
    const hasEnd = endYear && endMonth && endDay;
    if (!hasStart) return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    
    const sDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay), 0, 0, 0, 0);
    if (isNaN(sDate.getTime())) return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    
    if (!hasEnd) {
      const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      return [map[sDate.getDay()]];
    }
    
    const eDate = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay), 0, 0, 0, 0);
    if (isNaN(eDate.getTime()) || sDate > eDate) return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    
    const diffDays = Math.ceil(Math.abs(eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 6) return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    
    const keys = new Set<string>();
    let curr = new Date(sDate);
    let iterCount = 0;
    while (curr.getTime() <= eDate.getTime() && iterCount < 14) {
      const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      keys.add(map[curr.getDay()]);
      curr.setDate(curr.getDate() + 1);
      iterCount++;
    }
    const ordered = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    return ordered.filter(k => keys.has(k));
  };

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCoHostSearch, setShowCoHostSearch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Address search states
  const [addrResults, setAddrResults] = useState<any[]>([]);
  const [isSearchingAddr, setIsSearchingAddr] = useState(false);

  // Wait for global Kakao Map Script to load
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

  // Load address autocomplete search
  useEffect(() => {
    if (isManualLocation || !locationInput || locationInput.trim().length < 2) {
      setAddrResults([]);
      return;
    }

    const timer = setTimeout(() => {
      if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) return;

      const performSearch = () => {
        if (!window.kakao.maps.services) return;
        const places = new window.kakao.maps.services.Places();
        const geocoder = new window.kakao.maps.services.Geocoder();

        setIsSearchingAddr(true);
        places.keywordSearch(locationInput, (data: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
            const formatted = data.map((item: any) => ({
              address: item.address_name,
              placeName: item.place_name,
            }));
            setAddrResults(formatted);
            setIsSearchingAddr(false);
          } else {
            geocoder.addressSearch(locationInput, (result: any, addrStatus: any) => {
              if (addrStatus === window.kakao.maps.services.Status.OK && result && result.length > 0) {
                const formatted = result.map((item: any) => ({
                  address: item.address_name,
                  placeName: item.address_name,
                }));
                setAddrResults(formatted);
              } else {
                setAddrResults([]);
              }
              setIsSearchingAddr(false);
            });
          }
        });
      };

      if (window.kakao.maps.services) {
        performSearch();
      } else {
        window.kakao.maps.load(performSearch);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [locationInput, isManualLocation, isScriptLoaded]);

  const selectAddress = (addr: string) => {
    setLocations(prev => [...prev, addr]);
    setLocationInput("");
    setAddrResults([]);
    toast.success("장소가 등록 되었습니다");
  };

  // Auth + Fetch Owned Channels + Fetch Event Data
  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("로그인이 필요합니다.");
          router.push("/");
          return;
        }
        setUser(session.user);

        // Fetch owned channels
        const { data: channels, error: channelsError } = await supabase
          .from("channels")
          .select("id, name, image_url, type")
          .eq("owner_id", session.user.id);

        if (channelsError) throw channelsError;
        setOwnedChannels(channels || []);

        // Fetch Event Data to prepopulate
        if (eventId) {
          const { data: event, error: eventError } = await supabase
            .from("offline_events")
            .select(`
              id, event_id, title, description, start_date, end_date, start_time, end_time, image_url, reservation_type,
              reservation_starts_at, reservation_ends_at, is_reservation_always,
              events (
                event_channels ( channels ( id, name, type, image_url, owner_id ) )
              ),
              offline_event_locations ( location )
            `)
            .eq("id", eventId)
            .maybeSingle();

          if (eventError) throw eventError;

          if (event) {
            setEventBaseId(event.event_id);
            const eventObj = event.events as any;
            const eventHost = eventObj?.event_channels?.[0]?.channels as any;
            if (eventHost && eventHost.owner_id !== session.user.id) {
              toast.error("수정 권한이 없습니다.");
              router.push(`/events/${eventId}`);
              return;
            }

            setTitle(event.title || "");
            setDescription(event.description || "");
            setImageUrl(event.image_url || null);
            
            if (event.start_date) {
              const [y, m, d] = event.start_date.split("-");
              setStartYear(y);
              setStartMonth(m);
              setStartDay(d);
              setIsAlways(false);
            } else {
              setIsAlways(true);
            }
            if (event.end_date) {
              const [y, m, d] = event.end_date.split("-");
              setEndYear(y);
              setEndMonth(m);
              setEndDay(d);
            }

            if (event.start_time) {
              const [h, m] = event.start_time.split(":");
              setStartTimeHour(h);
              setStartTimeMin(m);
            }
            if (event.end_time) {
              const [h, m] = event.end_time.split(":");
              setEndTimeHour(h);
              setEndTimeMin(m);
            }

            setReservationType(event.reservation_type || "자유 입장");
            setIsResAlways(event.is_reservation_always || false);

            if (event.reservation_starts_at) {
              setShowResSchedule(true);
              const dateObj = new Date(event.reservation_starts_at);
              setResStartYear(String(dateObj.getFullYear()));
              setResStartMonth(String(dateObj.getMonth() + 1).padStart(2, "0"));
              setResStartDay(String(dateObj.getDate()).padStart(2, "0"));
              setResStartHour(String(dateObj.getHours()).padStart(2, "0"));
              setResStartMin(String(dateObj.getMinutes()).padStart(2, "0"));
            }
            if (event.reservation_ends_at) {
              setShowResSchedule(true);
              const dateObj = new Date(event.reservation_ends_at);
              setResEndYear(String(dateObj.getFullYear()));
              setResEndMonth(String(dateObj.getMonth() + 1).padStart(2, "0"));
              setResEndDay(String(dateObj.getDate()).padStart(2, "0"));
              setResEndHour(String(dateObj.getHours()).padStart(2, "0"));
              setResEndMin(String(dateObj.getMinutes()).padStart(2, "0"));
            }

            if (event.offline_event_locations) {
              setLocations(event.offline_event_locations.map((l: any) => l.location));
            }

            if (eventObj && eventObj.event_channels) {
              const mappedChannels = eventObj.event_channels
                .map((ec: any) => ec.channels)
                .filter(Boolean);

              if (mappedChannels.length > 0) {
                setHostId(mappedChannels[0].id.toString());
                setCoHosts(mappedChannels.slice(1));
              }
            }

            // 🔄 Fetch existing detailed schedules from event_schedules table
            const { data: schedList, error: schedError } = await supabase
              .from("event_schedules")
              .select("*")
              .eq("event_id", event.event_id);

            if (!schedError && schedList && schedList.length > 0) {
              // Determine mode
              const dayRows = schedList.filter(s => s.day_of_week);
              const dateRows = schedList.filter(s => s.date);

              if (dayRows.length > 0) {
                setShowScheduleByDay(true);
                setDaySchedules(prev => {
                  const next = { ...prev };
                  dayRows.forEach(row => {
                    const key = row.day_of_week.toLowerCase();
                    if (next[key]) {
                      const [oH, oM] = (row.open_time || "").split(":");
                      const [cH, cM] = (row.close_time || "").split(":");
                      next[key] = {
                        enabled: true,
                        openHour: oH || "",
                        openMin: oM || "",
                        closeHour: cH || "",
                        closeMin: cM || "",
                        reservationType: row.reservation_type || "자유 입장"
                      };
                    }
                  });
                  return next;
                });
              } else if (dateRows.length > 0) {
                setShowScheduleByDate(true);
                setDateSchedules(dateRows.map(row => {
                  const [y, m, d] = row.date.split("-");
                  const [oH, oM] = (row.open_time || "").split(":");
                  const [cH, cM] = (row.close_time || "").split(":");
                  return {
                    id: row.id?.toString() || Math.random().toString(36).substr(2, 9),
                    year: y || "",
                    month: m || "",
                    day: d || "",
                    openHour: oH || "",
                    openMin: oM || "",
                    closeHour: cH || "",
                    closeMin: cM || "",
                    reservationType: row.reservation_type || "자유 입장"
                  };
                }));
              }
            }
          } else {
            toast.error("행사를 찾을 수 없습니다.");
            router.push("/");
          }
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        toast.error("정보를 불러오는데 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    initPage();
  }, [eventId, router]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setIsUploading(true);
    try {
      if (imagePath) {
        await supabase.storage.from("event_images").remove([imagePath]);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `event-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event_images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event_images")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      setImagePath(filePath);
      toast.success("이미지가 업로드되었습니다.");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("이미지 업로드에 실패했습니다: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Search channels for co-hosts
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, image_url, type")
        .ilike("name", `%${searchQuery}%`)
        .limit(5);

      if (!error && data) {
        const filtered = data.filter(c => 
          c.id.toString() !== hostId && 
          !coHosts.some(ch => ch.id === c.id)
        );
        setSearchResults(filtered);
      }
      setIsSearching(false);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, hostId, coHosts.map(c => c.id).join(',')]);

  const addCoHost = (channel: Channel) => {
    setCoHosts(prev => [...prev, channel]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeCoHost = (id: number) => {
    setCoHosts(prev => prev.filter(c => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDate = startYear && startMonth && startDay ? `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}` : "";
    const endDate = endYear && endMonth && endDay ? `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}` : "";
    const resStartDate = resStartYear && resStartMonth && resStartDay ? `${resStartYear}-${resStartMonth.padStart(2, "0")}-${resStartDay.padStart(2, "0")}` : "";
    const resEndDate = resEndYear && resEndMonth && resEndDay ? `${resEndYear}-${resEndMonth.padStart(2, "0")}-${resEndDay.padStart(2, "0")}` : "";

    if (!title || (!isAlways && !startDate) || locations.length === 0 || !hostId) {
      toast.error("필수 정보를 모두 입력해주세요.");
      return;
    }

    const startTime = startTimeHour && startTimeMin ? `${startTimeHour.padStart(2, "0")}:${startTimeMin.padStart(2, "0")}:00` : null;
    const endTime = endTimeHour && endTimeMin ? `${endTimeHour.padStart(2, "0")}:${endTimeMin.padStart(2, "0")}:00` : null;
    
    const resStartsAt = (showResSchedule && !isResAlways && resStartDate && resStartHour && resStartMin) 
      ? `${resStartDate}T${resStartHour.padStart(2, "0")}:${resStartMin.padStart(2, "0")}:00Z` 
      : null;
    const resEndsAt = (showResSchedule && !isResAlways && resEndDate && resEndHour && resEndMin) 
      ? `${resEndDate}T${resEndHour.padStart(2, "0")}:${resEndMin.padStart(2, "0")}:00Z` 
      : null;

    setIsSubmitting(true);
    try {
      // 1. Update offline_events
      const { error: eventError } = await supabase
        .from("offline_events")
        .update({
          title,
          description,
          start_date: isAlways ? null : startDate,
          end_date: isAlways ? null : (endDate || null),
          start_time: startTime,
          end_time: endTime,
          reservation_type: reservationType,
          reservation_starts_at: resStartsAt,
          reservation_ends_at: resEndsAt,
          is_reservation_always: isResAlways,
          image_url: imageUrl,
        })
        .eq("id", eventId);

      if (eventError) throw eventError;

      if (!eventBaseId) throw new Error("기본 행사 정보를 찾을 수 없습니다.");

      // 2. Update event_channels (Delete then Insert)
      const { data: deletedChannels, error: deleteChannelError } = await supabase
        .from("event_channels")
        .delete()
        .eq("event_id", eventBaseId)
        .select();

      if (deleteChannelError) throw deleteChannelError;

      const channelRelations = [
        { event_id: eventBaseId, channel_id: parseInt(hostId) },
        ...coHosts.map(ch => ({ event_id: eventBaseId, channel_id: ch.id }))
      ];

      const { error: relationError } = await supabase
        .from("event_channels")
        .insert(channelRelations);

      if (relationError) throw relationError;

      // 3. Update offline_event_locations (Delete then Insert)
      const { data: deletedLocations, error: deleteLocError } = await supabase
        .from("offline_event_locations")
        .delete()
        .eq("offline_event_id", eventId)
        .select();

      if (deleteLocError) throw deleteLocError;
      console.log("Deleted locations from DB:", deletedLocations);

      const locationRelations = locations.map((loc, idx) => ({
        offline_event_id: eventId,
        location: loc,
        order_num: idx,
      }));

      const { error: locationError } = await supabase
        .from("offline_event_locations")
        .insert(locationRelations);

      if (locationError) throw locationError;

      // 4. Update event_schedules (Delete then Insert detailed schedules)
      const { error: deleteSchedError } = await supabase
        .from("event_schedules")
        .delete()
        .eq("event_id", eventBaseId);

      if (deleteSchedError) throw deleteSchedError;

      const insertSchedRows: any[] = [];

      if (showScheduleByDay) {
        const visibleKeys = getVisibleDayKeys();
        visibleKeys.forEach(dKey => {
          const data = daySchedules[dKey as keyof typeof daySchedules];
          if (data && data.enabled) {
            insertSchedRows.push({
              event_id: eventBaseId,
              day_of_week: dKey.toUpperCase(), // mon -> MON
              date: null,
              open_time: data.openHour && data.openMin ? `${data.openHour.padStart(2, "0")}:${data.openMin.padStart(2, "0")}:00` : null,
              close_time: data.closeHour && data.closeMin ? `${data.closeHour.padStart(2, "0")}:${data.closeMin.padStart(2, "0")}:00` : null,
              reservation_type: data.reservationType || "자유 입장"
            });
          }
        });
      } else if (showScheduleByDate) {
        dateSchedules.forEach(row => {
          const formattedDate = row.year && row.month && row.day 
            ? `${row.year}-${row.month.padStart(2, "0")}-${row.day.padStart(2, "0")}` 
            : null;
          
          if (formattedDate) {
            insertSchedRows.push({
              event_id: eventBaseId,
              day_of_week: null,
              date: formattedDate,
              open_time: row.openHour && row.openMin ? `${row.openHour.padStart(2, "0")}:${row.openMin.padStart(2, "0")}:00` : null,
              close_time: row.closeHour && row.closeMin ? `${row.closeHour.padStart(2, "0")}:${row.closeMin.padStart(2, "0")}:00` : null,
              reservation_type: row.reservationType || "자유 입장"
            });
          }
        });
      }

      if (insertSchedRows.length > 0) {
        const { error: insertSchedError } = await supabase
          .from("event_schedules")
          .insert(insertSchedRows);
        
        if (insertSchedError) throw insertSchedError;
      }

      toast.success("행사가 성공적으로 수정되었습니다!");
      router.push(`/events/${eventId}`);
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("수정 중 오류가 발생했습니다: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20">
      <Header />

      <main className="mx-auto max-w-2xl px-4 mt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">행사 정보 수정</h1>
          <p className="text-muted-foreground mt-2">등록된 행사 정보를 자유롭게 수정해 보세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Host Selection */}
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="font-bold text-lg">주최자 설정</h2>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="host" className="text-sm font-semibold">주최 채널 <span className="text-destructive">*</span></Label>
              {ownedChannels.length > 0 ? (
                <Select value={hostId} onValueChange={setHostId}>
                  <SelectTrigger className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20">
                    <SelectValue placeholder="주최할 채널을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedChannels.map(channel => (
                      <SelectItem key={channel.id} value={channel.id.toString()}>
                        <div className="flex items-center gap-2">
                           <Avatar className="w-6 h-6">
                            <AvatarImage src={channel.image_url || undefined} />
                            <AvatarFallback>{channel.name.slice(0,1)}</AvatarFallback>
                          </Avatar>
                          <span>{channel.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
                  보유하신 채널이 없습니다. 채널 관리자만 행사를 수정할 수 있습니다.
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-sm font-semibold block">공동 주최자</Label>
              {!showCoHostSearch && (
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs rounded-full"
                    onClick={() => setShowCoHostSearch(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> 공동 주최자 추가
                  </Button>
                </div>
              )}
              
              {showCoHostSearch && (
                <div className="relative z-10 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="채널명으로 검색하여 추가"
                    className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCoHostSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted-foreground/10 rounded-full text-muted-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {isSearching && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {searchResults.map(channel => (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => {
                            addCoHost(channel);
                            setShowCoHostSearch(false);
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={channel.image_url || undefined} />
                              <AvatarFallback>{channel.name.slice(0,1)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{channel.name}</p>
                              <p className="text-[10px] text-muted-foreground">{channel.type}</p>
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {coHosts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {coHosts.map(channel => (
                    <div 
                      key={channel.id} 
                      className="flex items-center gap-2 bg-primary/5 text-primary px-3 py-1.5 rounded-full border border-primary/10 animate-in scale-in duration-200"
                    >
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={channel.image_url || undefined} />
                        <AvatarFallback>{channel.name.slice(0,1)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{channel.name}</span>
                      <button type="button" onClick={() => removeCoHost(channel.id)} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="font-bold text-lg">기본 정보</h2>
            </div>

            <div className="space-y-3">
              <Label htmlFor="title" className="text-sm font-semibold">행사 제목 <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="행사 이름을 입력해주세요"
                className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-sm font-semibold">설명</Label>
              <Textarea
                id="description"
                placeholder="행사에 대한 상세 정보를 입력해주세요"
                className="min-h-[150px] bg-muted/30 border-border/50 rounded-xl resize-none py-4 focus:ring-primary/20"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">장소 <span className="text-destructive">*</span></Label>
              
              <div className="flex flex-col gap-3">
                {locations.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {locations.map((loc, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl border border-border">
                        <span className="text-sm">{loc}</span>
                        <button type="button" onClick={() => setLocations(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mb-2 mt-2">
                  <div className="flex items-center gap-2" onClick={() => setIsManualLocation(!isManualLocation)}>
                    <div className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-colors cursor-pointer
                      ${isManualLocation ? "bg-primary border-primary text-primary-foreground" : "bg-background border-foreground/40 hover:border-foreground"}`}
                    >
                      {isManualLocation && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                    </div>
                    <Label className="text-xs font-bold cursor-pointer select-none">직접 입력 (지도에 표시되지 않음)</Label>
                  </div>
                </div>

                <div className="relative z-10 flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={isManualLocation ? "장소 직접 입력 (예: 전국 GS25)" : "장소 검색 (카카오맵)"}
                      className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (locationInput.trim()) {
                            setLocations(prev => [...prev, locationInput.trim()]);
                            setLocationInput("");
                            toast.success("장소가 등록 되었습니다");
                          }
                        }
                      }}
                      autoComplete="off"
                    />

                    {!isManualLocation && isSearchingAddr && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {!isManualLocation && addrResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-background border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200 divide-y divide-border/40">
                        {addrResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectAddress(item.placeName || item.address)}
                            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm flex flex-col gap-0.5 select-none"
                          >
                            <span className="font-semibold text-foreground">{item.placeName}</span>
                            <span className="text-xs text-muted-foreground">{item.address}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => {
                      if (locationInput.trim()) {
                        setLocations(prev => [...prev, locationInput.trim()]);
                        setLocationInput("");
                        toast.success("장소가 등록 되었습니다");
                      }
                    }}
                    className="h-12 px-6 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shrink-0 shadow-sm hover:shadow-md active:scale-95"
                  >
                    추가
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">대표 이미지</Label>
              <div className="relative group">
                {imageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-border">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={async () => {
                        setImageUrl(null);
                        if (imagePath) {
                          await supabase.storage.from("event_images").remove([imagePath]);
                          setImagePath(null);
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-video rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">이미지 업로드 (16:9 추천)</span>
                      </>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Info */}
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="font-bold text-lg">일정 설정</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">행사 날짜 {!isAlways && <span className="text-destructive">*</span>}</Label>
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer select-none
                    ${isAlways 
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20' 
                      : 'bg-muted border-border hover:border-primary/50 text-muted-foreground'
                    }`}
                  onClick={() => {
                    const val = !isAlways;
                    setIsAlways(val);
                    if (val) {
                      setStartYear("");
                      setStartMonth("");
                      setStartDay("");
                      setEndYear("");
                      setEndMonth("");
                      setEndDay("");
                    }
                  }}
                >
                  <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors
                    ${isAlways 
                      ? "bg-primary-foreground border-primary-foreground text-primary" 
                      : "bg-background border-input"
                    }`}
                  >
                    {isAlways && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <Label className="text-xs font-bold cursor-pointer select-none">상시 운영</Label>
                </div>
              </div>

              {!isAlways && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">시작일</Label>
                    <DateInputTriple
                      year={startYear}
                      month={startMonth}
                      day={startDay}
                      onYearChange={setStartYear}
                      onMonthChange={setStartMonth}
                      onDayChange={setStartDay}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">종료일</Label>
                    <DateInputTriple
                      year={endYear}
                      month={endMonth}
                      day={endDay}
                      onYearChange={setEndYear}
                      onMonthChange={setEndMonth}
                      onDayChange={setEndDay}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">운영 시작 시간 <span className="text-[11px] font-normal text-muted-foreground ml-1">(선택)</span></Label>
                <TimeInputPair
                  hour={startTimeHour}
                  minute={startTimeMin}
                  onHourChange={setStartTimeHour}
                  onMinuteChange={setStartTimeMin}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">운영 종료 시간 <span className="text-[11px] font-normal text-muted-foreground ml-1">(선택)</span></Label>
                <TimeInputPair
                  hour={endTimeHour}
                  minute={endTimeMin}
                  onHourChange={setEndTimeHour}
                  onMinuteChange={setEndTimeMin}
                />
              </div>
            </div>

            {/* Detailed schedules toggle buttons */}
            <div className="border-t border-border/30 pt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer select-none
                    ${showScheduleByDay 
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20' 
                      : 'bg-muted border-border hover:border-primary/50 text-muted-foreground'
                    }`}
                  onClick={() => {
                    const next = !showScheduleByDay;
                    setShowScheduleByDay(next);
                    if (next) {
                      setShowScheduleByDate(false);
                      autoPopulateSchedules("day");
                    }
                  }}
                >
                  <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors
                    ${showScheduleByDay 
                      ? "bg-primary-foreground border-primary-foreground text-primary" 
                      : "bg-background border-input"
                    }`}
                  >
                    {showScheduleByDay && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <Label className="text-xs font-bold cursor-pointer select-none">요일별 상세 일정</Label>
                </div>

                {startYear && startMonth && startDay && endYear && endMonth && endDay && (
                  <div 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer select-none
                      ${showScheduleByDate 
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20' 
                        : 'bg-muted border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    onClick={() => {
                      const next = !showScheduleByDate;
                      setShowScheduleByDate(next);
                      if (next) {
                        setShowScheduleByDay(false);
                        autoPopulateSchedules("date");
                      }
                    }}
                  >
                    <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors
                      ${showScheduleByDate 
                        ? "bg-primary-foreground border-primary-foreground text-primary" 
                        : "bg-background border-input"
                      }`}
                    >
                      {showScheduleByDate && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <Label className="text-xs font-bold cursor-pointer select-none">날짜별 상세 일정</Label>
                  </div>
                )}
              </div>

              {/* 1. 요일별 상세 일정 Form */}
              {showScheduleByDay && (
                <div className="space-y-4 pt-4 border-t border-border/30 animate-in fade-in duration-300">
                  <Label className="text-sm font-bold block text-foreground/90">요일별 상세 일정 설정</Label>
                  <div className="space-y-2.5">
                    {getVisibleDayKeys().map((dKey) => {
                      const dayData = daySchedules[dKey];
                      return (
                        <div key={dKey} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 px-5 bg-background border border-border/60 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)]">
                          
                          {/* Day Label */}
                          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto">
                            <span className="font-extrabold text-sm sm:text-[15px] text-foreground select-none">
                              {koreanDayMap[dKey]}요일
                            </span>
                          </div>

                          {/* Operating Hours & Reservation Dropdown */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6 flex-1 lg:justify-end">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11.5px] font-black text-foreground/60 select-none shrink-0 pr-0.5">시작</span>
                              <TimeInputPair 
                                hour={dayData.openHour} minute={dayData.openMin} 
                                onHourChange={(val) => updateDaySchedule(dKey, "openHour", val)}
                                onMinuteChange={(val) => updateDaySchedule(dKey, "openMin", val)}
                                size="sm"
                              />
                              <span className="text-foreground/60 font-black text-base mx-1 select-none shrink-0 relative bottom-[0.5px]">~</span>
                              <span className="text-[11.5px] font-black text-foreground/60 select-none shrink-0 pr-0.5">마감</span>
                              <TimeInputPair 
                                hour={dayData.closeHour} minute={dayData.closeMin} 
                                onHourChange={(val) => updateDaySchedule(dKey, "closeHour", val)}
                                onMinuteChange={(val) => updateDaySchedule(dKey, "closeMin", val)}
                                size="sm"
                              />
                            </div>

                            <div className="w-full sm:w-32 lg:w-36 flex items-center gap-2 shrink-0">
                              <span className="text-[11px] sm:hidden font-extrabold text-foreground shrink-0">입장</span>
                              <Select value={dayData.reservationType} onValueChange={(val) => updateDaySchedule(dKey, "reservationType", val)}>
                                <SelectTrigger className="h-10 text-xs font-extrabold rounded-xl bg-white border-2 border-border/80 focus:border-primary focus:ring-primary/10 w-full shadow-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["자유 입장", "예약 필수", "티켓팅", "휴무"].map(type => (
                                    <SelectItem key={type} value={type} className="text-xs font-bold">{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. 날짜별 상세 일정 Form */}
              {showScheduleByDate && startYear && startMonth && startDay && endYear && endMonth && endDay && (
                <div className="space-y-4 pt-4 border-t border-border/30 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm font-bold text-foreground/90">특정 날짜별 상세 일정 설정</Label>
                  </div>

                  <div className="space-y-3">
                    {dateSchedules.length === 0 && (
                      <div className="py-8 text-center rounded-2xl border border-dashed border-border/60 bg-muted/5 animate-in fade-in duration-300">
                        <Calendar className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2 stroke-[1.5]" />
                        <p className="text-[13px] font-medium text-muted-foreground">특정 날짜별 상세 일정을 설정하려면 상단의 행사 일자를 먼저 입력해 주세요.</p>
                      </div>
                    )}
                    
                    {dateSchedules.map((row, idx) => (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border-2 border-border/80 bg-card shadow-sm animate-in fade-in duration-300 w-full relative">
                        
                        {/* Left: Date Badge + Hours (Strictly Horizontal Row!) */}
                        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                          {/* Month/Day Static Text (No Badge) */}
                          <span className="min-w-[100px] sm:min-w-[105px] pl-1.5 sm:pl-2 text-foreground font-extrabold text-[14.5px] tracking-tight select-none shrink-0">
                            {(() => {
                              const d = new Date(`${row.year}-${row.month.padStart(2, '0')}-${row.day.padStart(2, '0')}T00:00:00`);
                              const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
                              const dayStr = !isNaN(d.getTime()) ? ` (${dayMap[d.getDay()]})` : "";
                              return `${row.month}월 ${row.day}일${dayStr}`;
                            })()}
                          </span>

                          {/* Operating Time Pair Row */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11.5px] font-black text-foreground/60 select-none shrink-0 pl-0.5">시작</span>
                            <TimeInputPair 
                              hour={row.openHour} minute={row.openMin} 
                              onHourChange={(v) => updateDateSchedule(row.id, "openHour", v)}
                              onMinuteChange={(v) => updateDateSchedule(row.id, "openMin", v)}
                              size="sm"
                            />
                            <span className="text-muted-foreground/70 font-black text-base mx-1 shrink-0 select-none relative bottom-[0.5px]">~</span>
                            <span className="text-[11.5px] font-black text-foreground/60 select-none shrink-0">마감</span>
                            <TimeInputPair 
                              hour={row.closeHour} minute={row.closeMin} 
                              onHourChange={(v) => updateDateSchedule(row.id, "closeHour", v)}
                              onMinuteChange={(v) => updateDateSchedule(row.id, "closeMin", v)}
                              size="sm"
                            />
                          </div>
                        </div>

                        {/* Right: Admission Dropdown + Delete Button Group */}
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                          <div className="w-[108px]">
                            <Select value={row.reservationType} onValueChange={(v) => updateDateSchedule(row.id, "reservationType", v)}>
                              <SelectTrigger className="h-9.5 text-xs font-extrabold rounded-xl bg-white border-2 border-border/80 focus:border-primary shadow-sm w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["자유 입장", "예약 필수", "티켓팅", "휴무"].map(type => (
                                  <SelectItem key={type} value={type} className="text-xs font-bold">{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <button 
                            type="button" 
                            onClick={() => removeDateRow(row.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all active:scale-90 shrink-0"
                          >
                            <X className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admission Info */}
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="font-bold text-lg">입장 방식</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {["자유 입장", "예약 필수", "티켓팅", "휴무"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setReservationType(type);
                    if (type === "자유 입장" || type === "휴무") setShowResSchedule(false);
                  }}
                  className={`flex items-center justify-center gap-2 h-12 rounded-xl border-2 transition-all font-medium text-sm
                    ${reservationType === type 
                      ? "border-primary bg-primary/5 text-primary shadow-sm" 
                      : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted"
                    }`}
                >
                  {reservationType === type && <Check className="w-4 h-4" />}
                  {type}
                </button>
              ))}
            </div>

            {reservationType !== "자유 입장" && reservationType !== "휴무" && (
              <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div 
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all w-fit shadow-sm cursor-pointer select-none
                    ${showResSchedule 
                      ? 'bg-primary border-primary text-primary-foreground shadow-primary/20' 
                      : 'bg-muted border-border hover:border-primary/50 text-foreground'
                    }`}
                  onClick={() => setShowResSchedule(!showResSchedule)}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                    ${showResSchedule 
                      ? "bg-primary-foreground border-primary-foreground text-primary" 
                      : "bg-background border-border"
                    }`}
                  >
                    {showResSchedule && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                  </div>
                  <Label className="text-sm font-bold cursor-pointer select-none">예약 시작 일정 추가</Label>
                </div>

                {showResSchedule && (
                  <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">예약 시작일 {!isResAlways && <span className="text-destructive">*</span>}</Label>
                      <div 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all cursor-pointer select-none
                          ${isResAlways 
                            ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20' 
                            : 'bg-muted border-border hover:border-primary/50 text-muted-foreground'
                          }`}
                        onClick={() => setIsResAlways(!isResAlways)}
                      >
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors
                          ${isResAlways 
                            ? "bg-primary-foreground border-primary-foreground text-primary" 
                            : "bg-background border-input"
                          }`}
                        >
                          {isResAlways && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <Label className="text-xs font-bold cursor-pointer select-none">상시 오픈</Label>
                      </div>
                    </div>

                    {!isResAlways && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Reservation Start */}
                        <div className="space-y-4">
                          <Label className="text-sm font-bold text-foreground">예약 시작 일시</Label>
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">날짜</Label>
                              <DateInputTriple
                                year={resStartYear}
                                month={resStartMonth}
                                day={resStartDay}
                                onYearChange={setResStartYear}
                                onMonthChange={setResStartMonth}
                                onDayChange={setResStartDay}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">시간</Label>
                              <TimeInputPair
                                hour={resStartHour}
                                minute={resStartMin}
                                onHourChange={setResStartHour}
                                onMinuteChange={setResStartMin}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Reservation End */}
                        <div className="space-y-4 pt-4 border-t border-border/30">
                          <Label className="text-sm font-bold text-foreground">예약 마감 일시</Label>
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">날짜</Label>
                              <DateInputTriple
                                year={resEndYear}
                                month={resEndMonth}
                                day={resEndDay}
                                onYearChange={setResEndYear}
                                onMonthChange={setResEndMonth}
                                onDayChange={setResEndDay}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">시간</Label>
                              <TimeInputPair
                                hour={resEndHour}
                                minute={resEndMin}
                                onHourChange={setResEndHour}
                                onMinuteChange={setResEndMin}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-14 rounded-2xl font-bold border-border text-foreground hover:bg-muted"
              onClick={() => router.back()}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || ownedChannels.length === 0}
              className="flex-[2] h-14 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  수정 중...
                </>
              ) : (
                "행사 수정 완료"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
