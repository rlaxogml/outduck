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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Camera,
  Save,
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
  Trash2,
  Copy,
  RefreshCw,
  Check,
  CheckCircle2,
  XCircle,
  User,
  Info,
  ChevronDown,
  ChevronUp,
  CircleHelp
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
  invite_code?: string | null;
  is_auto_approved?: boolean | null;
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
  team_id?: number | null;
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

const moveStorageImage = async (imageUrl: string): Promise<string> => {
  try {
    const bucketName = "channel-images";
    const oldFolder = "channel-requests";
    const newFolder = "channel-profile";

    if (!imageUrl || !imageUrl.includes(`/storage/v1/object/public/${bucketName}/${oldFolder}/`)) {
      return imageUrl;
    }

    const parts = imageUrl.split(`${oldFolder}/`);
    const fileName = parts[parts.length - 1];
    if (!fileName) return imageUrl;

    const oldPath = `${oldFolder}/${fileName}`;
    const newPath = `${newFolder}/${fileName}`;

    // Copy the file
    const { error: copyError } = await supabase.storage
      .from(bucketName)
      .copy(oldPath, newPath);

    if (copyError) {
      console.error("Storage copy error, trying move fallback:", copyError);
      const { error: moveError } = await supabase.storage
        .from(bucketName)
        .move(oldPath, newPath);

      if (moveError) {
        throw new Error(`Failed to copy or move image: ${moveError.message}`);
      }
    } else {
      // Delete old file
      const { error: removeError } = await supabase.storage
        .from(bucketName)
        .remove([oldPath]);

      if (removeError) {
        console.warn("Failed to remove old request image:", removeError);
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(newPath);

    return publicUrl;
  } catch (err) {
    console.error("Error moving image in storage:", err);
    return imageUrl;
  }
};

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
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(false);

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
  const [linksTeamId, setLinksTeamId] = useState<string>("none");
  const [linksImageUrl, setLinksImageUrl] = useState<string>("");
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [isUploadingLinkImg, setIsUploadingLinkImg] = useState(false);
  const [showDeleteChanDialog, setShowDeleteChanDialog] = useState(false);
  const [isDeletingChan, setIsDeletingChan] = useState(false);
  const [linksChanName, setLinksChanName] = useState<string>("");
  const [linksChanType, setLinksChanType] = useState<string>("youtuber");
  const [isTransferringChan, setIsTransferringChan] = useState(false);
  const [linksTeamSearchText, setLinksTeamSearchText] = useState("");
  const [isLinksTeamSearchFocused, setIsLinksTeamSearchFocused] = useState(false);

  // Pending Requests State
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isProcessingRequest, setIsProcessingRequest] = useState<number | null>(null);
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(true);
  const [hasInitializedPendingState, setHasInitializedPendingState] = useState(false);

  // Company Edit States
  const [isCompanyEditOpen, setIsCompanyEditOpen] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyImageUrl, setEditCompanyImageUrl] = useState("");
  const [isCompanyUploading, setIsCompanyUploading] = useState(false);
  const [isCompanySaving, setIsCompanySaving] = useState(false);

  const handleCompanyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setIsCompanyUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `company-profile/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('channel-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('channel-images')
        .getPublicUrl(filePath);

      setEditCompanyImageUrl(publicUrl);
    } catch (err: any) {
      console.error(err);
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setIsCompanyUploading(false);
    }
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!editCompanyName.trim()) {
      toast.error("회사 이름을 입력해주세요.");
      return;
    }

    try {
      setIsCompanySaving(true);
      const { error } = await supabase
        .from("companies")
        .update({
          name: editCompanyName.trim(),
          profile_image_url: editCompanyImageUrl || null,
        })
        .eq("id", company.id);

      if (error) throw error;

      setCompany({ ...company, name: editCompanyName.trim(), profile_image_url: editCompanyImageUrl || null });
      setIsCompanyEditOpen(false);
      toast.success("회사 프로필이 수정되었습니다.");
    } catch (err: any) {
      console.error(err);
      toast.error("회사 프로필 수정 중 오류가 발생했습니다.");
    } finally {
      setIsCompanySaving(false);
    }
  };

  const renderChannelItem = (channel: Channel) => {
    return (
      <div key={channel.id} className="flex flex-col items-center gap-2.5 min-w-[64px] md:min-w-[84px] group relative shrink-0 select-none">

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <div className="relative w-14 h-14 md:w-16 md:h-16 bg-brand-gradient p-[2.5px] rounded-full shadow-md group-hover:scale-105 transition-all duration-300 ease-out cursor-pointer">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-muted flex items-center justify-center shrink-0">
                {channel.image_url ? (
                  <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover animate-in fade-in" />
                ) : (
                  <span className="text-base md:text-lg font-black text-muted-foreground/60">{channel.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              {/* Green checkbadge inside image for Action - 오너가 공석(위임 안됨)일 때만 노출 */}
              {!channel.owner_id && (
                <div className="absolute -top-1 -left-1 bg-emerald-500 text-white p-0.5 rounded-full border-2 border-white shadow-md z-10 flex items-center justify-center w-5 h-5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 rounded-2xl shadow-lg mt-1">
            {!channel.owner_id && (
              <>
                <DropdownMenuLabel className="font-extrabold text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/5 px-2 py-1 rounded-md mb-1.5 text-center select-none">
                  회사 소유 채널입니다
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="font-semibold text-xs text-muted-foreground">채널 메뉴</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setLinksTargetChan(channel);
                setLinksChanName(channel.name);
                setLinksChanType(channel.type || "youtuber");
                setLinksTeamId(channel.team_id ? String(channel.team_id) : "none");
                
                let tName = "";
                if (channel.team_id) {
                  const t = allTeams.find(t => t.id === channel.team_id);
                  if (t) tName = t.name;
                }
                setLinksTeamSearchText(tName);

                setLinksImageUrl(channel.image_url || "");

                let initial: (ChannelLink & { id: string })[] = [];
                let parsedLinks: any = channel.links;
                if (typeof parsedLinks === 'string') {
                  try {
                    parsedLinks = JSON.parse(parsedLinks);
                  } catch (e) {
                    parsedLinks = null;
                  }
                }
                if (Array.isArray(parsedLinks) && parsedLinks.length > 0) {
                  initial = parsedLinks.map((l: any) => ({ ...l, id: Math.random().toString() }));
                } else if (parsedLinks && typeof parsedLinks === 'object' && Object.keys(parsedLinks).length > 0) {
                  initial = Object.entries(parsedLinks).map(([k, v]) => ({ id: Math.random().toString(), name: k, url: v as string }));
                }
                if (initial.length === 0) {
                  initial = [{ id: Math.random().toString(), name: "", url: "" }];
                }
                setLinksForm(initial);
                setIsLinksOpen(true);
              }}
              className="cursor-pointer font-bold rounded-lg text-sm"
            >
              채널 정보 수정
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                router.push(`/channels/${channel.id}`);
              }}
              className="cursor-pointer font-bold rounded-lg text-sm text-blue-600 dark:text-blue-400 focus:text-blue-600"
            >
              채널 페이지
            </DropdownMenuItem>
            {!channel.owner_id && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    if ((e.target as HTMLElement).closest('.info-icon')) {
                      e.preventDefault();
                      return;
                    }
                    setTargetChan(channel);
                    setTransferCode(null);
                    setIsOwnerOpen(true);
                  }}
                  className="cursor-pointer font-bold rounded-lg text-sm text-orange-600 dark:text-orange-400 focus:text-orange-600 flex items-center gap-1.5"
                >
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="info-icon flex items-center justify-center hover:bg-orange-500/10 p-0.5 rounded-full transition-colors shrink-0">
                          <Info className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={5} className="max-w-[220px] text-xs font-medium leading-relaxed z-[100] bg-popover text-popover-foreground border shadow-xl break-keep">
                        해당 채널을 회사 계정에서 관리하지 않고 회사 소속의 다른 계정 소유주에게 권한을 양도해 관리하게 합니다.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span>채널 권한 위임</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col items-center gap-0.5 min-w-0 w-full px-0.5">
          <span className="text-[10px] md:text-xs font-bold text-center truncate w-full leading-tight group-hover:text-foreground transition-colors">{channel.name}</span>
          <span className="text-[8px] md:text-[9px] text-muted-foreground text-center truncate w-full font-medium leading-tight">
            {channel.type === "youtuber" ? (channel.is_team ? "유튜버 (팀)" : "유튜버") : channel.type === "vtuber" ? (channel.is_team ? "버튜버 (팀)" : "버튜버") : channel.type === "festival" ? "행사" : "게임"}
          </span>
        </div>
      </div>
    );
  };

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
    console.log("CompanyPage: Initializing...");
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("CompanyPage: Initialization safety timeout reached (5s). Forcing isLoading to false.");
        setIsLoading(false);
      }
    }, 5000);

    const initialize = async () => {
      try {
        console.log("CompanyPage: Fetching session...");
        const { data: { session } } = await supabase.auth.getSession();
        console.log("CompanyPage: Session fetched.", { hasSession: !!session });
        if (!session) {
          toast.error("로그인이 필요합니다.");
          if (isMounted) {
            router.replace("/");
          }
          return;
        }

        if (isMounted) {
          setUser(session.user);
        }

        // Fetch company
        console.log("CompanyPage: Fetching company data...");
        const { data: compData, error: compError } = await supabase
          .from("companies")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (compError) throw compError;

        console.log("CompanyPage: Company data fetched.", { hasCompany: !!compData });
        if (!compData) {
          toast.error("관리자(회사) 권한을 가진 계정이 아닙니다.");
          if (isMounted) {
            router.replace("/");
          }
          return;
        }

        if (isMounted) {
          setCompany(compData);
        }

        // Fetch associated channels and subsequently events
        console.log("CompanyPage: Fetching channels and events...");
        await fetchChannelsAndEvents(compData.name);

        // Fetch pending requests for the company
        await fetchPendingRequests(compData.id);

        // Fetch all available Teams for individual member affiliation
        await fetchTeams(isMounted);

      } catch (err: any) {
        console.error("CompanyPage: Initialization Error:", err);
        toast.error("데이터 로드 중 오류가 발생했습니다.");
        if (isMounted) {
          router.replace("/");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        clearTimeout(safetyTimeout);
        console.log("CompanyPage: Initialization completed.");
      }
    };

    initialize();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
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

  const fetchTeams = async (isMounted?: boolean) => {
    try {
      const { data: allTeamsData } = await supabase
        .from("channels")
        .select("id, name")
        .eq("is_team", true)
        .order("name");

      if (allTeamsData) {
        if (isMounted === undefined || isMounted) {
          setAllTeams(allTeamsData);
        }
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
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
    if (t === "vtuber") return "버튜버";
    if (t === "festival") return "축제";
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
        .or(`end_date.gte.${todayStr},end_date.is.null`)
        .order("start_date", { ascending: true });

      if (offErr) throw offErr;

      const formattedOffline: Event[] = (offlineData || [])
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
        .or(`end_at.gte.${todayStr},end_at.is.null`)
        .order("start_at", { ascending: true });

      if (onErr) throw onErr;

      const formattedOnline: Event[] = (onlineData || [])
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

  const fetchPendingRequests = async (companyId: number) => {
    try {
      const { data, error } = await supabase
        .from("channel_requests")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const requests = data || [];
      setPendingRequests(requests);
      if (!hasInitializedPendingState) {
        setIsPendingCollapsed(requests.length === 0);
        setHasInitializedPendingState(true);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests:", err);
    }
  };

  const handleUpdateInviteCode = async () => {
    if (!company) return;
    const newCode = generateRandomCode();
    try {
      const { error } = await supabase
        .from("companies")
        .update({ invite_code: newCode })
        .eq("id", company.id);

      if (error) throw error;

      setCompany(prev => prev ? { ...prev, invite_code: newCode } : null);
      toast.success("소속 코드가 성공적으로 업데이트되었습니다.");
    } catch (err: any) {
      console.error("Failed to update invite code:", err);
      toast.error("소속 코드 업데이트 실패: " + err.message);
    }
  };

  const handleToggleAutoApprove = async (checked: boolean) => {
    if (!company) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_auto_approved: checked })
        .eq("id", company.id);

      if (error) throw error;

      setCompany(prev => prev ? { ...prev, is_auto_approved: checked } : null);
      toast.success(checked ? "자동 가입 승인이 활성화되었습니다." : "자동 가입 승인이 비활성화되었습니다.");
    } catch (err: any) {
      console.error("Failed to update auto-approve setting:", err);
      toast.error("설정 변경 실패: " + err.message);
    }
  };

  const handleCopyInviteCode = () => {
    if (!company?.invite_code) return;
    navigator.clipboard.writeText(company.invite_code);
    toast.success("소속 코드가 클립보드에 복사되었습니다.");
  };

  const handleDeactivateInviteCode = async () => {
    if (!company) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ invite_code: null })
        .eq("id", company.id);

      if (error) throw error;

      setCompany(prev => prev ? { ...prev, invite_code: null } : null);
      toast.success("소속 코드가 비활성화되었습니다.");
    } catch (err: any) {
      console.error("Failed to deactivate invite code:", err);
      toast.error("코드 비활성화 실패: " + err.message);
    }
  };

  const handleRequestAction = async (request: any, action: "approve" | "reject") => {
    if (!company) return;
    setIsProcessingRequest(request.id);

    try {
      const newStatus = action === "approve" ? "approved" : "rejected";
      let finalImageUrl = request.image_url;

      if (action === "approve" && request.image_url) {
        finalImageUrl = await moveStorageImage(request.image_url);
      }

      const { error: updateError } = await supabase
        .from("channel_requests")
        .update({
          status: newStatus,
          image_url: finalImageUrl
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      if (action === "approve") {
        const { error: insertError } = await supabase
          .from("channels")
          .insert([{
            name: request.name,
            type: request.type,
            image_url: finalImageUrl,
            is_team: request.is_team,
            team_id: request.team_id,
            owner_id: request.user_id,
            links: request.links,
            company: request.company
          }]);

        if (insertError) {
          console.error("Channel insert error:", insertError);
          toast.warning("상태는 변경되었으나 채널 생성 실패: " + insertError.message);
        } else {
          toast.success("채널이 승인되어 시스템에 즉시 등록되었습니다!");
        }

        // Force update the channel image_url in channels table in case it was auto-created or needs syncing
        await supabase
          .from("channels")
          .update({ image_url: finalImageUrl })
          .eq("name", request.name);
      } else {
        toast.success("신청을 거절 처리했습니다.");
      }

      await fetchPendingRequests(company.id);
      await fetchChannelsAndEvents(company.name);
      await fetchTeams();
    } catch (error: any) {
      console.error("Failed to process request:", error);
      toast.error("오류 발생: " + error.message);
    } finally {
      setIsProcessingRequest(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `chan-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `channel-profile/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("channel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("channel-images")
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

    const isYoutuberOrVtuber = newChanType === "youtuber" || newChanType === "vtuber";
    const finalIsTeam = isYoutuberOrVtuber ? newChanIsTeam : false;
    const finalTeamId = (isYoutuberOrVtuber && !newChanIsTeam && newChanTeamId !== "none") ? parseInt(newChanTeamId) : null;

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
          owner_id: null
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
      await fetchTeams();
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

  const handleLinkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLinkImg(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `chan-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `channel-profile/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("channel-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("channel-images")
        .getPublicUrl(filePath);

      setLinksImageUrl(publicUrl);
      toast.success("이미지 업로드 완료");
    } catch (err: any) {
      toast.error("업로드 실패: " + err.message);
    } finally {
      setIsUploadingLinkImg(false);
    }
  };

  const handleTransferChannel = async () => {
    if (!linksTargetChan) return;
    setIsTransferringChan(true);
    try {
      const { error } = await supabase
        .from("channels")
        .update({ company: null })
        .eq("id", linksTargetChan.id);

      if (error) throw error;

      toast.success("소속사 이적 처리가 완료되었습니다.");
      setIsLinksOpen(false);
      if (company) {
        await fetchChannelsAndEvents(company.name);
        await fetchTeams();
      }
    } catch (e: any) {
      toast.error("이적 처리 실패: " + e.message);
    } finally {
      setIsTransferringChan(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!linksTargetChan) return;
    setIsDeletingChan(true);
    try {
      // 1. event_channels에서 해당 channel_id와 연결된 모든 event_id 조회
      const { data: eventChannels, error: fetchErr } = await supabase
        .from("event_channels")
        .select("event_id")
        .eq("channel_id", linksTargetChan.id);
      if (fetchErr) throw fetchErr;

      const eventIds = (eventChannels || []).map(ec => ec.event_id).filter(Boolean) as number[];
      let orphanEventIds: number[] = [];

      if (eventIds.length > 0) {
        // 2. 해당 행사들이 또 다른 채널과 연결되어 있는지 확인
        const { data: allLinks, error: linksErr } = await supabase
          .from("event_channels")
          .select("event_id, channel_id")
          .in("event_id", eventIds);
        if (linksErr) throw linksErr;

        const counts: Record<number, number> = {};
        (allLinks || []).forEach(link => {
          counts[link.event_id] = (counts[link.event_id] || 0) + 1;
        });

        orphanEventIds = eventIds.filter(id => counts[id] === 1);
      }

      // 3. event_channels 관계 삭제
      const { error: delLinksErr } = await supabase
        .from("event_channels")
        .delete()
        .eq("channel_id", linksTargetChan.id);
      if (delLinksErr) throw delLinksErr;

      // 4. 고아가 된 행사 데이터 삭제 - DB-level ON DELETE CASCADE로 부모 테이블만 삭제하면 하위 데이터도 자동 삭제됩니다.
      if (orphanEventIds.length > 0) {
        const { error: delEvErr } = await supabase
          .from("events")
          .delete()
          .in("id", orphanEventIds);
        if (delEvErr) throw delEvErr;
      }

      // 5. 채널 삭제
      const { error: delChanErr } = await supabase
        .from("channels")
        .delete()
        .eq("id", linksTargetChan.id);
      if (delChanErr) throw delChanErr;

      toast.success("채널과 관련 행사가 완전히 삭제되었습니다.");
      setShowDeleteChanDialog(false);
      setIsLinksOpen(false);
      if (company) {
        await fetchChannelsAndEvents(company.name);
        await fetchTeams();
      }
    } catch (e: any) {
      toast.error("삭제 실패: " + e.message);
    } finally {
      setIsDeletingChan(false);
    }
  };

  const handleSaveLinks = async () => {
    if (!linksTargetChan) return;
    setIsSavingLinks(true);
    try {
      // Delete old channel image from storage if the image is being replaced
      if (linksTargetChan.image_url && linksImageUrl !== linksTargetChan.image_url) {
        const bucketName = "channel-images";
        const folder = "channel-profile";
        if (linksTargetChan.image_url.includes(`/storage/v1/object/public/${bucketName}/${folder}/`)) {
          const parts = linksTargetChan.image_url.split(`${folder}/`);
          const fileName = parts[parts.length - 1];
          if (fileName) {
            const { error: removeError } = await supabase.storage
              .from(bucketName)
              .remove([`${folder}/${fileName}`]);
            if (removeError) {
              console.warn("Failed to delete old channel image from storage:", removeError);
            } else {
              console.log("Successfully deleted old channel image:", fileName);
            }
          }
        }
      }

      if (!linksChanName.trim()) {
        toast.error("채널 이름을 입력해주세요.");
        setIsSavingLinks(false);
        return;
      }

      const finalLinks = linksForm.filter(l => l.name.trim() || l.url.trim()).map(({ name, url }) => ({ name, url }));
      const { error } = await supabase
        .from("channels")
        .update({
          name: linksChanName.trim(),
          type: linksChanType,
          links: finalLinks.length > 0 ? finalLinks : null,
          team_id: linksTeamId === "none" ? null : Number(linksTeamId),
          image_url: linksImageUrl || null
        })
        .eq("id", linksTargetChan.id);

      if (error) throw error;

      toast.success("채널 정보가 성공적으로 업데이트되었습니다.");
      setIsLinksOpen(false);
      if (company) {
        await fetchChannelsAndEvents(company.name);
        await fetchTeams();
      }
    } catch (err: any) {
      toast.error("정보 저장 실패: " + err.message);
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
            <DropdownMenu modal={false}>
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
        <div className="relative bg-background border border-border/60 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          {/* Top Profile Section */}
          <div className="relative p-5 md:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-orange-500/15 to-amber-500/5 opacity-40 pointer-events-none" />

            <Avatar className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-background shadow-md overflow-hidden flex-shrink-0">
              <AvatarImage src={company.profile_image_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-2xl bg-orange-100 text-orange-600 font-extrabold text-2xl">
                {company.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <div className="relative z-10 flex-1 text-center sm:text-left space-y-1">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center sm:justify-start gap-2 w-fit mx-auto sm:mx-0">
                {company.name}
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm font-medium">
                통합 파트너 관리 콘솔 • 소속 채널 {channels.length}개
              </p>
            </div>

            {/* Action Buttons (Ad Apply & Profile Edit) */}
            <div className="relative z-10 sm:self-center mt-2 sm:mt-0 w-full sm:w-auto shrink-0 flex items-center justify-center sm:justify-start gap-2">
              <Button
                onClick={() => router.push("/ad-apply")}
                className="flex-1 sm:flex-initial bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl md:rounded-2xl text-sm shadow-sm md:shadow-md h-11 md:h-10 px-5 transition-all flex items-center justify-center gap-1.5"
              >
                광고 신청
              </Button>
              <Button
                onClick={() => {
                  if (company) {
                    setEditCompanyName(company.name);
                    setEditCompanyImageUrl(company.profile_image_url || "");
                    setIsCompanyEditOpen(true);
                  }
                }}
                variant="outline"
                className="flex-1 sm:flex-initial font-bold rounded-xl md:rounded-2xl text-sm shadow-sm md:shadow-md h-11 md:h-10 px-4 transition-all flex items-center justify-center gap-1.5 border-border bg-background hover:bg-muted text-foreground"
              >
                <Settings className="w-4 h-4 mr-0.5" />
                프로필 수정
              </Button>
            </div>
          </div>

          {/* Bottom Invite Code Section */}
          <div className="border-t border-border/60 bg-muted/10 p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left Column: Invite Code */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-orange-500/10 text-orange-600 rounded-xl shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-start flex-1 min-w-0 gap-4 md:gap-6 w-full">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs md:text-sm font-bold text-foreground shrink-0">소속 가입 코드</span>
                    {company.invite_code && (
                      <Badge variant="outline" className="text-[9px] font-extrabold h-4.5 border-orange-500/20 text-orange-600 bg-orange-500/5 shrink-0">
                        활성 상태
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                    일반 채널을 회사계정에 편입시키는 코드
                  </p>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap justify-start shrink-0">
                  {company.invite_code ? (
                    <>
                      <div className="flex items-center gap-4 bg-background border border-border/60 rounded-xl px-2.5 py-1.5 shadow-sm shrink-0">
                        <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground uppercase">Code</span>
                        <span className="text-sm font-mono font-black tracking-wider text-orange-600 select-all">
                          {company.invite_code}
                        </span>
                        <Button
                          onClick={handleCopyInviteCode}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-lg mr-1 hover:bg-orange-500/10 hover:text-orange-600 transition-all shadow-none border-none shrink-0"
                          title="코드 복사"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleDeactivateInviteCode}
                          variant="outline"
                          className="h-9 rounded-lg text-xs font-bold border-rose-300 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-500/30 dark:hover:bg-rose-500/10 flex items-center gap-1.5 px-3 shadow-none shrink-0 transition-all"
                          title="코드 비활성화"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          비활성화
                        </Button>
                        <Button
                          onClick={handleUpdateInviteCode}
                          variant="outline"
                          className="h-9 rounded-lg text-xs font-bold border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-1.5 px-3 shadow-none shrink-0 transition-all"
                          title="코드 재발급"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          재발급
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={handleUpdateInviteCode}
                      className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-1.5 px-4"
                    >
                      <Plus className="w-3.5 h-3.5" /> 소속 가입 코드 생성
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column: Auto Join Approval Switch */}
            <div className="flex items-center justify-between md:justify-start gap-4 py-3 md:py-0 border-y md:border-y-0 md:border-x border-border/50 md:px-6 shrink-0 animate-in fade-in">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs md:text-sm font-bold text-foreground">자동 가입 승인</span>
                  <Badge className={`text-[8px] md:text-[9px] font-extrabold h-4 md:h-4.5 px-1 md:px-1.5 rounded-full border-none shadow-none shrink-0 ${company.is_auto_approved ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                    {company.is_auto_approved ? "자동" : "수동 대기"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">소속 코드로 가입 신청 시 즉시 승인 및 채널 자동 생성</p>
              </div>
              <Switch
                checked={!!company.is_auto_approved}
                onCheckedChange={handleToggleAutoApprove}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>


          </div>
        </div>

        {/* 🚀 "관심 채널" STYLE - COMPANY CHANNELS */}
        <section className="bg-background border border-border rounded-3xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/10">
            <h2 className="font-extrabold text-sm md:text-base flex items-center gap-2 text-foreground/90">
              <Users className="w-4 h-4 text-muted-foreground" /> 소속 채널 현황
            </h2>
          </div>

          {!isChannelsExpanded ? (
            /* COLLAPSED VIEW: Horizontal scroll list with absolute positioned '더보기' button */
            <div className="relative w-full overflow-hidden">
              <div className="p-4 md:p-6 flex gap-x-4 md:gap-x-6 items-start overflow-x-auto no-scrollbar pr-20 md:pr-24 w-full">
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
                  <div className="flex-1 flex flex-col items-center justify-center py-1.5 select-none animate-in fade-in duration-200 gap-2">
                    <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center border border-border/50 shadow-sm">
                      <Plus className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground/50" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-muted-foreground">등록된 소속 채널이 없습니다.</span>
                  </div>
                ) : (
                  channels.map((channel) => renderChannelItem(channel))
                )}
              </div>

              {/* FLOATING "더보기" BUTTON: Pinned to the right edge with absolute position */}
              {channels.length > 0 && (
                <div className="absolute right-0 top-0 bottom-0 w-20 md:w-24 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 dark:to-transparent flex items-center justify-end pr-4 md:pr-6 pointer-events-none">
                  <button
                    onClick={() => setIsChannelsExpanded(true)}
                    className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full border border-orange-500/30 bg-background/90 dark:bg-zinc-900/90 text-orange-600 dark:text-orange-400 shadow-md hover:scale-110 active:scale-95 group transition-all duration-300"
                    title="더보기"
                  >
                    <ChevronDown className="w-5 h-5 group-hover:animate-bounce" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* EXPANDED VIEW: CSS Grid with bottom full-width collapse panel */
            <div className="flex flex-col w-full">
              <div className="p-4 md:p-6 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 justify-items-center w-full">
                {/* Add New Channel Circle Action */}
                <div
                  onClick={() => setIsCreateOpen(true)}
                  className="flex flex-col items-center gap-2.5 cursor-pointer group"
                >
                  <div className="relative w-14 h-14 md:w-16 md:h-16 border-2 border-dashed border-muted-foreground/30 hover:border-orange-500 hover:bg-orange-500/5 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 active:scale-95 shadow-sm">
                    <Plus className="w-6 h-6 text-muted-foreground group-hover:text-orange-600 transition-colors" />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-muted-foreground group-hover:text-orange-600 leading-tight transition-colors">채널 생성</span>
                    <span className="text-[8px] opacity-0 md:text-[9px] md:opacity-60 text-muted-foreground italic leading-tight">New</span>
                  </div>
                </div>

                {/* Separator vertical line is hidden in Expanded View */}

                {channels.map((channel) => renderChannelItem(channel))}
              </div>

              {/* FULL-WIDTH CLICKABLE "닫기" BAR */}
              <div
                onClick={() => setIsChannelsExpanded(false)}
                className="w-full border-t border-border bg-gradient-to-r from-orange-500/5 via-amber-500/[0.02] to-orange-500/5 hover:from-orange-500/10 hover:via-amber-500/[0.05] hover:to-orange-500/10 py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 group select-none"
              >
                <span className="text-xs md:text-sm font-bold text-orange-600 dark:text-orange-400 group-hover:scale-105 transition-transform duration-200">
                  닫기
                </span>
                <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400 group-hover:animate-bounce" />
              </div>
            </div>
          )}
        </section>

        {/* 🔑 소속 신청 승인 관리 콘솔 */}
        <section className={`bg-background border border-border rounded-3xl shadow-sm p-6 flex flex-col justify-between transition-all duration-300 ${isPendingCollapsed ? "min-h-0 py-4.5" : "min-h-[200px]"}`}>
          <div className="flex-1 flex flex-col">
            <div
              onClick={() => setIsPendingCollapsed(!isPendingCollapsed)}
              className="flex items-center justify-between pb-1 cursor-pointer select-none group"
            >
              <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2 text-foreground/90 group-hover:text-orange-600 transition-colors">
                <UserCircle className="w-4.5 h-4.5 text-muted-foreground group-hover:text-orange-500 transition-colors" /> 소속 가입 신청 대기 목록
                <Badge className="ml-1 bg-orange-500/10 text-orange-600 hover:bg-orange-500/10 border-none font-extrabold text-xs">
                  {pendingRequests.length}
                </Badge>
              </h3>
              <div className="p-1 hover:bg-muted/50 rounded-lg transition-colors text-muted-foreground group-hover:text-orange-600 shrink-0">
                {isPendingCollapsed ? (
                  <ChevronDown className="w-5 h-5 transition-transform" />
                ) : (
                  <ChevronUp className="w-5 h-5 transition-transform" />
                )}
              </div>
            </div>

            {!isPendingCollapsed && (
              <div className="space-y-4 flex-1 flex flex-col mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {pendingRequests.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 select-none border border-dashed border-border/60 rounded-2xl bg-muted/5 gap-2.5">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shadow-sm border border-border/30">
                      <User className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-foreground/80">가입 신청 현황이 깨끗합니다!</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">대기 중인 신규 주최자 가입 신청이 없습니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1.5 no-scrollbar">
                    {pendingRequests.map((request) => {
                      const linksCount = request.links ? (Array.isArray(request.links) ? request.links.length : Object.keys(request.links).length) : 0;
                      return (
                        <div
                          key={request.id}
                          className="p-3.5 bg-muted/20 border border-border/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-11 h-11 border border-border shadow-sm rounded-xl shrink-0">
                              <AvatarImage src={request.image_url || undefined} className="object-cover" />
                              <AvatarFallback className="rounded-xl bg-orange-100 text-orange-600 font-extrabold text-sm">
                                {request.name.slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-foreground truncate max-w-[150px]">{request.name}</span>
                                <span className="text-[9px] text-muted-foreground font-semibold">
                                  {new Date(request.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <Badge className="text-[9px] font-bold h-4.5 px-1.5 bg-muted border-border/50 text-muted-foreground hover:bg-muted">
                                  {request.type === "youtuber" ? "유튜버" : request.type === "vtuber" ? "버튜버" : request.type === "festival" ? "축제" : "게임"}
                                </Badge>
                                {request.is_team && (
                                  <Badge className="text-[9px] font-bold h-4.5 px-1.5 bg-orange-500/5 border-orange-500/10 text-orange-600 hover:bg-orange-500/5">
                                    단체 / 팀
                                  </Badge>
                                )}
                                {linksCount > 0 && (
                                  <Badge variant="outline" className="text-[9px] font-bold h-4.5 px-1.5 text-blue-600 border-blue-500/10 bg-blue-500/5">
                                    링크 {linksCount}개
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 self-end sm:self-center">
                            <Button
                              onClick={() => handleRequestAction(request, "reject")}
                              disabled={isProcessingRequest !== null}
                              className="flex-1 sm:flex-initial h-9 px-3 text-xs font-bold rounded-xl border-border bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              {isProcessingRequest === request.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> 거절</span>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleRequestAction(request, "approve")}
                              disabled={isProcessingRequest !== null}
                              className="flex-1 sm:flex-initial h-9 px-3.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-sm"
                            >
                              {isProcessingRequest === request.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 승인</span>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 animate-in fade-in duration-300">
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
                <Select
                  value={newChanType}
                  onValueChange={(val) => {
                    setNewChanType(val);
                    if (val !== "youtuber" && val !== "vtuber") {
                      setNewChanIsTeam(false);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="game">게임</SelectItem>
                    <SelectItem value="youtuber">유튜버</SelectItem>
                    <SelectItem value="vtuber">버튜버</SelectItem>
                    <SelectItem value="festival">축제</SelectItem>
                  </SelectContent>
                </Select>

                {(newChanType === "youtuber" || newChanType === "vtuber") && (
                  <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200 select-none">
                    <Checkbox
                      id="newChanIsTeam"
                      checked={newChanIsTeam}
                      onCheckedChange={(checked) => setNewChanIsTeam(!!checked)}
                    />
                    <Label htmlFor="newChanIsTeam" className="text-xs font-bold md:text-sm flex items-center gap-1.5 cursor-pointer">
                      팀 채널
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center p-0.5">
                              <CircleHelp className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-2 max-w-xs shadow-xl z-50 text-xs">
                            체크 시 다른 채널들을 소속팀으로 연결해 등록할 수 있습니다
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                  </div>
                )}
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

            {/* ROW 2: 소속 팀 (Only visible for YouTubers/Vtubers who are not teams) */}
            {(newChanType === "youtuber" || newChanType === "vtuber") && !newChanIsTeam && (
              <div className="grid grid-cols-2 gap-4 items-end min-h-[68px] animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="space-y-2 flex flex-col justify-between hidden">
                  {/* Placeholder to keep layout consistent */}
                </div>

                <div className="min-h-[68px] flex flex-col justify-end col-span-2">
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
                      {isTeamSearchFocused && (
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
                  <div className="mt-3 text-[11px] font-medium text-muted-foreground bg-background/60 p-2.5 rounded-lg border border-border/50 w-full flex items-start sm:items-center justify-center gap-1.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 sm:mt-0 shrink-0" />
                    <p className="leading-relaxed break-keep text-left sm:text-center">
                      위임받을 사용자는 <span className="text-foreground font-bold mx-0.5">상단 프로필 클릭 <span className="text-muted-foreground font-normal text-[10px] mx-0.5">→</span> 마이페이지 <span className="text-muted-foreground font-normal text-[10px] mx-0.5">→</span> 고급설정</span>에서 입력해주세요.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium text-center bg-orange-500/10 p-3 rounded-xl text-orange-700 dark:text-orange-400">
                  🚨 이 코드는 생성 후 <strong>10분간 유효</strong>하며, 한 번만 사용할 수 있습니다. <br />
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

      {/* 3. Redesigned Channel Info Edit Modal (Agency-managed) */}
      <Dialog open={isLinksOpen} onOpenChange={setIsLinksOpen}>
        <DialogContent className="sm:max-w-[540px] rounded-3xl shadow-2xl p-6 bg-background border border-border">
          {/* Accessibility Header */}
          <DialogHeader className="sr-only">
            <DialogTitle>채널 정보 수정</DialogTitle>
            <DialogDescription>
              소속 채널의 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          {/* Top Channel Identity Section */}
          <div className="flex items-center gap-4 pb-4 border-b border-border/50">
            <Avatar className="h-16 w-16 border border-slate-200 dark:border-slate-800 bg-background shadow-sm shrink-0">
              <AvatarImage src={linksImageUrl || undefined} className="object-cover" />
              <AvatarFallback className="text-xl font-bold bg-muted-foreground/10 text-muted-foreground flex items-center justify-center">
                {linksTargetChan?.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="text-xl font-black text-foreground">{linksTargetChan?.name}</h4>
              <p className="text-sm text-muted-foreground font-semibold">
                {linksChanType === "youtuber"
                  ? (linksTargetChan?.is_team ? "유튜버 팀 채널" : "유튜버 채널")
                  : linksChanType === "vtuber"
                  ? (linksTargetChan?.is_team ? "버튜버 팀 채널" : "버튜버 채널")
                  : linksChanType === "festival"
                  ? "행사 채널"
                  : "게임 채널"}
              </p>
            </div>
          </div>

          <div className="space-y-5 pt-3">
            {/* 0. Channel Name Edit */}
            <div className="space-y-1.5">
              <Label htmlFor="editChanName" className="text-xs md:text-sm font-bold text-foreground">채널 이름</Label>
              <Input
                id="editChanName"
                value={linksChanName}
                onChange={e => setLinksChanName(e.target.value)}
                placeholder="채널 이름을 입력하세요"
                className="h-10 border-neutral-300 dark:border-neutral-700 rounded-xl bg-background"
                required
              />
            </div>
            {/* Channel Type Edit */}
            <div className="space-y-1.5">
              <Label className="text-xs md:text-sm font-bold text-foreground">활동 유형</Label>
              <Select value={linksChanType} onValueChange={setLinksChanType}>
                <SelectTrigger className="h-10 border-neutral-300 dark:border-neutral-700 rounded-xl bg-background">
                  <SelectValue placeholder="유형 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="game">게임</SelectItem>
                  <SelectItem value="youtuber">유튜버</SelectItem>
                  <SelectItem value="vtuber">버튜버</SelectItem>
                  <SelectItem value="festival">축제</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* 1. Profile Image Change */}
            <div className="space-y-1.5">
              <Label className="text-xs md:text-sm font-bold text-foreground">프로필 이미지 변경</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLinkImageUpload}
                  disabled={isUploadingLinkImg}
                  className="max-w-xs h-10 border-neutral-300 dark:border-neutral-700 rounded-xl cursor-pointer bg-background"
                />
                {isUploadingLinkImg && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
              </div>
            </div>

            {/* 2. Agency & Team Affiliation */}
            <div className={`grid grid-cols-1 ${!linksTargetChan?.is_team ? "sm:grid-cols-2" : ""} gap-4`}>
              {/* Agency (Read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm font-bold text-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-muted-foreground" /> 소속사
                </Label>
                <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-800 h-10 select-none w-fit max-w-full">
                  <Avatar className="h-6 w-6 border shadow-sm bg-background shrink-0">
                    <AvatarImage src={company.profile_image_url || undefined} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-bold bg-muted-foreground/10 flex items-center justify-center">
                      {company.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs md:text-sm font-bold text-foreground truncate">{company.name}</span>
                </div>
              </div>

              {/* Team Selector */}
              {!linksTargetChan?.is_team && (
                <div className="space-y-1.5">
                  <Label className="text-xs md:text-sm font-bold text-foreground flex items-center gap-1">
                    <Users className="w-4 h-4 text-muted-foreground" /> 소속 팀
                  </Label>
                  <div className="relative">
                    <Input
                      value={linksTeamSearchText}
                      onChange={(e) => {
                        setLinksTeamSearchText(e.target.value);
                        setLinksTeamId("none"); // Reset ID when typing
                      }}
                      onFocus={() => setIsLinksTeamSearchFocused(true)}
                      onBlur={() => setTimeout(() => setIsLinksTeamSearchFocused(false), 150)}
                      placeholder="소속 없음"
                      className="h-10 border-neutral-300 dark:border-neutral-700 rounded-xl bg-background text-xs md:text-sm"
                      autoComplete="off"
                    />
                    {isLinksTeamSearchFocused && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                        {allTeams.filter(t => t.name.toLowerCase().includes(linksTeamSearchText.toLowerCase())).length > 0 ? (
                          allTeams
                            .filter(t => t.name.toLowerCase().includes(linksTeamSearchText.toLowerCase()))
                            .map(t => (
                              <div
                                key={t.id}
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-xs md:text-sm font-medium"
                                onClick={() => {
                                  setLinksTeamId(t.id.toString());
                                  setLinksTeamSearchText(t.name);
                                  setIsLinksTeamSearchFocused(false);
                                }}
                              >
                                {t.name}
                              </div>
                            ))
                        ) : (
                          <div className="px-3 py-2 text-xs md:text-sm text-muted-foreground text-center">결과가 없습니다.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. SNS Links Management */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm font-bold text-foreground flex items-center gap-1">
                <LinkIcon className="w-4 h-4 text-muted-foreground" /> SNS 링크
              </Label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                {linksForm.map((link, index) => (
                  <div key={link.id} className="flex items-center gap-2 animate-in fade-in duration-200">
                    <Input
                      placeholder="링크 이름 (예: 유튜브)"
                      value={link.name}
                      onChange={(e) => {
                        const newForm = [...linksForm];
                        newForm[index].name = e.target.value;
                        setLinksForm(newForm);
                      }}
                      className="h-10 sm:flex-[1] border-neutral-300 dark:border-neutral-700 rounded-xl bg-background text-xs md:text-sm"
                    />
                    <Input
                      placeholder="https://"
                      value={link.url}
                      onChange={(e) => {
                        const newForm = [...linksForm];
                        newForm[index].url = e.target.value;
                        setLinksForm(newForm);
                      }}
                      className="h-10 sm:flex-[2] border-neutral-300 dark:border-neutral-700 rounded-xl bg-background text-xs md:text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLinksForm(linksForm.filter(l => l.id !== link.id))}
                      className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLinksForm([...linksForm, { id: Math.random().toString(), name: "", url: "" }])}
                  className="border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl w-full h-10 flex items-center justify-center text-xs md:text-sm font-bold bg-background hover:bg-muted/30"
                >
                  <Plus className="h-4 w-4 mr-1" /> 링크 추가
                </Button>
              </div>
            </div>
          </div>

          {/* 4. Action Footer */}
          <div className="flex justify-between items-center pt-4 mt-4 border-t border-border/50">
            {linksTargetChan?.owner_id ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const expectedConfirm = `${linksTargetChan?.name}/소속사 이적`;
                  const userInput = window.prompt(
                    `이적시 이 채널은 무소속으로 설정되고 해당 채널에 대한 소속사의 권한도 사라집니다.\n\n이적을 진행하려면 아래에 "${expectedConfirm}"을(를) 정확히 입력해주세요.`
                  );
                  if (userInput === expectedConfirm) {
                    handleTransferChannel();
                  } else if (userInput !== null) {
                    toast.error("입력한 텍스트가 일치하지 않습니다.");
                  }
                }}
                disabled={isTransferringChan}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-bold px-3 h-10 rounded-xl flex items-center gap-1.5"
              >
                {isTransferringChan ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                ) : (
                  <Building2 className="w-4 h-4" />
                )}
                소속사 이적
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const expectedConfirm = `${linksTargetChan?.name}/채널 삭제`;
                  const userInput = window.prompt(
                    `정말로 이 채널과 관련된 모든 행사를 완전히 삭제하시겠습니까? 이 작업은 복구할 수 없습니다.\n\n삭제를 진행하려면 아래에 "${expectedConfirm}"을(를) 정확히 입력해주세요.`
                  );
                  if (userInput === expectedConfirm) {
                    handleDeleteChannel();
                  } else if (userInput !== null) {
                    toast.error("입력한 텍스트가 일치하지 않습니다.");
                  }
                }}
                disabled={isDeletingChan}
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold px-3 h-10 rounded-xl flex items-center gap-1.5"
              >
                {isDeletingChan ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                채널 삭제
              </Button>
            )}

            <Button
              onClick={handleSaveLinks}
              disabled={isSavingLinks || isUploadingLinkImg}
              className="h-10 rounded-xl text-xs md:text-sm font-bold bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 px-4 shadow-sm"
            >
              {isSavingLinks ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Company Profile Edit Dialog */}
      <Dialog open={isCompanyEditOpen} onOpenChange={setIsCompanyEditOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-3xl shadow-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              <Building2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" /> 소속사 프로필 수정
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              소속사의 이름과 프로필 이미지를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-5 pt-2">
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative w-14 h-14 md:w-16 md:h-16 flex-shrink-0 rounded-xl bg-muted overflow-hidden border border-border flex items-center justify-center shadow-sm">
                {editCompanyImageUrl ? (
                  <img src={editCompanyImageUrl} alt="Company Preview" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-5 h-5 text-muted-foreground/40" />
                )}
                {isCompanyUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-muted-foreground">회사 프로필 이미지</Label>
                <input type="file" id="comp-modal-img" className="hidden" accept="image/*" onChange={handleCompanyImageUpload} disabled={isCompanyUploading} />
                <Button type="button" variant="outline" className="h-8 text-[11px] rounded-lg font-bold self-start shadow-sm" asChild disabled={isCompanyUploading}>
                  <label htmlFor="comp-modal-img" className="cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3 h-3" /> {editCompanyImageUrl ? "이미지 변경" : "이미지 선택"}
                  </label>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compName" className="font-bold text-xs md:text-sm">회사 이름 <span className="text-destructive">*</span></Label>
              <Input
                id="compName"
                value={editCompanyName}
                onChange={e => setEditCompanyName(e.target.value)}
                placeholder="예: 아웃덕 컴퍼니"
                className="h-11 rounded-xl"
                required
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
                <Info className="w-3 h-3" /> 변경된 이름은 모든 소속 채널에 일괄 적용됩니다.
              </p>
            </div>

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md" disabled={isCompanySaving || isCompanyUploading}>
                {isCompanySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "수정 완료"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
