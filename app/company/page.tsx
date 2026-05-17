"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Users,
  Key,
  Loader2,
  Settings,
  ImageIcon,
  Upload,
  Calendar,
  Globe,
  UserCircle,
  Link as LinkIcon,
  Trash2
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { EventTabs } from "@/components/event-tabs";
import { EventCard } from "@/components/event-card";

type ChannelLink = {
  name: string;
  url: string;
};

type Company = {
  id: number;
  name: string;
  profile_image_url: string | null;
  user_id: string;
};

type Channel = {
  id: number;
  name: string;
  type: string;
  image_url: string | null;
  is_team: boolean;
  owner_id: string | null;
  company: string | null;
  links: ChannelLink[] | null;
};

type Event = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: "자유 입장" | "예약 필수" | "티켓팅" | "휴무" | undefined;
  channels: { id: number; name: string; image_url: string }[];
  isAlways: boolean;
  createdAt: string;
  startDateValue: string | null;
};

const imageColors = [
  "bg-gradient-to-br from-indigo-400 to-indigo-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-green-400 to-green-600",
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-red-400 to-red-600",
];

export default function CompanyPage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Events State
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [offlineEvents, setOfflineEvents] = useState<Event[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Create Channel Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanType, setNewChanType] = useState("youtuber");
  const [newChanIsTeam, setNewChanIsTeam] = useState(false);
  const [newChanImageUrl, setNewChanImageUrl] = useState<string | null>(null);
  const [newChanTeamId, setNewChanTeamId] = useState("none");
  const [teamSearchText, setTeamSearchText] = useState("");
  const [isTeamSearchFocused, setIsTeamSearchFocused] = useState(false);
  const [allTeams, setAllTeams] = useState<{ id: number; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Owner Dialog States
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [targetChan, setTargetChan] = useState<Channel | null>(null);
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Links Dialog States
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [linksTargetChan, setLinksTargetChan] = useState<Channel | null>(null);
  const [linksForm, setLinksForm] = useState<(ChannelLink & { id: string })[]>([]);
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  useEffect(() => {
    if (!transferCode || !codeExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((codeExpiresAt - now) / 1000);
      
      if (diff <= 0) {
        clearInterval(interval);
        toast.error("10분이 경과하여 코드가 만료되었습니다.");
        setIsOwnerOpen(false);
        setTransferCode(null);
        setCodeExpiresAt(null);
        setTargetChan(null);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [transferCode, codeExpiresAt]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("로그인이 필요합니다.");
          router.replace("/");
          return;
        }

        setUser(session.user);

        // Fetch company
        const { data: compData, error: compError } = await supabase
          .from("companies")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (compError) throw compError;

        if (!compData) {
          toast.error("관리자(회사) 권한을 가진 계정이 아닙니다.");
          router.replace("/");
          return;
        }

        setCompany(compData);

        // Fetch associated channels and subsequently events
        await fetchChannelsAndEvents(compData.name);
        
        // Fetch all available Teams for individual member affiliation
        const { data: allTeamsData } = await supabase
          .from("channels")
          .select("id, name")
          .eq("is_team", true)
          .order("name");
        
        if (allTeamsData) {
          setAllTeams(allTeamsData);
        }
        
      } catch (err: any) {
        console.error("Initialization Error:", err);
        toast.error("데이터 로드 중 오류가 발생했습니다.");
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router]);

  const fetchChannelsAndEvents = async (compName: string) => {
    try {
      const { data: chanData, error: chanError } = await supabase
        .from("channels")
        .select("*")
        .eq("company", compName)
        .order("name", { ascending: true });

      if (chanError) throw chanError;
      const activeChannels = chanData || [];
      setChannels(activeChannels);

      // Fetch events linked to these channel IDs
      if (activeChannels.length > 0) {
        await fetchRelatedEvents(activeChannels.map(c => c.id));
      }
    } catch (error) {
      console.error("Error fetching channels and events:", error);
    }
  };

  // Reusable formatting helpers adapted from main page
  const formatEventDate = (start: string | null, end: string | null) => {
    if (!start) return "상시";
    // Strip years and replace dashes with slashes for MM/DD aesthetic as requested previously
    const formatPt = (d: string) => {
      const parts = d.split("-");
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
      return d;
    };
    return end ? `${formatPt(start)} - ${formatPt(end)}` : formatPt(start);
  };

  const formatOnlineEventDate = (start: string | null, end: string | null) => {
    if (!start) return "상시";
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${month}/${day}`;
    };
    const startFormatted = formatDate(start);
    if (!end) return startFormatted;
    const endFormatted = formatDate(end);
    return `${startFormatted} ~ ${endFormatted}`;
  };

  const getCategory = (type?: string) => {
    if (!type) return "기타";
    const t = type.trim().toLowerCase();
    if (t === "game") return "게임";
    if (t === "youtuber") return "유튜버";
    if (t === "festival") return "동인 행사";
    return "기타";
  };

  const fetchRelatedEvents = async (channelIds: number[]) => {
    setIsLoadingEvents(true);
    try {
      // 1. Get linked event_ids
      const { data: evChData, error: evChErr } = await supabase
        .from("event_channels")
        .select("event_id")
        .in("channel_id", channelIds);
      
      if (evChErr) throw evChErr;
      
      const eventIds = Array.from(new Set(evChData?.map(ec => ec.event_id).filter(Boolean) || []));
      
      if (eventIds.length === 0) {
        setOfflineEvents([]);
        setOnlineEvents([]);
        return;
      }

      const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

      // 2. Fetch Offline Events
      const { data: offlineData, error: offErr } = await supabase
        .from("offline_events")
        .select(`
          id,
          title,
          start_date,
          end_date,
          image_url,
          reservation_type,
          created_at,
          events!inner(
            id,
            event_channels(
              channels(id, name, type, image_url)
            )
          ),
          offline_event_locations(location)
        `)
        .in("events.id", eventIds)
        .order("start_date", { ascending: true });

      if (offErr) throw offErr;

      const formattedOffline: Event[] = (offlineData || [])
        .filter(e => !e.end_date || e.end_date >= todayStr)
        .map((event, index) => {
          const chs = (event.events as any)?.event_channels?.map((ec: any) => ec.channels).filter(Boolean) || [];
          return {
            id: event.id,
            title: event.title,
            date: formatEventDate(event.start_date, event.end_date),
            location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
            category: getCategory(chs[0]?.type),
            imageColor: imageColors[index % imageColors.length],
            imageUrl: event.image_url || undefined,
            reservationType: event.reservation_type as Event["reservationType"],
            channels: chs.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
            isAlways: !event.start_date,
            createdAt: event.created_at,
            startDateValue: event.start_date,
          };
        });
      
      setOfflineEvents(formattedOffline);

      // 3. Fetch Online Events
      const { data: onlineData, error: onErr } = await supabase
        .from("online_events")
        .select(`
          id,
          title,
          start_at,
          end_at,
          image_url,
          created_at,
          events!inner(
            id,
            event_channels(
              channels(id, name, type, image_url)
            )
          )
        `)
        .in("events.id", eventIds)
        .order("start_at", { ascending: true });

      if (onErr) throw onErr;

      const formattedOnline: Event[] = (onlineData || [])
        .filter(event => {
          const endAtDate = event.end_at ? event.end_at.split("T")[0] : null;
          return !endAtDate || endAtDate >= todayStr;
        })
        .map((event, index) => {
          const chs = (event.events as any)?.event_channels?.map((ec: any) => ec.channels).filter(Boolean) || [];
          return {
            id: event.id,
            title: event.title,
            date: formatOnlineEventDate(event.start_at, event.end_at),
            location: "온라인",
            category: getCategory(chs[0]?.type),
            imageColor: imageColors[index % imageColors.length],
            imageUrl: event.image_url || undefined,
            reservationType: undefined,
            channels: chs.map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
            isAlways: !event.start_at,
            createdAt: event.created_at,
            startDateValue: event.start_at,
          };
        });

      setOnlineEvents(formattedOnline);

    } catch (error) {
      console.error("Failed to fetch related events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `chan-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `channel-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event_images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event_images")
        .getPublicUrl(filePath);

      setNewChanImageUrl(publicUrl);
      toast.success("이미지 업로드 완료");
    } catch (err: any) {
      console.error(err);
      toast.error("업로드 실패: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!newChanName.trim()) {
      toast.error("채널명을 입력하세요.");
      return;
    }

    const isYoutuber = newChanType === "youtuber";
    const finalIsTeam = isYoutuber ? newChanIsTeam : false;
    const finalTeamId = (isYoutuber && !newChanIsTeam && newChanTeamId !== "none") ? parseInt(newChanTeamId) : null;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("channels")
        .insert([{
          name: newChanName.trim(),
          type: newChanType,
          is_team: finalIsTeam,
          team_id: finalTeamId,
          image_url: newChanImageUrl,
          company: company.name,
          owner_id: user?.id || null
        }]);

      if (error) throw error;

      toast.success(`'${newChanName}' 채널이 성공적으로 생성되었습니다!`);
      
      setNewChanName("");
      setNewChanImageUrl(null);
      setNewChanIsTeam(false);
      setNewChanTeamId("none");
      setTeamSearchText("");
      setIsCreateOpen(false);
      
      await fetchChannelsAndEvents(company.name);
    } catch (err: any) {
      console.error(err);
      toast.error("채널 생성 실패: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const hashString = async (str: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleGenerateTransferCode = async () => {
    if (!targetChan) return;
    setIsAssigning(true);
    try {
      const code = generateRandomCode();
      const codeHash = await hashString(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { error } = await supabase
        .from("owner_transfer_codes")
        .insert({
          channel_id: targetChan.id,
          code_hash: codeHash,
          expires_at: expiresAt,
          is_used: false
        });

      if (error) throw error;

      setTransferCode(code);
      setCodeExpiresAt(Date.now() + 10 * 60 * 1000);
      setTimeLeft(10 * 60);
      toast.success("권한 위임 코드가 생성되었습니다.");
    } catch (err: any) {
      console.error(err);
      toast.error("코드 생성 실패: " + err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSaveLinks = async () => {
    if (!linksTargetChan) return;
    setIsSavingLinks(true);
    try {
      const finalLinks = linksForm.filter(l => l.name.trim() || l.url.trim()).map(({ name, url }) => ({ name, url }));
      const { error } = await supabase
        .from("channels")
        .update({ links: finalLinks.length > 0 ? finalLinks : null })
        .eq("id", linksTargetChan.id);

      if (error) throw error;

      toast.success("링크가 성공적으로 저장되었습니다.");
      setIsLinksOpen(false);
      if (company) {
        await fetchChannelsAndEvents(company.name);
      }
    } catch (err: any) {
      toast.error("링크 저장 실패: " + err.message);
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃 되었습니다.");
    router.replace("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">권한 및 정보 로드 중...</p>
      </div>
    );
  }

  if (!company) return null;

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.email as string | undefined) ??
    "회사 관리자";
  const avatarFallbackText = userName.slice(0, 1).toUpperCase();

  const activeEvents = activeTab === "offline" ? offlineEvents : onlineEvents;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B] text-foreground pb-24">
      
      {/* ✨ CUSTOM SLIM COMPANY HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 md:h-16 px-4 md:px-6 relative">
          
          {/* LEFT: Empty spacer for visual balance to keep logo absolute center */}
          <div className="w-10 sm:w-24" />

          {/* CENTER: Logo Absolute Placement */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 md:gap-2 cursor-pointer pointer-events-auto" onClick={() => router.push("/")}>
              <Image 
                src="/logo.png" 
                alt="Icon" 
                width={100} 
                height={100} 
                className="h-7 w-7 md:h-9 md:w-9 object-contain flex-shrink-0" 
                priority 
                unoptimized
              />
              <Image 
                src="/logo-text.png" 
                alt="Logo" 
                width={180} 
                height={60} 
                className="h-7 md:h-9 w-auto object-contain flex-shrink-0" 
                priority 
                unoptimized
              />
            </div>
          </div>

          {/* RIGHT: Account Dropdown */}
          <div className="flex items-center z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 group cursor-pointer select-none hover:opacity-85 transition-opacity">
                  <span className="hidden sm:inline-block text-xs md:text-sm font-bold tracking-tight group-hover:text-foreground/80 transition-colors max-w-[100px] truncate">
                    {userName}
                  </span>
                  <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border/60 ring-2 ring-orange-500/10 shadow-sm">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-xs">{avatarFallbackText}</AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-2xl shadow-lg mt-1">
                <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground">계정 정보</DropdownMenuLabel>
                <div className="px-2 py-1 text-sm font-bold break-all truncate">{userName}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-50 dark:focus:bg-rose-500/10 font-bold rounded-lg"
                >
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 pt-6 md:pt-8 space-y-8">
        
        {/* Company Hero Info Block */}
        <div className="relative bg-background border border-border/60 rounded-3xl shadow-sm overflow-hidden p-5 md:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-orange-500/15 to-amber-500/5 opacity-40 pointer-events-none" />
          
          <Avatar className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-background shadow-md overflow-hidden flex-shrink-0">
            <AvatarImage src={company.profile_image_url || undefined} className="object-cover" />
            <AvatarFallback className="rounded-2xl bg-orange-100 text-orange-600 font-extrabold text-2xl">
              {company.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          
          <div className="relative z-10 flex-1 text-center sm:text-left space-y-1">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center sm:justify-start gap-2">
              {company.name}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium">
              통합 파트너 관리 콘솔 • 소속 채널 {channels.length}개
            </p>
          </div>
        </div>

        {/* 🚀 "관심 채널" STYLE - COMPANY CHANNELS */}
        <section className="bg-background border border-border rounded-3xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/10">
            <h2 className="font-extrabold text-sm md:text-base flex items-center gap-2 text-foreground/90">
              <Users className="w-4 h-4 text-muted-foreground" /> 소속 채널 현황
            </h2>
          </div>

          <div className="p-4 md:p-6 flex gap-x-4 md:gap-x-6 items-start overflow-x-auto no-scrollbar relative">
            
            {/* Add New Channel Circle Action */}
            <div 
              onClick={() => setIsCreateOpen(true)}
              className="flex flex-col items-center gap-2.5 min-w-[64px] md:min-w-[84px] cursor-pointer group shrink-0"
            >
              <div className="relative w-14 h-14 md:w-16 md:h-16 border-2 border-dashed border-muted-foreground/30 hover:border-orange-500 hover:bg-orange-500/5 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 active:scale-95 shadow-sm">
                <Plus className="w-6 h-6 text-muted-foreground group-hover:text-orange-600 transition-colors" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] md:text-xs font-bold text-muted-foreground group-hover:text-orange-600 leading-tight transition-colors">채널 생성</span>
                <span className="text-[8px] opacity-0 md:text-[9px] md:opacity-60 text-muted-foreground italic leading-tight">New</span>
              </div>
            </div>

            {/* Separator vertical line */}
            <div className="w-px h-14 md:h-16 bg-border shrink-0 opacity-70 self-center" />

            {channels.length === 0 ? (
              <>
                <div className="flex-1 flex flex-col items-center justify-center py-1.5 select-none animate-in fade-in duration-200 gap-2">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center border border-border/50 shadow-sm">
                    <Plus className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground/50" />
                  </div>
                  <span className="text-xs md:text-sm font-medium text-muted-foreground">등록된 소속 채널이 없습니다.</span>
                </div>
                {/* RIGHT: Invisible offset spacer to achieve mathematically absolute center layout */}
                <div className="invisible pointer-events-none select-none shrink-0 flex gap-x-4 md:gap-x-6 items-start">
                  <div className="w-px h-14 md:h-16 bg-border opacity-0 self-center" />
                  <div className="min-w-[64px] md:min-w-[84px]" />
                </div>
              </>
            ) : (
              <>
                {channels.map((channel) => (
                  <div key={channel.id} className="flex flex-col items-center gap-2.5 min-w-[64px] md:min-w-[84px] group relative shrink-0 select-none">
                    
                    <div className="relative w-14 h-14 md:w-16 md:h-16 bg-brand-gradient p-[2.5px] rounded-full shadow-md group-hover:scale-105 transition-all duration-300 ease-out">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-muted flex items-center justify-center shrink-0">
                        {channel.image_url ? (
                          <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base md:text-lg font-black text-muted-foreground/60">{channel.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      {/* Cog wheel badge inside image for Action */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetChan(channel);
                          setTransferCode(null);
                          setIsOwnerOpen(true);
                        }}
                        className="absolute -bottom-1 -right-1 bg-slate-900 hover:bg-orange-600 text-white p-1 rounded-full border-2 border-white transition-all duration-200 shadow-md cursor-pointer scale-95 group-hover:scale-105 active:scale-90 z-10"
                        title="권한 관리"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLinksTargetChan(channel);
                          
                          let initial: (ChannelLink & { id: string })[] = [];
                          let parsedLinks = channel.links;
                          if (typeof channel.links === 'string') {
                            try {
                              parsedLinks = JSON.parse(channel.links);
                            } catch (e) {
                              parsedLinks = null;
                            }
                          }
                          if (Array.isArray(parsedLinks) && parsedLinks.length > 0) {
                            initial = parsedLinks.map(l => ({ ...l, id: Math.random().toString() }));
                          } else if (parsedLinks && typeof parsedLinks === 'object' && Object.keys(parsedLinks).length > 0) {
                            initial = Object.entries(parsedLinks).map(([k, v]) => ({ id: Math.random().toString(), name: k, url: v as string }));
                          }
                          if (initial.length === 0) {
                            initial = [{ id: Math.random().toString(), name: "", url: "" }];
                          }
                          setLinksForm(initial);
                          setIsLinksOpen(true);
                        }}
                        className="absolute -bottom-1 -left-1 bg-slate-900 hover:bg-blue-600 text-white p-1 rounded-full border-2 border-white transition-all duration-200 shadow-md cursor-pointer scale-95 group-hover:scale-105 active:scale-90 z-10"
                        title="링크 관리"
                      >
                        <LinkIcon className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-0.5 min-w-0 w-full px-0.5">
                      <span className="text-[10px] md:text-xs font-bold text-center truncate w-full leading-tight group-hover:text-foreground transition-colors">{channel.name}</span>
                      <span className="text-[8px] md:text-[9px] text-muted-foreground text-center truncate w-full font-medium leading-tight">
                        {channel.type === "youtuber" ? "유튜버" : channel.type === "festival" ? "행사" : "게임"}
                      </span>
                      {/* Tiny Ownership status tag */}
                      <div className={`text-[7px] md:text-[8px] font-mono font-bold mt-0.5 px-1 py-0.5 rounded-full border ${channel.owner_id ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50" : "text-rose-500 bg-rose-50 dark:bg-rose-950/20 border-rose-200/50"}`}>
                        {channel.owner_id ? "위임 완료" : "오너 공석"}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

          </div>
        </section>

        {/* 📅 RELATED EVENTS GRID */}
        <section className="space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg md:text-xl font-black flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" /> 소속 멤버 일정 및 이벤트
            </h2>
            
            <div className="w-full sm:w-auto min-w-[200px]">
              <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
          </div>

          {isLoadingEvents ? (
            <div className="py-24 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-background/50">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 opacity-70" />
              <p className="text-xs text-muted-foreground mt-3 font-medium">이벤트를 불러오는 중...</p>
            </div>
          ) : activeEvents.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-border/50 rounded-3xl bg-background/40 flex flex-col items-center justify-center px-6">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-bold text-foreground">등록된 진행중인 행사가 없습니다.</h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 animate-in fade-in duration-300">
              {activeEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  date={event.date}
                  location={event.location}
                  category={event.category}
                  imageColor={event.imageColor}
                  imageUrl={event.imageUrl}
                  reservationType={event.reservationType}
                  channels={event.channels}
                  user={user}
                  eventType={activeTab}
                  isRightCard={index % 2 === 1}
                  isPriority={index < 4}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Dialog Modals */}

      {/* 1. Create Channel Modal */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          setTeamSearchText("");
        }
      }}>
        <DialogContent className="sm:max-w-[460px] rounded-3xl shadow-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-orange-600" /> 신규 하위 채널 생성
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              소속 기업명(<strong>{company.name}</strong>)으로 자동 귀속되는 새로운 채널을 신설합니다.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateChannel} className="space-y-5 pt-2">
            {/* Profile image in Modal */}
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative w-14 h-14 md:w-16 md:h-16 flex-shrink-0 rounded-xl bg-muted overflow-hidden border border-border flex items-center justify-center shadow-sm">
                {newChanImageUrl ? (
                  <img src={newChanImageUrl} alt="Profile Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                )}
                {isUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground">채널 프로필 이미지</Label>
                <input type="file" id="modal-img" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                <Button type="button" variant="outline" className="h-8 text-[11px] rounded-lg font-bold self-start shadow-sm" asChild disabled={isUploading}>
                  <label htmlFor="modal-img" className="cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3 h-3" /> {newChanImageUrl ? "이미지 변경" : "이미지 선택"}
                  </label>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chanName" className="font-bold text-xs md:text-sm">채널명 <span className="text-destructive">*</span></Label>
              <Input
                id="chanName"
                value={newChanName}
                onChange={e => setNewChanName(e.target.value)}
                placeholder="예: 크리에이터 닉네임 또는 행사 이름"
                className="h-11 rounded-xl"
                required
              />
            </div>

            {/* ROW 1: 활동 유형 (Left) & 소속사 (Right, Fixed) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs md:text-sm">활동 유형</Label>
                <Select value={newChanType} onValueChange={setNewChanType}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="youtuber">유튜버 / 버튜버</SelectItem>
                    <SelectItem value="game">게임</SelectItem>
                    <SelectItem value="festival">축제 / 동인 행사</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-xs md:text-sm">소속사</Label>
                <Input 
                  value={company.name} 
                  disabled 
                  className="h-11 rounded-xl bg-muted/60 text-muted-foreground border-border/50 font-semibold cursor-not-allowed select-none" 
                />
              </div>
            </div>

            {/* ROW 2: 팀/그룹 여부 & 소속 팀 (Only visible for YouTubers) */}
            {newChanType === "youtuber" && (
              <div className="grid grid-cols-2 gap-4 items-end min-h-[68px] animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="space-y-2 flex flex-col justify-between">
                  <Label className="font-bold text-xs md:text-sm mb-2">팀/그룹 여부</Label>
                  <div className="flex items-center gap-2 h-11 px-1">
                    <Switch
                      checked={newChanIsTeam}
                      onCheckedChange={setNewChanIsTeam}
                    />
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {newChanIsTeam ? "그룹형 (Team)" : "개인형"}
                    </span>
                  </div>
                </div>

                <div className="min-h-[68px] flex flex-col justify-end">
                  {!newChanIsTeam && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <Label htmlFor="teamSearch" className="font-bold text-xs md:text-sm">소속 팀 검색</Label>
                      <div className="relative">
                        <Input
                          id="teamSearch"
                          value={teamSearchText}
                          onChange={(e) => {
                            setTeamSearchText(e.target.value);
                            setNewChanTeamId("none"); // Reset ID when typing
                          }}
                          onFocus={() => setIsTeamSearchFocused(true)}
                          onBlur={() => setTimeout(() => setIsTeamSearchFocused(false), 150)}
                          placeholder="소속 없음"
                          className="h-11 rounded-xl bg-muted/20 border-border/60"
                          autoComplete="off"
                        />
                        {isTeamSearchFocused && teamSearchText.trim().length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                            {allTeams.filter(t => t.name.toLowerCase().includes(teamSearchText.toLowerCase())).length > 0 ? (
                              allTeams
                                .filter(t => t.name.toLowerCase().includes(teamSearchText.toLowerCase()))
                                .map(t => (
                                  <div 
                                    key={t.id}
                                    className="px-3 py-2 hover:bg-muted cursor-pointer text-sm font-medium"
                                    onClick={() => {
                                      setNewChanTeamId(t.id.toString());
                                      setTeamSearchText(t.name);
                                      setIsTeamSearchFocused(false);
                                    }}
                                  >
                                    {t.name}
                                  </div>
                                ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-muted-foreground text-center">결과가 없습니다.</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg" disabled={isSubmitting || isUploading}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "채널 생성 완료"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Assign Owner Rights Dialog */}
      <Dialog open={isOwnerOpen} onOpenChange={(open) => {
        setIsOwnerOpen(open);
        if (!open) {
          setTransferCode(null);
          setCodeExpiresAt(null);
          setTargetChan(null);
        }
      }}>
        <DialogContent 
          className="rounded-3xl max-w-[420px] shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg md:text-xl font-extrabold text-foreground">
              <Key className="w-5 h-5 text-orange-600" /> 권한 위임
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm leading-relaxed mt-1">
              '<strong>{targetChan?.name}</strong>' 채널의 권한을 위임할 수 있는 일회용 코드를 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {transferCode ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl border border-border flex flex-col items-center gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">생성된 위임 코드</p>
                  <p className="text-3xl font-mono font-black tracking-widest text-orange-600 select-all">
                    {transferCode}
                  </p>
                  {timeLeft !== null && (
                    <div className="mt-1 text-xs font-bold px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full animate-pulse">
                      남은 시간: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium text-center bg-orange-500/10 p-3 rounded-xl text-orange-700 dark:text-orange-400">
                  🚨 이 코드는 생성 후 <strong>10분간 유효</strong>하며, 한 번만 사용할 수 있습니다. <br/>
                  위임받을 사용자에게 이 코드를 전달해주세요. 창을 닫으면 코드를 다시 볼 수 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground font-medium">
                  아래 버튼을 눌러 8자리 보안 코드를 생성하세요.
                </p>
                <Button 
                  onClick={handleGenerateTransferCode} 
                  className="w-full rounded-xl font-bold bg-orange-600 hover:bg-orange-700 text-white h-12 shadow-md" 
                  disabled={isAssigning}
                >
                  {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "위임 코드 생성하기"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Link Management Modal */}
      <Dialog open={isLinksOpen} onOpenChange={setIsLinksOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-blue-600" /> 링크 관리
            </DialogTitle>
            <DialogDescription>
              {linksTargetChan?.name} 채널의 SNS 링크를 관리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {linksForm.map((link, index) => (
              <div key={link.id} className="flex items-start gap-2 animate-in fade-in duration-200">
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="링크 이름 (예: 유튜브)"
                    value={link.name}
                    onChange={(e) => {
                      const newForm = [...linksForm];
                      newForm[index].name = e.target.value;
                      setLinksForm(newForm);
                    }}
                    className="h-10 rounded-xl sm:flex-[1]"
                  />
                  <Input
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) => {
                      const newForm = [...linksForm];
                      newForm[index].url = e.target.value;
                      setLinksForm(newForm);
                    }}
                    className="h-10 rounded-xl sm:flex-[2]"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLinksForm(linksForm.filter(l => l.id !== link.id))}
                  className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinksForm([...linksForm, { id: Math.random().toString(), name: "", url: "" }])}
              className="w-full h-10 border-dashed rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" /> 링크 추가
            </Button>
          </div>
          <DialogFooter className="mt-6 border-t border-border/50 pt-4">
            <Button
              onClick={handleSaveLinks}
              disabled={isSavingLinks}
              className="w-full h-12 rounded-xl text-base font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSavingLinks ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
