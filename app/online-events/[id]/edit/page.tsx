"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, Plus, X, Upload, Loader2, Link as LinkIcon, Check, Search } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { TimeInputPair } from "@/components/events/time-input-pair";
import { DateInputTriple } from "@/components/events/date-input-triple";
import { useEventImageUpload } from "@/hooks/use-event-image-upload";
import RichTextEditor from "@/components/events/rich-text-editor";

type Channel = {
  id: number;
  name: string;
  image_url: string | null;
  type: string | null;
};

export default function EditOnlineEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [ownedChannels, setOwnedChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
  
  const {
    imageUrl,
    setImageUrl,
    imagePath,
    setImagePath,
    isUploading,
    handleImageUpload,
  } = useEventImageUpload();
  
  const [hostId, setHostId] = useState<string>("");
  const [coHosts, setCoHosts] = useState<Channel[]>([]);
  const [eventBaseId, setEventBaseId] = useState<number | null>(null);
  const [eventLinks, setEventLinks] = useState<{ link_name: string; link_url: string }[]>([]);

  // Search co-hosts states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCoHostSearch, setShowCoHostSearch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        // Fetch Online Event Data
        if (eventId) {
          const { data: event, error: eventError } = await supabase
            .from("online_events")
            .select(`
              id, event_id, title, description, start_at, end_at, image_url, links,
              events (
                event_channels ( channels ( id, name, type, image_url, owner_id ) )
              )
            `)
            .eq("id", eventId)
            .maybeSingle();

          if (eventError) throw eventError;

          if (event) {
            setEventBaseId(event.event_id);
            const rawLinks = event.links as Record<string, string> | null;
            const linksArray = (rawLinks && typeof rawLinks === "object")
              ? Object.entries(rawLinks).map(([name, url]) => ({
                  link_name: name,
                  link_url: url
                }))
              : [];
            setEventLinks(linksArray);

            const eventObj = event.events as any;
            // The primary host is generally the first channel registered
            const hostChannels = eventObj?.event_channels || [];
            const mappedChannels = hostChannels
              .map((ec: any) => ec.channels)
              .filter(Boolean);

            if (mappedChannels.length > 0) {
              setHostId(mappedChannels[0].id.toString());
              setCoHosts(mappedChannels.slice(1));
              
              // Verify ownership against the current user's session
              const isEventOwner = mappedChannels.some((ch: any) => ch.owner_id === session.user.id);
              if (!isEventOwner) {
                toast.error("수정 권한이 없습니다.");
                router.push(`/online-events/${eventId}`);
                return;
              }
            }

            setTitle(event.title || "");
            setDescription(event.description || "");
            setImageUrl(event.image_url || null);
            
            if (event.start_at) {
              const dateObj = new Date(event.start_at);
              setStartYear(String(dateObj.getFullYear()));
              setStartMonth(String(dateObj.getMonth() + 1).padStart(2, "0"));
              setStartDay(String(dateObj.getDate()).padStart(2, "0"));
              setStartTimeHour(String(dateObj.getHours()).padStart(2, "0"));
              setStartTimeMin(String(dateObj.getMinutes()).padStart(2, "0"));
              setIsAlways(false);
            } else {
              setIsAlways(true);
            }

            if (event.end_at) {
              const dateObj = new Date(event.end_at);
              setEndYear(String(dateObj.getFullYear()));
              setEndMonth(String(dateObj.getMonth() + 1).padStart(2, "0"));
              setEndDay(String(dateObj.getDate()).padStart(2, "0"));
              setEndTimeHour(String(dateObj.getHours()).padStart(2, "0"));
              setEndTimeMin(String(dateObj.getMinutes()).padStart(2, "0"));
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

    if (!title || !hostId) {
      toast.error("필수 정보를 모두 입력해주세요.");
      return;
    }

    const startDate = startYear && startMonth && startDay ? `${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}` : "";
    const endDate = endYear && endMonth && endDay ? `${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}` : "";

    const tzOffset = (() => {
      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
      return `${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;
    })();

    const startAt = (isAlways || !startDate || !startTimeHour || !startTimeMin) 
      ? null 
      : `${startDate}T${startTimeHour.padStart(2, "0")}:${startTimeMin.padStart(2, "0")}:00${tzOffset}`;

    const endAt = (isAlways || !endDate || !endTimeHour || !endTimeMin) 
      ? null 
      : `${endDate}T${endTimeHour.padStart(2, "0")}:${endTimeMin.padStart(2, "0")}:00${tzOffset}`;

    if (!isAlways && !startAt) {
      toast.error("진행 일정이 입력되지 않았습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Parse Links to Record<string, string>
      const linksObj: Record<string, string> = {};
      eventLinks.forEach(link => {
        if (link.link_name.trim() && link.link_url.trim()) {
          linksObj[link.link_name.trim()] = link.link_url.trim();
        }
      });

      // 2. Update online_events
      const { error: eventError } = await supabase
        .from("online_events")
        .update({
          title,
          description,
          start_at: startAt,
          end_at: endAt,
          image_url: imageUrl,
          links: linksObj,
        })
        .eq("id", eventId);

      if (eventError) throw eventError;

      if (!eventBaseId) throw new Error("기본 행사 정보를 찾을 수 없습니다.");

      // 3. Update event_channels (Delete then Insert)
      const { error: deleteChannelError } = await supabase
        .from("event_channels")
        .delete()
        .eq("event_id", eventBaseId);

      if (deleteChannelError) throw deleteChannelError;

      const channelRelations = [
        { event_id: eventBaseId, channel_id: parseInt(hostId) },
        ...coHosts.map(ch => ({ event_id: eventBaseId, channel_id: ch.id }))
      ];

      const { error: relationError } = await supabase
        .from("event_channels")
        .insert(channelRelations);

      if (relationError) throw relationError;

      toast.success("온라인 행사가 성공적으로 수정되었습니다!");
      router.push(`/online-events/${eventId}`);
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

      <main className="mx-auto max-w-3xl px-4 mt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">온라인 행사 정보 수정</h1>
          <p className="text-muted-foreground mt-2">등록된 온라인 행사 정보를 자유롭게 수정해 보세요.</p>
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
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="행사에 대한 상세 정보를 입력해주세요"
              />
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

            {!isAlways && (
              <div className="grid grid-cols-2 gap-6 pt-2 animate-in fade-in duration-300">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">진행 시작 시간</Label>
                  <TimeInputPair
                    hour={startTimeHour}
                    minute={startTimeMin}
                    onHourChange={setStartTimeHour}
                    onMinuteChange={setStartTimeMin}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">진행 종료 시간</Label>
                  <TimeInputPair
                    hour={endTimeHour}
                    minute={endTimeMin}
                    onHourChange={setEndTimeHour}
                    onMinuteChange={setEndTimeMin}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Links Section */}
          <div className="bg-background rounded-2xl p-6 border border-border shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h2 className="font-bold text-lg flex items-center gap-1.5"><LinkIcon className="w-4 h-4"/> 관련 링크</h2>
            </div>
            
            <div className="space-y-4">
              {eventLinks.map((link, index) => (
                <div key={index} className="flex gap-2 items-center animate-in fade-in duration-200">
                  <Input
                    placeholder="링크 이름 (예: 유튜브 생중계)"
                    value={link.link_name}
                    onChange={(e) => {
                      const newLinks = [...eventLinks];
                      newLinks[index].link_name = e.target.value;
                      setEventLinks(newLinks);
                    }}
                    className="flex-[1] h-12 bg-muted/30 border-border/50 rounded-xl"
                  />
                  <Input
                    placeholder="https://"
                    value={link.link_url}
                    onChange={(e) => {
                      const newLinks = [...eventLinks];
                      newLinks[index].link_url = e.target.value;
                      setEventLinks(newLinks);
                    }}
                    className="flex-[2] h-12 bg-muted/30 border-border/50 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEventLinks(eventLinks.filter((_, i) => i !== index))}
                    className="h-12 w-12 text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => setEventLinks([...eventLinks, { link_name: "", link_url: "" }])}
                className="w-full h-12 rounded-xl border-dashed hover:bg-muted/50 font-bold"
              >
                <Plus className="w-4 h-4 mr-2" /> 관련 링크 추가
              </Button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="h-12 px-6 rounded-xl font-bold"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 px-8 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  저장 중...
                </>
              ) : (
                "저장하기"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
