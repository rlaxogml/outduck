"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Search, Upload, X, Plus, Check, Loader2, Link2 } from "lucide-react";
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
  onMinuteChange 
}: { 
  hour: string, 
  minute: string, 
  onHourChange: (v: string) => void, 
  onMinuteChange: (v: string) => void 
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

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={hourRef}
          placeholder="--"
          className="w-12 sm:w-14 h-10 sm:h-11 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-base sm:text-lg font-bold focus:ring-primary/20 p-0"
          value={hour}
          onChange={handleHourChange}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0">시</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={minRef}
          placeholder="--"
          className="w-12 sm:w-14 h-10 sm:h-11 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-base sm:text-lg font-bold focus:ring-primary/20 p-0"
          value={minute}
          onChange={handleMinChange}
          onKeyDown={(e) => handleKeyDown(e, true)}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0">분</span>
      </div>
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
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={yearRef}
          placeholder="----"
          className="w-16 sm:w-20 h-10 sm:h-11 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-base sm:text-lg font-bold focus:ring-primary/20 p-0"
          value={year}
          onChange={handleYearChange}
          maxLength={4}
        />
        <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0">년</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={monthRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-base sm:text-lg font-bold focus:ring-primary/20 p-0"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, "month")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0">월</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={dayRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-base sm:text-lg font-bold focus:ring-primary/20 p-0"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, "day")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0">일</span>
      </div>
    </div>
  );
};

export default function NewEventPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ownedChannels, setOwnedChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.kakao && !!window.kakao.maps;
  });
  const cleanKey = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || "").trim();

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

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [startYear, setStartYear] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endYear, setEndYear] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");
  const [isAlways, setIsAlways] = useState(false);
  const [startTimeHour, setStartTimeHour] = useState("");
  const [startTimeMin, setStartTimeMin] = useState("");
  const [endTimeHour, setEndTimeHour] = useState("");
  const [endTimeMin, setEndTimeMin] = useState("");
  const [reservationType, setReservationType] = useState("자유입장");
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

  // Toggle between online and offline
  const [eventType, setEventType] = useState<"offline" | "online">("offline");

  // Online specific schedule states
  const [onlineStartYear, setOnlineStartYear] = useState("");
  const [onlineStartMonth, setOnlineStartMonth] = useState("");
  const [onlineStartDay, setOnlineStartDay] = useState("");
  const [onlineStartHour, setOnlineStartHour] = useState("");
  const [onlineStartMin, setOnlineStartMin] = useState("");

  const [onlineEndYear, setOnlineEndYear] = useState("");
  const [onlineEndMonth, setOnlineEndMonth] = useState("");
  const [onlineEndDay, setOnlineEndDay] = useState("");
  const [onlineEndHour, setOnlineEndHour] = useState("");
  const [onlineEndMin, setOnlineEndMin] = useState("");

  // Related links
  const [eventLinks, setEventLinks] = useState<{ link_name: string; link_url: string }[]>([]);
  const linksSectionRef = useRef<HTMLDivElement>(null);

  const addLinkWithName = (name: string) => {
    setEventLinks(prev => [...prev, { link_name: name, link_url: "" }]);
    setTimeout(() => {
      linksSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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


  useEffect(() => {
    const checkAuthAndFetchChannels = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("로그인이 필요합니다.");
        router.push("/");
        return;
      }
      setUser(session.user);

      // Fetch owned channels
      const { data: channels, error } = await supabase
        .from("channels")
        .select("id, name, image_url, type")
        .eq("owner_id", session.user.id);

      if (error) {
        console.error("Error fetching owned channels:", error);
        setIsLoading(false);
      } else if (!channels || channels.length === 0) {
        toast.error("소유한 주최자 채널이 없어 행사 등록 페이지에 접근할 수 없습니다.");
        router.push("/");
      } else {
        setOwnedChannels(channels);
        setHostId(channels[0].id.toString());
        setIsLoading(false);
      }
    };

    checkAuthAndFetchChannels();
  }, [router]);

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
        // Exclude host and already selected co-hosts
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

  const parseTimeFromDigits = (digits: string) => {
    if (digits.length !== 4) return null;
    return `${digits.slice(0, 2)}:${digits.slice(2)}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !hostId) {
      toast.error("필수 정보를 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (eventType === "offline") {
        const startDate = startYear && startMonth && startDay ? `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}` : "";
        const endDate = endYear && endMonth && endDay ? `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}` : "";
        const resStartDate = resStartYear && resStartMonth && resStartDay ? `${resStartYear}-${resStartMonth.padStart(2, "0")}-${resStartDay.padStart(2, "0")}` : "";
        const resEndDate = resEndYear && resEndMonth && resEndDay ? `${resEndYear}-${resEndMonth.padStart(2, "0")}-${resEndDay.padStart(2, "0")}` : "";

        if ((!isAlways && !startDate) || locations.length === 0) {
          toast.error("필수 정보를 모두 입력해주세요.");
          setIsSubmitting(false);
          return;
        }

        const startTime = startTimeHour && startTimeMin ? `${startTimeHour.padStart(2, "0")}:${startTimeMin.padStart(2, "0")}:00` : null;
        const endTime = endTimeHour && endTimeMin ? `${endTimeHour.padStart(2, "0")}:${endTimeMin.padStart(2, "0")}:00` : null;
        
        // Format timestamptz strings: YYYY-MM-DDTHH:mm:ssZ
        const resStartsAt = (showResSchedule && !isResAlways && resStartDate && resStartHour && resStartMin) 
          ? `${resStartDate}T${resStartHour.padStart(2, "0")}:${resStartMin.padStart(2, "0")}:00Z` 
          : null;
        const resEndsAt = (showResSchedule && !isResAlways && resEndDate && resEndHour && resEndMin) 
          ? `${resEndDate}T${resEndHour.padStart(2, "0")}:${resEndMin.padStart(2, "0")}:00Z` 
          : null;

        // 1. Insert into offline_events
        const { data: eventData, error: eventError } = await supabase
          .from("offline_events")
          .insert({
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
          .select()
          .single();

        if (eventError) throw eventError;

        // 2. Insert into offline_event_channels
        const channelRelations = [
          { event_id: eventData.id, channel_id: parseInt(hostId) },
          ...coHosts.map(ch => ({ event_id: eventData.id, channel_id: ch.id }))
        ];

        const { error: relationError } = await supabase
          .from("offline_event_channels")
          .insert(channelRelations);

        if (relationError) throw relationError;

        // 3. Insert into offline_event_locations
        const locationRelations = locations.map((loc, idx) => ({
          offline_event_id: eventData.id,
          location: loc,
          order_num: idx,
        }));

        const { error: locationError } = await supabase
          .from("offline_event_locations")
          .insert(locationRelations);

        if (locationError) throw locationError;

        // 4. Insert into event_links (offline_event_id)
        if (eventLinks.length > 0) {
          const linksToInsert = eventLinks
            .filter(link => link.link_name.trim() && link.link_url.trim())
            .map(link => ({
              link_name: link.link_name.trim(),
              link_url: link.link_url.trim(),
              offline_event_id: eventData.id
            }));

          if (linksToInsert.length > 0) {
            const { error: linksError } = await supabase
              .from("event_links")
              .insert(linksToInsert);
            if (linksError) throw linksError;
          }
        }

        toast.success("오프라인 행사가 성공적으로 등록되었습니다!");
        router.push(`/events/${eventData.id}`);

      } else {
        // Online Event Submission
        const onlineStartsAt = onlineStartYear && onlineStartMonth && onlineStartDay
          ? `${onlineStartYear}-${onlineStartMonth.padStart(2, "0")}-${onlineStartDay.padStart(2, "0")}T${(onlineStartHour || "00").padStart(2, "0")}:${(onlineStartMin || "00").padStart(2, "0")}:00Z`
          : null;
        const onlineEndsAt = onlineEndYear && onlineEndMonth && onlineEndDay
          ? `${onlineEndYear}-${onlineEndMonth.padStart(2, "0")}-${onlineEndDay.padStart(2, "0")}T${(onlineEndHour || "00").padStart(2, "0")}:${(onlineEndMin || "00").padStart(2, "0")}:00Z`
          : null;

        if (!onlineStartsAt) {
          toast.error("시작 일시를 입력해주세요.");
          setIsSubmitting(false);
          return;
        }

        // 1. Insert into online_events
        const { data: eventData, error: eventError } = await supabase
          .from("online_events")
          .insert({
            title,
            description,
            start_at: onlineStartsAt,
            end_at: onlineEndsAt,
            image_url: imageUrl,
          })
          .select()
          .single();

        if (eventError) throw eventError;

        // 2. Insert into online_event_channels
        const channelRelations = [
          { event_id: eventData.id, channel_id: parseInt(hostId) },
          ...coHosts.map(ch => ({ event_id: eventData.id, channel_id: ch.id }))
        ];

        const { error: relationError } = await supabase
          .from("online_event_channels")
          .insert(channelRelations);

        if (relationError) throw relationError;

        // 3. Insert into event_links (online_event_id)
        if (eventLinks.length > 0) {
          const linksToInsert = eventLinks
            .filter(link => link.link_name.trim() && link.link_url.trim())
            .map(link => ({
              link_name: link.link_name.trim(),
              link_url: link.link_url.trim(),
              online_event_id: eventData.id
            }));

          if (linksToInsert.length > 0) {
            const { error: linksError } = await supabase
              .from("event_links")
              .insert(linksToInsert);
            if (linksError) throw linksError;
          }
        }

        toast.success("온라인 행사가 성공적으로 등록되었습니다!");
        router.push(`/online-events/${eventData.id}`);
      }
    } catch (error: any) {
      console.error("Submission error:", JSON.stringify(error, null, 2), error);
      toast.error("등록 중 오류가 발생했습니다: " + (error?.message || JSON.stringify(error)));
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
          <h1 className="text-3xl font-bold tracking-tight">행사 등록</h1>
          <p className="text-muted-foreground mt-2">새로운 행사를 개최하고 팬들과 만나보세요.</p>
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
                  보유하신 채널이 없습니다. 채널 관리자만 행사를 등록할 수 있습니다.
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
              <Label className="text-sm font-semibold">행사 유형 <span className="text-destructive">*</span></Label>
              <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/50 max-w-xs backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setEventType("offline")}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                    eventType === "offline"
                      ? "bg-background text-primary shadow-sm scale-[1.02] border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  오프라인
                </button>
                <button
                  type="button"
                  onClick={() => setEventType("online")}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                    eventType === "online"
                      ? "bg-background text-primary shadow-sm scale-[1.02] border border-border/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  온라인
                </button>
              </div>
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

            {eventType === "offline" && (
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
                            if (isManualLocation && locationInput.trim()) {
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
                    {isManualLocation && (
                      <Button 
                        type="button" 
                        onClick={() => {
                          if (locationInput.trim()) {
                            setLocations(prev => [...prev, locationInput.trim()]);
                            setLocationInput("");
                            toast.success("장소가 등록 되었습니다");
                          }
                        }}
                        className="h-12 px-6 rounded-xl font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0"
                      >
                        추가
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

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
          {eventType === "offline" && (
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
                    {/* Custom Checkbox UI */}
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
                      <Label className="text-sm font-semibold">종료일 <span className="text-[11px] font-normal text-muted-foreground ml-1">(선택)</span></Label>
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
            </div>
          )}

          {/* Admission Info */}
          {eventType === "offline" && (
            <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h2 className="font-bold text-lg">입장 방식</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {["자유입장", "예약필수", "예약우대", "티켓팅"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setReservationType(type);
                      if (type === "자유입장") setShowResSchedule(false);
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

              {reservationType !== "자유입장" && (
                <div className="pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-wrap gap-3">
                    {/* 예약 일정 추가 toggle */}
                    <div 
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all w-fit shadow-sm cursor-pointer select-none
                        ${showResSchedule 
                          ? 'bg-primary border-primary text-primary-foreground shadow-primary/20' 
                          : 'bg-muted border-border hover:border-primary/50 text-foreground'
                        }`}
                      onClick={() => setShowResSchedule(!showResSchedule)}
                    >
                      {/* Clock icon checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                        ${showResSchedule 
                          ? "bg-primary-foreground border-primary-foreground text-primary" 
                          : "bg-background border-border"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <Label className="text-sm font-bold cursor-pointer select-none">예약 일정 추가</Label>
                    </div>

                    {/* 예약/티켓팅 링크 등록하기 button */}
                    {(() => {
                      const targetLinkName = (reservationType === "예약필수" || reservationType === "예약우대") ? "예약 링크" : "티켓팅 링크";
                      const hasTargetLink = eventLinks.some(link => link.link_name === targetLinkName);
                      if (hasTargetLink) return null;

                      return (
                        <div 
                          className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-all w-fit shadow-sm cursor-pointer select-none animate-in fade-in zoom-in-95 duration-200"
                          onClick={() => addLinkWithName(targetLinkName)}
                        >
                          <Link2 className="w-4 h-4 stroke-[2.5]" />
                          <span className="text-sm font-bold select-none">
                            {targetLinkName === "예약 링크" ? "예약 링크 등록하기" : "티켓팅 링크 등록하기"}
                          </span>
                        </div>
                      );
                    })()}
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
                          {/* Custom Checkbox UI */}
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
          )}

          {/* Online Schedule Info */}
          {eventType === "online" && (
            <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h2 className="font-bold text-lg">온라인 일정 설정</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">시작 일시 <span className="text-destructive">*</span></Label>
                  <div className="flex flex-col gap-2">
                    <DateInputTriple
                      year={onlineStartYear}
                      month={onlineStartMonth}
                      day={onlineStartDay}
                      onYearChange={setOnlineStartYear}
                      onMonthChange={setOnlineStartMonth}
                      onDayChange={setOnlineStartDay}
                    />
                    <div className="pt-1">
                      <Label className="text-xs text-muted-foreground mb-1.5 block">시작 시간</Label>
                      <TimeInputPair
                        hour={onlineStartHour}
                        minute={onlineStartMin}
                        onHourChange={setOnlineStartHour}
                        onMinuteChange={setOnlineStartMin}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">종료 일시 <span className="text-[11px] font-normal text-muted-foreground ml-1">(선택)</span></Label>
                  <div className="flex flex-col gap-2">
                    <DateInputTriple
                      year={onlineEndYear}
                      month={onlineEndMonth}
                      day={onlineEndDay}
                      onYearChange={setOnlineEndYear}
                      onMonthChange={setOnlineEndMonth}
                      onDayChange={setOnlineEndDay}
                    />
                    <div className="pt-1">
                      <Label className="text-xs text-muted-foreground mb-1.5 block">종료 시간</Label>
                      <TimeInputPair
                        hour={onlineEndHour}
                        minute={onlineEndMin}
                        onHourChange={setOnlineEndHour}
                        onMinuteChange={setOnlineEndMin}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Related Links Section */}
          <div ref={linksSectionRef} className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h2 className="font-bold text-lg">관련 링크</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEventLinks(prev => [...prev, { link_name: "", link_url: "" }])}
                className="h-8 rounded-full text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> 링크 추가
              </Button>
            </div>

            {eventLinks.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                등록된 관련 링크가 없습니다. (예: 예매처, 트위터 안내, 공식 사이트 등)
              </div>
            ) : (
              <div className="space-y-3">
                {eventLinks.map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
                    <Input
                      placeholder="링크 이름 (예: 예약 링크, 트위터)"
                      value={link.link_name}
                      onChange={(e) => {
                        const updated = [...eventLinks];
                        updated[idx].link_name = e.target.value;
                        setEventLinks(updated);
                      }}
                      className="flex-1 h-11 bg-muted/30 border-border/50 rounded-xl text-sm"
                    />
                    <Input
                      placeholder="URL (https://...)"
                      value={link.link_url}
                      onChange={(e) => {
                        const updated = [...eventLinks];
                        updated[idx].link_url = e.target.value;
                        setEventLinks(updated);
                      }}
                      className="flex-[2] h-11 bg-muted/30 border-border/50 rounded-xl text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEventLinks(prev => prev.filter((_, i) => i !== idx))}
                      className="h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
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
                  등록 중...
                </>
              ) : (
                eventType === "offline" ? "오프라인 행사 등록하기" : "온라인 행사 등록하기"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
