"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  ImageIcon,
  Search,
  Plus,
  Trash2,
  Check,
  MapPin,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useKakaoAddress } from "@/hooks/use-kakao-address";
import RichTextEditor from "@/components/events/rich-text-editor";
import { DateInputTriple } from "@/components/events/date-input-triple";
import { TimeInputPair } from "@/components/events/time-input-pair";

interface Channel {
  id: number;
  name: string;
  image_url: string | null;
  type: string;
}

interface ChannelLink {
  id: string;
  name: string;
  url: string;
}

interface EventProposalFormProps {
  user: User;
  onSuccess: () => void;
}

export function EventProposalForm({ user, onSuccess }: EventProposalFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Channel Search / Suggest States ---
  const [proposeChannel, setProposeChannel] = useState(false);
  const [hostChannelId, setHostChannelId] = useState("");
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [channelSearchResults, setChannelSearchResults] = useState<Channel[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // Simultaneous Channel Proposal Fields
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("");
  const [newChannelLinks, setNewChannelLinks] = useState<ChannelLink[]>([{ id: "ch-default", name: "", url: "" }]);

  // --- Event Common States ---
  const [eventType, setEventType] = useState<"offline" | "online">("offline");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventLinks, setEventLinks] = useState<{ link_name: string; link_url: string }[]>([]);

  // --- Offline Specific States ---
  const currentYear = new Date().getFullYear().toString();
  const [isAlways, setIsAlways] = useState(false);
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");

  const [startTimeHour, setStartTimeHour] = useState("");
  const [startTimeMin, setStartTimeMin] = useState("");
  const [endTimeHour, setEndTimeHour] = useState("");
  const [endTimeMin, setEndTimeMin] = useState("");

  const [reservationType, setReservationType] = useState("자유 입장");
  const [showResSchedule, setShowResSchedule] = useState(false);
  const [isResAlways, setIsResAlways] = useState(false);
  const [resStartYear, setResStartYear] = useState(currentYear);
  const [resStartMonth, setResStartMonth] = useState("");
  const [resStartDay, setResStartDay] = useState("");
  const [resStartHour, setResStartHour] = useState("");
  const [resStartMin, setResStartMin] = useState("");
  const [resEndYear, setResEndYear] = useState(currentYear);
  const [resEndMonth, setResEndMonth] = useState("");
  const [resEndDay, setResEndDay] = useState("");
  const [resEndHour, setResEndHour] = useState("");
  const [resEndMin, setResEndMin] = useState("");

  // Location search (Kakao Address SDK integration)
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Sub images (support images)
  const [supportImages, setSupportImages] = useState<{ url: string; path: string }[]>([]);
  const [isUploadingSupport, setIsUploadingSupport] = useState(false);

  // --- Online Specific States ---
  const [isOnlineAlways, setIsOnlineAlways] = useState(false);
  const [onlineStartYear, setOnlineStartYear] = useState(currentYear);
  const [onlineStartMonth, setOnlineStartMonth] = useState("");
  const [onlineStartDay, setOnlineStartDay] = useState("");
  const [onlineStartHour, setOnlineStartHour] = useState("");
  const [onlineStartMin, setOnlineStartMin] = useState("");
  const [onlineEndYear, setOnlineEndYear] = useState(currentYear);
  const [onlineEndMonth, setOnlineEndMonth] = useState("");
  const [onlineEndDay, setOnlineEndDay] = useState("");
  const [onlineEndHour, setOnlineEndHour] = useState("");
  const [onlineEndMin, setOnlineEndMin] = useState("");

  // --- Image Upload Hooks ---
  // Main Poster
  const {
    imageUrl: mainImageUrl,
    isUploading: isUploadingMain,
    handleImageUpload: handleMainImageUpload,
  } = useImageUpload({
    bucket: "event_images",
    folderPath: "event-proposals",
    prefix: "main-",
    successMessage: "행사 포스터가 업로드되었습니다.",
  });

  // Channel profile if simultaneous proposal is checked
  const {
    imageUrl: channelImageUrl,
    isUploading: isUploadingChannelImg,
    handleImageUpload: handleChannelImageUpload,
  } = useImageUpload({
    bucket: "channel-images",
    folderPath: "channel-requests",
    prefix: "proposal-",
    successMessage: "채널 프로필 이미지가 업로드되었습니다.",
  });

  // --- Kakao Address SDK script loader ---
  useEffect(() => {
    if (typeof window !== "undefined" && !window.daum) {
      const script = document.createElement("script");
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      document.head.appendChild(script);
    } else {
      setIsScriptLoaded(true);
    }
  }, []);

  const { addrResults, isSearchingAddr, setAddrResults } = useKakaoAddress(
    locationInput,
    isManualLocation,
    isScriptLoaded
  );

  const selectAddress = (addr: string) => {
    setLocations(prev => [...prev, addr]);
    setLocationInput("");
    setAddrResults([]);
    toast.success("장소가 등록되었습니다.");
  };

  // --- Channel autocomplete search ---
  useEffect(() => {
    if (channelSearchQuery.trim().length < 2) {
      setChannelSearchResults([]);
      return;
    }
    const searchTimeout = setTimeout(async () => {
      setIsSearchingChannels(true);
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, image_url, type")
        .ilike("name", `%${channelSearchQuery}%`)
        .limit(5);
      
      if (!error && data) {
        setChannelSearchResults(data);
      }
      setIsSearchingChannels(false);
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [channelSearchQuery]);

  // --- Support Images (Sub Posters) Upload ---
  const handleSupportImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setIsUploadingSupport(true);
    try {
      const uploadedList: { url: string; path: string }[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split(".").pop();
        const randomPart = Math.random().toString(36).substring(2);
        const fileName = `support-${randomPart}-${Date.now()}.${fileExt}`;
        const filePath = `event-proposals/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("event_images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("event_images")
          .getPublicUrl(filePath);

        uploadedList.push({
          url: publicUrl,
          path: filePath
        });
      }

      setSupportImages(prev => [...prev, ...uploadedList]);
      toast.success(`${imageFiles.length}장의 이미지가 추가 업로드되었습니다.`);
    } catch (err: any) {
      console.error("Support images upload error:", err);
      toast.error("이미지 업로드에 실패했습니다: " + (err.message || "알 수 없는 오류"));
    } finally {
      setIsUploadingSupport(false);
    }
  };

  const handleRemoveSupportImage = (idx: number) => {
    setSupportImages(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Form Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!proposeChannel && !selectedChannel) {
      toast.error("주최 채널을 선택하거나 신규 채널 증설 제안을 체크해주세요.");
      return;
    }
    if (proposeChannel && !newChannelName.trim()) {
      toast.error("제안할 채널명을 입력해주세요.");
      return;
    }
    if (proposeChannel && !newChannelType) {
      toast.error("제안할 채널의 활동 유형을 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      toast.error("행사 제목을 입력해주세요.");
      return;
    }

    const offlineStartDate = startYear && startMonth && startDay ? `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}` : "";

    if (eventType === "offline") {
      if (!isAlways && !offlineStartDate) {
        toast.error("행사 날짜를 입력해주세요.");
        return;
      }
      if (locations.length === 0) {
        toast.error("장소를 하나 이상 입력해주세요.");
        return;
      }
    } else {
      if (!isOnlineAlways && (!onlineStartYear || !onlineStartMonth || !onlineStartDay)) {
        toast.error("시작 일시를 입력해주세요.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const tzOffset = (() => {
        const tzo = -new Date().getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
        return `${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;
      })();

      // 1. Channel Proposal First (if simultaneous option checked)
      let channelProposalId: number | null = null;
      if (proposeChannel) {
        const chLinks = newChannelLinks
          .filter(l => l.name.trim() || l.url.trim())
          .map(({ name, url }) => ({ name: name.trim(), url: url.trim() }));

        const { data: chProp, error: chPropErr } = await supabase
          .from("channel_proposals")
          .insert({
            user_id: user.id,
            name: newChannelName.trim(),
            type: newChannelType,
            image_url: channelImageUrl || null,
            links: chLinks.length > 0 ? chLinks : null,
            status: "pending",
          })
          .select("id")
          .single();

        if (chPropErr) throw chPropErr;
        channelProposalId = parseInt(chProp.id);
      }

      // 2. Prepare event links
      const linksObj: Record<string, string> = {};
      eventLinks.forEach(link => {
        if (link.link_name.trim() && link.link_url.trim()) {
          linksObj[link.link_name.trim()] = link.link_url.trim();
        }
      });

      // 3. Build insert payload for event_proposals
      const eventProposalData: any = {
        user_id: user.id,
        status: "pending",
        is_offline: eventType === "offline",
        is_online: eventType === "online",
        title: title.trim(),
        description: description || null,
        image_url: mainImageUrl || null,
        links: Object.keys(linksObj).length > 0 ? linksObj : null,
        channel_proposal_id: channelProposalId,
        channel_ids: !proposeChannel && selectedChannel ? [selectedChannel.id] : null,
      };

      if (eventType === "offline") {
        const endDate = endYear && endMonth && endDay ? `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}` : "";
        const resStartDate = resStartYear && resStartMonth && resStartDay ? `${resStartYear}-${resStartMonth.padStart(2, "0")}-${resStartDay.padStart(2, "0")}` : "";
        const resEndDate = resEndYear && resEndMonth && resEndDay ? `${resEndYear}-${resEndMonth.padStart(2, "0")}-${resEndDay.padStart(2, "0")}` : "";

        const startTime = startTimeHour && startTimeMin ? `${startTimeHour.padStart(2, "0")}:${startTimeMin.padStart(2, "0")}:00` : null;
        const endTime = endTimeHour && endTimeMin ? `${endTimeHour.padStart(2, "0")}:${endTimeMin.padStart(2, "0")}:00` : null;

        const resStartsAt = (showResSchedule && !isResAlways && resStartDate && resStartHour && resStartMin) 
          ? `${resStartDate}T${resStartHour.padStart(2, "0")}:${resStartMin.padStart(2, "0")}:00${tzOffset}` 
          : null;
        const resEndsAt = (showResSchedule && !isResAlways && resEndDate && resEndHour && resEndMin) 
          ? `${resEndDate}T${resEndHour.padStart(2, "0")}:${resEndMin.padStart(2, "0")}:00${tzOffset}` 
          : null;

        eventProposalData.start_date = isAlways ? null : offlineStartDate;
        eventProposalData.end_date = isAlways ? null : (endDate || null);
        eventProposalData.start_time = startTime;
        eventProposalData.end_time = endTime;
        eventProposalData.reservation_type = reservationType;
        eventProposalData.is_reservation_always = isResAlways;
        eventProposalData.reservation_starts_at = resStartsAt;
        eventProposalData.reservation_ends_at = resEndsAt;
        eventProposalData.locations = locations;
        eventProposalData.support_images = supportImages.length > 0 ? supportImages : null;
      } else {
        const onlineStartsAt = isOnlineAlways ? null : (onlineStartYear && onlineStartMonth && onlineStartDay
          ? `${onlineStartYear}-${onlineStartMonth.padStart(2, "0")}-${onlineStartDay.padStart(2, "0")}T${(onlineStartHour || "00").padStart(2, "0")}:${(onlineStartMin || "00").padStart(2, "0")}:00${tzOffset}`
          : null);
        const onlineEndsAt = isOnlineAlways ? null : (onlineEndYear && onlineEndMonth && onlineEndDay
          ? `${onlineEndYear}-${onlineEndMonth.padStart(2, "0")}-${onlineEndDay.padStart(2, "0")}T${(onlineEndHour || "00").padStart(2, "0")}:${(onlineEndMin || "00").padStart(2, "0")}:00${tzOffset}`
          : null);

        eventProposalData.online_start_at = onlineStartsAt;
        eventProposalData.online_end_at = onlineEndsAt;
      }

      const { error: eventProposalErr } = await supabase
        .from("event_proposals")
        .insert([eventProposalData]);

      if (eventProposalErr) throw eventProposalErr;

      toast.success("행사 제보가 성공적으로 등록되었습니다!");
      onSuccess();
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error("행사 제보 과정에서 오류가 발생했습니다: " + (err.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background border border-border rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in duration-300">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">행사 제보서</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* --- 1. Host Channel Selection --- */}
        <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h3 className="font-bold text-lg text-foreground">주최자 설정</h3>
          </div>

          {/* Proposal Option Checkbox */}
          <div className="flex items-center gap-2 mb-4 select-none">
            <Checkbox
              id="propose-channel-chk"
              checked={proposeChannel}
              onCheckedChange={(checked) => {
                setProposeChannel(!!checked);
                setSelectedChannel(null);
                setHostChannelId("");
              }}
            />
            <Label htmlFor="propose-channel-chk" className="text-sm font-semibold cursor-pointer">
              채널이 아직 등록되어 있지 않나요? 채널 증설도 함께 신청하기
            </Label>
          </div>

          {!proposeChannel ? (
            <div className="space-y-3 animate-in fade-in duration-300">
              <Label className="text-sm font-semibold">주최 채널 검색 <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="채널명으로 검색하여 선택하세요"
                  className="pl-10 h-12 bg-white border-border/50 rounded-xl"
                  value={channelSearchQuery}
                  onChange={(e) => setChannelSearchQuery(e.target.value)}
                />
                {isSearchingChannels && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {channelSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {channelSearchResults.map(channel => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => {
                          setSelectedChannel(channel);
                          setHostChannelId(channel.id.toString());
                          setChannelSearchQuery(channel.name);
                          setChannelSearchResults([]);
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={channel.image_url || undefined} />
                            <AvatarFallback>{channel.name.slice(0, 1)}</AvatarFallback>
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

              {selectedChannel && (
                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-border w-fit">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedChannel.image_url || undefined} />
                    <AvatarFallback>{selectedChannel.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{selectedChannel.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedChannel.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel(null);
                      setHostChannelId("");
                      setChannelSearchQuery("");
                    }}
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            // New Channel Suggest Fields
            <div className="space-y-4 pt-2 border-t border-border/40 animate-in slide-in-from-top-2 duration-300">
              <h4 className="text-sm font-bold text-primary">제안할 신규 채널 정보</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">채널명 <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="신규 채널명 입력"
                    className="h-10 bg-white"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">활동 유형 <span className="text-destructive">*</span></Label>
                  <Select value={newChannelType} onValueChange={setNewChannelType}>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="game">게임</SelectItem>
                      <SelectItem value="youtuber">유튜버</SelectItem>
                      <SelectItem value="vtuber">버튜버</SelectItem>
                      <SelectItem value="festival">축제 / 행사</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Profile Image upload for proposed channel */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">채널 프로필 이미지</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 bg-muted rounded-xl overflow-hidden border border-border flex items-center justify-center">
                    {channelImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={channelImageUrl} alt="Proposed Channel Profile" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                    )}
                    {isUploadingChannelImg && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="channel-img-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleChannelImageUpload}
                      disabled={isUploadingChannelImg}
                    />
                    <label htmlFor="channel-img-upload">
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild disabled={isUploadingChannelImg}>
                        <span><Upload className="w-3.5 h-3.5 mr-1" /> 이미지 선택</span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              {/* SNS Links for proposed channel */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">채널 관련 링크</Label>
                {newChannelLinks.map((link, idx) => (
                  <div key={link.id} className="flex gap-2">
                    <Input
                      placeholder="유튜브, 트위터 등"
                      value={link.name}
                      onChange={(e) => {
                        const newLinks = [...newChannelLinks];
                        newLinks[idx].name = e.target.value;
                        setNewChannelLinks(newLinks);
                      }}
                      className="h-9 bg-white flex-[1]"
                    />
                    <Input
                      placeholder="https://"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...newChannelLinks];
                        newLinks[idx].url = e.target.value;
                        setNewChannelLinks(newLinks);
                      }}
                      className="h-9 bg-white flex-[2]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => setNewChannelLinks(newChannelLinks.filter(l => l.id !== link.id))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 border-dashed"
                  onClick={() => setNewChannelLinks([...newChannelLinks, { id: Math.random().toString(), name: "", url: "" }])}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> 링크 추가
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* --- 2. Event Common Info --- */}
        <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h3 className="font-bold text-lg">행사 기본 정보</h3>
          </div>

          {/* Event Type (Offline / Online) */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">행사 유형 <span className="text-destructive">*</span></Label>
            <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/50 max-w-xs">
              <button
                type="button"
                onClick={() => setEventType("offline")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  eventType === "offline"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                오프라인
              </button>
              <button
                type="button"
                onClick={() => setEventType("online")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  eventType === "online"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                온라인
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <Label htmlFor="event-title" className="text-sm font-semibold">행사 제목 <span className="text-destructive">*</span></Label>
            <Input
              id="event-title"
              placeholder="제보할 행사 이름을 입력해 주세요"
              className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Rich Description */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">설명</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="행사에 대한 상세한 설명 또는 홍보 문구를 입력해 주세요"
            />
          </div>

          {/* Main Poster Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">행사 포스터 이미지</Label>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-36 flex-shrink-0 bg-muted rounded-2xl overflow-hidden border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                {mainImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainImageUrl} alt="Poster" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                )}
                {isUploadingMain && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  id="main-poster-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleMainImageUpload}
                  disabled={isUploadingMain}
                />
                <label htmlFor="main-poster-upload">
                  <Button type="button" variant="outline" className="cursor-pointer rounded-xl" asChild disabled={isUploadingMain}>
                    <span><Upload className="w-4 h-4 mr-2" /> 포스터 업로드</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">행사를 대표하는 고화질 포스터를 등록해 주세요.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- 3. Offline Specific Fields --- */}
        {eventType === "offline" && (
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h3 className="font-bold text-lg">오프라인 행사 세부 정보</h3>
            </div>

            {/* Offline Dates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">행사 기간 <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2" onClick={() => setIsAlways(!isAlways)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${isAlways ? "bg-primary border-primary text-white" : "border-border"}`}>
                    {isAlways && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-bold select-none cursor-pointer">상시 진행</span>
                </div>
              </div>

              {!isAlways && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">시작일</span>
                    <DateInputTriple
                      year={startYear}
                      month={startMonth}
                      day={startDay}
                      onYearChange={setStartYear}
                      onMonthChange={setStartMonth}
                      onDayChange={setStartDay}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">종료일</span>
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

            {/* Offline Times */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">운영 시간</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">시작</span>
                  <TimeInputPair
                    hour={startTimeHour}
                    minute={startTimeMin}
                    onHourChange={setStartTimeHour}
                    onMinuteChange={setStartTimeMin}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground w-12 shrink-0">종료</span>
                  <TimeInputPair
                    hour={endTimeHour}
                    minute={endTimeMin}
                    onHourChange={setEndTimeHour}
                    onMinuteChange={setEndTimeMin}
                  />
                </div>
              </div>
            </div>

            {/* Locations (Kakao SDK) */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">장소 <span className="text-destructive">*</span></Label>
              
              {locations.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {locations.map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl border border-border">
                      <span className="text-sm text-foreground">{loc}</span>
                      <button
                        type="button"
                        onClick={() => setLocations(prev => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mb-2" onClick={() => setIsManualLocation(!isManualLocation)}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${isManualLocation ? "bg-primary border-primary text-white" : "border-border"}`}>
                  {isManualLocation && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="text-xs font-bold select-none cursor-pointer">직접 입력 (지도에 표시되지 않음)</span>
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isManualLocation ? "장소 직접 입력 (예: 전국 GS25)" : "장소 검색 (카카오 주소 API)"}
                  className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (locationInput.trim()) {
                        setLocations(prev => [...prev, locationInput.trim()]);
                        setLocationInput("");
                        toast.success("장소가 등록되었습니다.");
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

                {addrResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-background border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {addrResults.map((addr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectAddress(addr)}
                        className="w-full text-left p-3 hover:bg-muted text-sm border-b last:border-0 border-border/50 transition-colors"
                      >
                        {addr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ticket/Reservation Info */}
            <div className="space-y-4 pt-2 border-t border-border/40">
              <Label className="text-sm font-semibold">예매 정보</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">입장/예매 형태</Label>
                  <Select value={reservationType} onValueChange={setReservationType}>
                    <SelectTrigger className="h-11 bg-muted/30 rounded-xl">
                      <SelectValue placeholder="형태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="자유 입장">자유 입장</SelectItem>
                      <SelectItem value="사전 예약">사전 예약</SelectItem>
                      <SelectItem value="티켓 예매">티켓 예매</SelectItem>
                      <SelectItem value="현장 등록">현장 등록</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reservationType !== "자유 입장" && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 select-none" onClick={() => setShowResSchedule(!showResSchedule)}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${showResSchedule ? "bg-primary border-primary text-white" : "border-border"}`}>
                      {showResSchedule && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold cursor-pointer">예약/예매 일정이 따로 정해져 있습니다.</span>
                  </div>

                  {showResSchedule && (
                    <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2 select-none" onClick={() => setIsResAlways(!isResAlways)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${isResAlways ? "bg-primary border-primary text-white" : "border-border"}`}>
                          {isResAlways && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-bold cursor-pointer">상시 예매/예약</span>
                      </div>

                      {!isResAlways && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-muted-foreground block">예매 시작 일시</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <DateInputTriple
                                year={resStartYear}
                                month={resStartMonth}
                                day={resStartDay}
                                onYearChange={setResStartYear}
                                onMonthChange={setResStartMonth}
                                onDayChange={setResStartDay}
                              />
                              <TimeInputPair
                                hour={resStartHour}
                                minute={resStartMin}
                                onHourChange={setResStartHour}
                                onMinuteChange={setResStartMin}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-muted-foreground block">예매 종료 일시</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <DateInputTriple
                                year={resEndYear}
                                month={resEndMonth}
                                day={resEndDay}
                                onYearChange={setResEndYear}
                                onMonthChange={setResEndMonth}
                                onDayChange={setResEndDay}
                              />
                              <TimeInputPair
                                hour={resEndHour}
                                minute={resEndMin}
                                onHourChange={setResEndHour}
                                onMinuteChange={setResEndMin}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Support Images (Sub posters) */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <Label className="text-sm font-semibold">추가 홍보 이미지</Label>
              <div className="flex flex-wrap gap-4 items-center">
                {supportImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-28 bg-muted rounded-xl overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="Support" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveSupportImage(idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                <div className="relative w-20 h-28 border-2 border-dashed border-muted-foreground/20 rounded-xl flex flex-col items-center justify-center bg-muted/10 hover:bg-muted/30 transition-colors">
                  <input
                    type="file"
                    id="support-images-upload"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleSupportImagesUpload}
                    disabled={isUploadingSupport}
                  />
                  <label htmlFor="support-images-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                    {isUploadingSupport ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground mt-1 font-semibold">추가 업로드</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 4. Online Specific Fields --- */}
        {eventType === "online" && (
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h3 className="font-bold text-lg">온라인 행사 세부 정보</h3>
            </div>

            {/* Online Start/End */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">진행 기간 <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2" onClick={() => setIsOnlineAlways(!isOnlineAlways)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${isOnlineAlways ? "bg-primary border-primary text-white" : "border-border"}`}>
                    {isOnlineAlways && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-bold select-none cursor-pointer">상시 진행 (별도 기한 없음)</span>
                </div>
              </div>

              {!isOnlineAlways && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground block">시작 일시</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <DateInputTriple
                        year={onlineStartYear}
                        month={onlineStartMonth}
                        day={onlineStartDay}
                        onYearChange={setOnlineStartYear}
                        onMonthChange={setOnlineStartMonth}
                        onDayChange={setOnlineStartDay}
                      />
                      <TimeInputPair
                        hour={onlineStartHour}
                        minute={onlineStartMin}
                        onHourChange={setOnlineStartHour}
                        onMinuteChange={setOnlineStartMin}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground block">종료 일시</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <DateInputTriple
                        year={onlineEndYear}
                        month={onlineEndMonth}
                        day={onlineEndDay}
                        onYearChange={setOnlineEndYear}
                        onMonthChange={setOnlineEndMonth}
                        onDayChange={setOnlineEndDay}
                      />
                      <TimeInputPair
                        hour={onlineEndHour}
                        minute={onlineEndMin}
                        onHourChange={setOnlineEndHour}
                        onMinuteChange={setOnlineEndMin}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- 5. Event Links --- */}
        <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h3 className="font-bold text-lg">행사 관련 링크 (선택)</h3>
          </div>

          <div className="space-y-3">
            {eventLinks.map((link, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="링크명 (예: 공식 홈페이지, 티켓 예매처)"
                  value={link.link_name}
                  onChange={(e) => {
                    const newLinks = [...eventLinks];
                    newLinks[idx].link_name = e.target.value;
                    setEventLinks(newLinks);
                  }}
                  className="h-11 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 flex-[1]"
                />
                <Input
                  placeholder="https://"
                  value={link.link_url}
                  onChange={(e) => {
                    const newLinks = [...eventLinks];
                    newLinks[idx].link_url = e.target.value;
                    setEventLinks(newLinks);
                  }}
                  className="h-11 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20 flex-[2]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => setEventLinks(eventLinks.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-dashed border-2 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => setEventLinks([...eventLinks, { link_name: "", link_url: "" }])}
            >
              <Plus className="w-4 h-4 mr-2" /> 링크 추가하기
            </Button>
          </div>
        </div>

        {/* Submit button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            disabled={isSubmitting || isUploadingMain || isUploadingChannelImg || isUploadingSupport}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 제보 등록 중...</>
            ) : (
              "행사 제보 완료하기"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
