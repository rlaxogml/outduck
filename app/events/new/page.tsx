"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Input
          ref={hourRef}
          placeholder="--"
          className="w-16 h-12 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-xl font-bold focus:ring-primary/20"
          value={hour}
          onChange={handleHourChange}
          maxLength={2}
        />
        <span className="text-sm font-bold text-muted-foreground">시</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          ref={minRef}
          placeholder="--"
          className="w-16 h-12 bg-muted/30 border-border/50 rounded-xl text-center font-mono text-xl font-bold focus:ring-primary/20"
          value={minute}
          onChange={handleMinChange}
          onKeyDown={(e) => handleKeyDown(e, true)}
          maxLength={2}
        />
        <span className="text-sm font-bold text-muted-foreground">분</span>
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

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAlways, setIsAlways] = useState(false);
  const [startTimeHour, setStartTimeHour] = useState("");
  const [startTimeMin, setStartTimeMin] = useState("");
  const [endTimeHour, setEndTimeHour] = useState("");
  const [endTimeMin, setEndTimeMin] = useState("");
  const [reservationType, setReservationType] = useState("자유입장");
  const [showResSchedule, setShowResSchedule] = useState(false);
  const [resStartDate, setResStartDate] = useState("");
  const [resStartHour, setResStartHour] = useState("");
  const [resStartMin, setResStartMin] = useState("");
  const [resEndDate, setResEndDate] = useState("");
  const [resEndHour, setResEndHour] = useState("");
  const [resEndMin, setResEndMin] = useState("");
  const [isResAlways, setIsResAlways] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hostId, setHostId] = useState<string>("");
  const [coHosts, setCoHosts] = useState<Channel[]>([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Address search states
  const [addrResults, setAddrResults] = useState<any[]>([]);
  const [isSearchingAddr, setIsSearchingAddr] = useState(false);

  useEffect(() => {
    if (!location || location.trim().length < 2) {
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
        places.keywordSearch(location, (data: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
            const formatted = data.map((item: any) => ({
              address: item.address_name,
              placeName: item.place_name,
            }));
            setAddrResults(formatted);
            setIsSearchingAddr(false);
          } else {
            geocoder.addressSearch(location, (result: any, addrStatus: any) => {
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
  }, [location, isScriptLoaded]);

  const selectAddress = (addr: string) => {
    setLocation(addr);
    setAddrResults([]);
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
      } else {
        setOwnedChannels(channels || []);
        if (channels && channels.length > 0) {
          setHostId(channels[0].id.toString());
        }
      }
      setIsLoading(false);
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
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `event-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("events") // Assuming bucket name is 'events' based on common patterns
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("events")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
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
    if (!title || (!isAlways && !startDate) || !location || !hostId) {
      toast.error("필수 정보를 모두 입력해주세요.");
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

    setIsSubmitting(true);
    try {
      // 1. Insert into offline_events
      const { data: eventData, error: eventError } = await supabase
        .from("offline_events")
        .insert({
          title,
          description,
          location,
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
        { offline_event_id: eventData.id, channel_id: parseInt(hostId) },
        ...coHosts.map(ch => ({ offline_event_id: eventData.id, channel_id: ch.id }))
      ];

      const { error: relationError } = await supabase
        .from("offline_event_channels")
        .insert(channelRelations);

      if (relationError) throw relationError;

      toast.success("행사가 성공적으로 등록되었습니다!");
      router.push(`/events/${eventData.id}`);
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("등록 중 오류가 발생했습니다: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="mx-auto max-w-5xl w-full px-4 py-3">
          <Header />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <Header />
      </div>

      <main className="mx-auto max-w-2xl px-4 mt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">오프라인 행사 등록</h1>
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
              <Label className="text-sm font-semibold">공동 주최자</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="채널명으로 검색하여 추가"
                  className="pl-10 h-11 bg-muted/30 border-border/50 rounded-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {searchResults.map(channel => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => addCoHost(channel)}
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
              <Label htmlFor="location" className="text-sm font-semibold">장소 <span className="text-destructive">*</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="행사가 열리는 장소를 입력해주세요"
                  className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  autoComplete="off"
                />

                {isSearchingAddr && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {addrResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200 divide-y divide-border/40">
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
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">대표 이미지</Label>
              <div className="relative group">
                {imageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-border">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
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
                      setStartDate("");
                      setEndDate("");
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
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <Label className="text-[12px] text-muted-foreground">시작일</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[12px] text-muted-foreground">종료일</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
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

          {/* Admission Info */}
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
                <div 
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all w-fit shadow-sm cursor-pointer select-none
                    ${showResSchedule 
                      ? 'bg-primary border-primary text-primary-foreground shadow-primary/20' 
                      : 'bg-muted border-border hover:border-primary/50 text-foreground'
                    }`}
                  onClick={() => setShowResSchedule(!showResSchedule)}
                >
                  {/* Custom Checkbox UI */}
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">날짜</Label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="date"
                                  className="pl-10 h-12 bg-background border-border/50 rounded-xl"
                                  value={resStartDate}
                                  onChange={(e) => setResStartDate(e.target.value)}
                                />
                              </div>
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[11px] text-muted-foreground ml-1">날짜</Label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  type="date"
                                  className="pl-10 h-12 bg-background border-border/50 rounded-xl"
                                  value={resEndDate}
                                  onChange={(e) => setResEndDate(e.target.value)}
                                />
                              </div>
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
                  등록 중...
                </>
              ) : (
                "행사 등록하기"
              )}
            </Button>
          </div>
        </form>
      </main>

      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${cleanKey}&libraries=services&autoload=false`}
        onLoad={() => {
          setIsScriptLoaded(true);
          if (typeof window !== "undefined" && window.kakao && window.kakao.maps) {
            window.kakao.maps.load();
          }
        }}
        strategy="afterInteractive"
      />
    </div>
  );
}
