"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Star, Calendar, ShoppingBag, Settings2, ChevronDown, ChevronUp, Plus, Pencil, Loader2, Search, type LucideIcon } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChannelSettingsCard } from "@/app/settings/page";

type ChannelEvent = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: "자유 입장" | "예약 필수" | "티켓팅" | "휴무" | undefined;
  channels: { id: number; name: string; image_url: string }[];
  startDateValue?: string | null;
  endDateValue?: string | null;
  eventType: "offline" | "online";
};

type ChannelType = "game" | "youtuber" | "vtuber" | "festival";

type Channel = {
  id: number;
  name: string;
  type: ChannelType | null;
  image_url: string | null;
  team_id: number | null;
  is_team: boolean;
  owner_id?: string | null;
  links?: any;
  company?: string | null;
};

const channelTypeLabel: Record<ChannelType, string> = {
  game: "게임",
  youtuber: "유튜버",
  vtuber: "버튜버",
  festival: "축제",
};

function getChannelTypeText(type: string | null) {
  if (!type) return "기타";
  const normalized = type.trim().toLowerCase();
  return channelTypeLabel[normalized as ChannelType] || "기타";
}

function getInitialText(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

const imageColors = [
  "bg-gradient-to-br from-indigo-400 to-indigo-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-green-400 to-green-600",
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-red-400 to-red-600",
];

interface ChannelProfileClientProps {
  channelId: number;
  initialChannel: Channel;
  initialTeamChannel: Channel | null;
  initialMemberChannels: Channel[];
  initialFavoriteCount: number;
  initialOfflineEvents: ChannelEvent[];
  initialOnlineEvents: ChannelEvent[];
}

const syncFavoriteCache = (userId: string, targetChannel: Channel, isAdding: boolean) => {
  try {
    const favsKey = `outduck-favorites-${userId}`;
    const metaKey = `outduck-user-meta-${userId}`;

    // 1. Update outduck-favorites-${userId}
    const cachedFavs = localStorage.getItem(favsKey);
    let favsList = cachedFavs ? JSON.parse(cachedFavs) : [];
    if (Array.isArray(favsList)) {
      if (isAdding) {
        if (!favsList.some(c => c.id === targetChannel.id)) {
          favsList.unshift({
            id: targetChannel.id,
            name: targetChannel.name,
            type: targetChannel.type,
            image_url: targetChannel.image_url,
            team_id: targetChannel.team_id,
            is_team: targetChannel.is_team,
            activeEventCount: 0, // default placeholder
            favoriteCreatedAt: new Date().toISOString()
          });
        }
      } else {
        favsList = favsList.filter(c => c.id !== targetChannel.id);
      }
      localStorage.setItem(favsKey, JSON.stringify(favsList));
    }

    // 2. Update outduck-user-meta-${userId}
    const cachedMeta = localStorage.getItem(metaKey);
    if (cachedMeta) {
      const parsedMeta = JSON.parse(cachedMeta);
      let metaFavs = parsedMeta.favorites || [];
      if (Array.isArray(metaFavs)) {
        if (isAdding) {
          if (!metaFavs.some(f => f.channel_id === targetChannel.id)) {
            metaFavs.unshift({
              channel_id: targetChannel.id,
              created_at: new Date().toISOString(),
              channels: {
                id: targetChannel.id,
                name: targetChannel.name,
                type: targetChannel.type,
                image_url: targetChannel.image_url,
                team_id: targetChannel.team_id,
                is_team: targetChannel.is_team
              }
            });
          }
        } else {
          metaFavs = metaFavs.filter(f => f.channel_id !== targetChannel.id);
        }
        parsedMeta.favorites = metaFavs;
        localStorage.setItem(metaKey, JSON.stringify(parsedMeta));
      }
    }
  } catch (e) {
    console.warn("Failed to sync favorites cache:", e);
  }
};

// 카드 그리드 맨 뒤에 붙는 "행사 제보" 유도 카드
function ReportEventCard() {
  return (
    <Link
      href="/suggest"
      className="group flex flex-col items-center justify-center text-center gap-4 min-h-[240px] h-full p-6 -mx-4 sm:mx-0 border-y sm:border border-dashed border-border/70 rounded-none sm:rounded-2xl bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-colors"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70 group-hover:scale-110 transition-transform">
        <Search className="h-8 w-8" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base md:text-lg font-bold text-foreground">찾는 행사가 없나요?</p>
        <p className="text-sm text-muted-foreground">운영자에게 제보해보세요</p>
      </div>
      <span className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-foreground text-background font-bold text-sm shadow-sm group-hover:bg-foreground/90 transition-colors">
        제보하러 가기
      </span>
    </Link>
  );
}

// 등록된 일정이 없을 때 빈 상태 (+ 제보 유도)
function EmptyEventsState({
  icon: Icon,
  title,
  isOwner,
  channelId,
}: {
  icon: LucideIcon;
  title: string;
  isOwner: boolean;
  channelId: number | string;
}) {
  return (
    <div className="flex flex-col min-h-[300px] items-center justify-center gap-5 py-12 rounded-xl bg-muted/20 border border-dashed border-border/50">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
        <Icon className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <div className="text-center space-y-1.5 flex flex-col items-center">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          만약 행사 정보가 등록이 안돼있다면
          <br />
          운영자에게 제보해주세요
        </p>
        <div className="pt-4 flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-95 duration-200">
          {isOwner && (
            <Link
              href={`/events/new?channelId=${channelId}`}
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            >
              행사 등록하러 가기
            </Link>
          )}
          <Link
            href="/suggest"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-foreground text-background font-bold text-sm shadow-sm hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95"
          >
            제보하러 가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ChannelProfileClient({
  channelId,
  initialChannel,
  initialTeamChannel,
  initialMemberChannels,
  initialFavoriteCount,
  initialOfflineEvents,
  initialOnlineEvents,
}: ChannelProfileClientProps) {
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [teamChannel, setTeamChannel] = useState<Channel | null>(initialTeamChannel);
  const [memberChannels, setMemberChannels] = useState<Channel[]>(initialMemberChannels);
  const [favoriteCount, setFavoriteCount] = useState<number>(initialFavoriteCount);
  const [offlineEvents, setOfflineEvents] = useState<ChannelEvent[]>(initialOfflineEvents);
  const [onlineEvents, setOnlineEvents] = useState<ChannelEvent[]>(initialOnlineEvents);

  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "offline" | "online">("all");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userCompany, setUserCompany] = useState<string | null>(null);
  const [isLoadingSubscribe, setIsLoadingSubscribe] = useState(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [showPastEvents, setShowPastEvents] = useState(false);

  const parsedLinks = useMemo(() => {
    if (!channel || !channel.links) return [];
    let links = channel.links;
    if (typeof links === 'string') {
      try {
        links = JSON.parse(links);
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(links)) {
      return links.filter(l => l.name?.trim() && l.url?.trim());
    } else if (typeof links === 'object') {
      return Object.entries(links).map(([name, url]) => ({ name, url: url as string })).filter(l => l.name.trim() && l.url.trim());
    }
    return [];
  }, [channel]);

  const isPastEvent = (endDateStr: string | null | undefined, startDateStr: string | null | undefined) => {
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
  };

  const activeOfflineEvents = useMemo(() => offlineEvents.filter(e => !isPastEvent(e.endDateValue, e.startDateValue)), [offlineEvents]);
  const pastOfflineEvents = useMemo(() => offlineEvents.filter(e => isPastEvent(e.endDateValue, e.startDateValue)), [offlineEvents]);
  const activeOnlineEvents = useMemo(() => onlineEvents.filter(e => !isPastEvent(e.endDateValue, e.startDateValue)), [onlineEvents]);
  const pastOnlineEvents = useMemo(() => onlineEvents.filter(e => isPastEvent(e.endDateValue, e.startDateValue)), [onlineEvents]);

  const activeAllEvents = useMemo(() => {
    const combined = [...activeOfflineEvents, ...activeOnlineEvents];
    return combined.sort((a, b) => {
      const dateA = a.startDateValue || "";
      const dateB = b.startDateValue || "";
      return dateA.localeCompare(dateB);
    });
  }, [activeOfflineEvents, activeOnlineEvents]);

  const pastAllEvents = useMemo(() => {
    const combined = [...pastOfflineEvents, ...pastOnlineEvents];
    return combined.sort((a, b) => {
      const dateA = a.startDateValue || "";
      const dateB = b.startDateValue || "";
      return dateB.localeCompare(dateA);
    });
  }, [pastOfflineEvents, pastOnlineEvents]);

  useEffect(() => {
    if (isLoading) return;
    
    const activeOfflineCount = activeOfflineEvents.length;
    const activeOnlineCount = activeOnlineEvents.length;
    const activeAllCount = activeAllEvents.length;

    if (activeTab === "all") {
      setShowPastEvents(activeAllCount === 0);
    } else if (activeTab === "offline") {
      setShowPastEvents(activeOfflineCount === 0);
    } else {
      setShowPastEvents(activeOnlineCount === 0);
    }
  }, [activeTab, activeOfflineEvents, activeOnlineEvents, activeAllEvents, isLoading]);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        if (!currentUser) {
          setUser(null);
          setIsSubscribed(false);
          setUserCompany(null);
          return;
        }
        setUser(currentUser);

        const favPromise = supabase
          .from("favorites")
          .select("id")
          .eq("channel_id", channelId)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const companyPromise = supabase
          .from("companies")
          .select("name")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const [favRes, companyRes] = await Promise.all([favPromise, companyPromise]);
        setIsSubscribed(!!favRes.data);
        setUserCompany(companyRes.data?.name || null);
      } catch (err) {
        console.error("Auth and company check failed:", err);
      }
    };

    checkUserStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (!currentUser) {
        setIsSubscribed(false);
        setUserCompany(null);
      } else {
        supabase
          .from("favorites")
          .select("id")
          .eq("channel_id", channelId)
          .eq("user_id", currentUser.id)
          .maybeSingle()
          .then(res => setIsSubscribed(!!res.data));
          
        supabase
          .from("companies")
          .select("name")
          .eq("user_id", currentUser.id)
          .maybeSingle()
          .then(res => setUserCompany(res.data?.name || null));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [channelId]);

  // Lazy load teams only when settings modal is opened
  useEffect(() => {
    if (isSettingsOpen && teams.length === 0) {
      const loadTeams = async () => {
        const { data } = await supabase
          .from("channels")
          .select("id, name")
          .eq("is_team", true)
          .order("name");
        if (data) setTeams(data);
      };
      loadTeams();
    }
  }, [isSettingsOpen, teams.length]);

  const isOwner = user && (
    channel?.owner_id === user.id ||
    (!channel?.owner_id && channel?.company && userCompany && channel.company === userCompany)
  );

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {errorText && (
          <div className="text-sm text-destructive mb-4">{errorText}</div>
        )}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
          <div className="flex flex-row items-center justify-between gap-3 md:gap-5">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <Avatar className="h-14 w-14 md:h-24 md:w-24 border border-border shrink-0">
                <AvatarImage src={channel.image_url ?? undefined} alt={`${channel.name} 프로필`} className="object-cover" />
                <AvatarFallback className="bg-muted text-lg md:text-2xl font-bold text-foreground">
                  {getInitialText(channel.name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1.5 md:space-y-2 min-w-0">
                <h1 className="text-xl md:text-3xl font-extrabold tracking-tight truncate">{channel.name}</h1>
                <div className="flex items-center gap-2 md:gap-3">
                  <Badge variant="secondary" className="px-2 py-0.5 text-[10px] md:text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-transparent">
                    {getChannelTypeText(channel.type)}
                  </Badge>
                  <span className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3 md:h-3.5 md:w-3.5 fill-muted-foreground/30 text-muted-foreground/50" /> {favoriteCount}
                  </span>
                </div>

                {!channel.is_team && channel.team_id && teamChannel && (
                  <Link
                    href={`/channels/${teamChannel.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 md:px-3 md:py-1.5 text-[9px] md:text-xs text-muted-foreground hover:bg-muted truncate max-w-[130px] sm:max-w-none"
                  >
                    <Avatar className="h-3.5 w-3.5 md:h-5 md:w-5 border border-border shrink-0">
                      <AvatarImage src={teamChannel.image_url ?? undefined} alt={`${teamChannel.name} 팀 이미지`} className="object-cover" />
                      <AvatarFallback className="bg-muted text-[6px] md:text-[10px]">
                        {getInitialText(teamChannel.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">소속팀: {teamChannel.name}</span>
                  </Link>
                )}
              </div>
            </div>

            {isOwner ? (
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 md:gap-2 shrink-0">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center gap-1 justify-center rounded-full h-9 md:h-11 px-3 md:px-5 font-bold text-xs md:text-sm bg-white text-black border border-black/20 transition-all hover:scale-105 active:scale-95 shadow-sm dark:bg-white dark:text-black dark:border-black/20"
                >
                  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  수정
                </button>
                <Link
                  href={`/events/new?channelId=${channelId}`}
                  className="inline-flex items-center gap-1 justify-center rounded-full h-9 md:h-11 px-3 md:px-5 font-bold text-xs md:text-sm bg-primary/5 text-primary hover:bg-primary/10 border border-primary/60 transition-all hover:scale-105 active:scale-95 shadow-sm"
                >
                  <Plus className="h-3 w-3 md:h-4 md:w-4" />
                  등록
                </Link>
              </div>
            ) : (
              <button
                onClick={async () => {
                  if (!user) { alert("로그인이 필요해요!"); return; }
                  if (isLoadingSubscribe) return;
                  setIsLoadingSubscribe(true);
                  const previousSubscribed = isSubscribed;
                  setIsSubscribed(!previousSubscribed);
                  setFavoriteCount((prev) => previousSubscribed ? prev - 1 : prev + 1);
                  try {
                    if (previousSubscribed) {
                      await supabase.from("favorites").delete().eq("channel_id", channelId).eq("user_id", user.id);
                      syncFavoriteCache(user.id, channel, false);
                    } else {
                      await supabase.from("favorites").insert({ channel_id: channelId, user_id: user.id });
                      syncFavoriteCache(user.id, channel, true);
                    }
                  } catch {
                    setIsSubscribed(previousSubscribed);
                    setFavoriteCount((prev) => previousSubscribed ? prev + 1 : prev - 1);
                  } finally {
                    setIsLoadingSubscribe(false);
                  }
                }}
                disabled={isLoadingSubscribe}
                className={`flex items-center justify-center rounded-full h-9 md:h-11 font-semibold transition-all duration-500 hover:scale-105 active:scale-95 shadow-sm disabled:opacity-90 disabled:pointer-events-none shrink-0 ${isSubscribed
                  ? "w-fit px-2.5 md:px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40"
                  : "w-fit px-3.5 md:px-6 bg-muted text-muted-foreground border border-border hover:bg-muted/80 text-xs md:text-sm"
                  }`}
              >
                <Star className={`h-4 w-4 md:h-5 md:w-5 transition-all duration-300 ${isSubscribed ? "fill-white text-white" : "text-muted-foreground"}`} />
                <span className={`transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${isSubscribed ? "max-w-0 opacity-0 ml-0" : "max-w-[100px] opacity-100 ml-1.5"
                  }`}>
                  팔로우
                </span>
              </button>
            )}
          </div>

          {parsedLinks.length > 0 && (
            <div className="mt-5 border-t border-border pt-5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
              {parsedLinks.map((link: any, idx: number) => (
                <div key={idx} className="flex items-start sm:items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground select-none">•</span>
                  <span className="font-semibold text-foreground">{link.name} :</span>
                  <a
                    href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {link.url}
                  </a>
                </div>
              ))}
            </div>
          )}

          {channel.is_team && memberChannels.length > 0 && (
            <div className="mt-5 border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setIsMemberListOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted"
              >
                <div className="flex items-center">
                  {memberChannels.slice(0, 4).map((member, index) => (
                    <Avatar
                      key={member.id}
                      className="relative h-8 w-8 border border-background"
                      style={{ marginLeft: index === 0 ? 0 : -10 }}
                    >
                      <AvatarImage src={member.image_url ?? undefined} alt={`${member.name} 프로필`} className="object-cover" />
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {getInitialText(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-sm font-medium">
                  {isMemberListOpen ? "멤버 목록 접기" : "멤버 목록 보기"}
                </span>
              </button>

              {isMemberListOpen && (
                <ul className="mt-3 space-y-2">
                  {memberChannels.map((member) => (
                    <li key={member.id}>
                      <Link
                        href={`/channels/${member.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted"
                      >
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={member.image_url ?? undefined} alt={`${member.name} 프로필`} className="object-cover" />
                          <AvatarFallback className="bg-muted text-xs font-semibold">
                            {getInitialText(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{getChannelTypeText(member.type)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex gap-1.5 p-1 bg-muted/40 rounded-xl mb-6 w-full md:w-fit overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 md:flex-none px-2 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-bold transition-all rounded-lg whitespace-nowrap ${
                activeTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              전체 <span className="ml-1 opacity-60 text-[10px] md:text-xs">{activeAllEvents.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("offline")}
              className={`flex-1 md:flex-none px-2 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-bold transition-all rounded-lg whitespace-nowrap ${
                activeTab === "offline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              오프라인<span className="hidden min-[370px]:inline"> 일정</span> <span className="ml-1 opacity-60 text-[10px] md:text-xs">{activeOfflineEvents.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("online")}
              className={`flex-1 md:flex-none px-2 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-bold transition-all rounded-lg whitespace-nowrap ${
                activeTab === "online" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              온라인<span className="hidden min-[370px]:inline"> 일정</span> <span className="ml-1 opacity-60 text-[10px] md:text-xs">{activeOnlineEvents.length}</span>
            </button>
          </div>

          {activeTab === "all" ? (
            <>
              {activeAllEvents.length === 0 ? (
                <EmptyEventsState icon={Calendar} title="등록된 일정이 없어요" isOwner={isOwner} channelId={channelId} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {activeAllEvents.map((event, index) => (
                    <EventCard
                      key={`${event.eventType}-${event.id}`}
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
                      eventType={event.eventType}
                      isRightCard={index % 2 === 1}
                      showEventTypeBadge={true}
                    />
                  ))}
                  <ReportEventCard />
                </div>
              )}

              {pastAllEvents.length > 0 && (
                <div className="mt-8 border-t border-border pt-6">
                  <button
                    onClick={() => setShowPastEvents(!showPastEvents)}
                    className="w-full py-3.5 px-5 bg-card hover:bg-slate-50 dark:hover:bg-muted/10 border border-border rounded-xl flex items-center justify-between transition-all group font-bold text-sm text-foreground shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span>지나간 행사</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        {pastAllEvents.length}
                      </span>
                    </span>
                    {showPastEvents ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </button>

                  {showPastEvents && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 animate-in fade-in slide-in-from-top-3 duration-250">
                      {pastAllEvents.map((event, index) => (
                        <div key={`${event.eventType}-${event.id}`} className="opacity-70 saturate-50 hover:opacity-100 hover:saturate-100 transition-all duration-300">
                          <EventCard
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
                            eventType={event.eventType}
                            isRightCard={index % 2 === 1}
                            showEventTypeBadge={true}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : activeTab === "offline" ? (
            <>
              {activeOfflineEvents.length === 0 ? (
                <EmptyEventsState icon={Calendar} title="등록된 오프라인 일정이 없어요" isOwner={isOwner} channelId={channelId} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {activeOfflineEvents.map((event, index) => (
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
                      eventType="offline"
                      isRightCard={index % 2 === 1}
                    />
                  ))}
                  <ReportEventCard />
                </div>
              )}

              {pastOfflineEvents.length > 0 && (
                <div className="mt-8 border-t border-border pt-6">
                  <button
                    onClick={() => setShowPastEvents(!showPastEvents)}
                    className="w-full py-3.5 px-5 bg-card hover:bg-slate-50 dark:hover:bg-muted/10 border border-border rounded-xl flex items-center justify-between transition-all group font-bold text-sm text-foreground shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span>지나간 행사</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        {pastOfflineEvents.length}
                      </span>
                    </span>
                    {showPastEvents ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </button>

                  {showPastEvents && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 animate-in fade-in slide-in-from-top-3 duration-250">
                      {pastOfflineEvents.map((event, index) => (
                        <div key={event.id} className="opacity-70 saturate-50 hover:opacity-100 hover:saturate-100 transition-all duration-300">
                          <EventCard
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
                            eventType="offline"
                            isRightCard={index % 2 === 1}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {activeOnlineEvents.length === 0 ? (
                <EmptyEventsState icon={ShoppingBag} title="등록된 온라인 일정이 없어요" isOwner={isOwner} channelId={channelId} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {activeOnlineEvents.map((event, index) => (
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
                      eventType="online"
                      isRightCard={index % 2 === 1}
                    />
                  ))}
                  <ReportEventCard />
                </div>
              )}

              {pastOnlineEvents.length > 0 && (
                <div className="mt-8 border-t border-border pt-6">
                  <button
                    onClick={() => setShowPastEvents(!showPastEvents)}
                    className="w-full py-3.5 px-5 bg-card hover:bg-slate-50 dark:hover:bg-muted/10 border border-border rounded-xl flex items-center justify-between transition-all group font-bold text-sm text-foreground shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span>지나간 행사</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        {pastOnlineEvents.length}
                      </span>
                    </span>
                    {showPastEvents ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </button>

                  {showPastEvents && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 animate-in fade-in slide-in-from-top-3 duration-250">
                      {pastOnlineEvents.map((event, index) => (
                        <div key={event.id} className="opacity-70 saturate-50 hover:opacity-100 hover:saturate-100 transition-all duration-300">
                          <EventCard
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
                            eventType="online"
                            isRightCard={index % 2 === 1}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none">
          <DialogTitle className="sr-only">채널 수정 팝업</DialogTitle>
          <div className="bg-card rounded-2xl overflow-hidden shadow-xl border border-border">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-tight mb-1 flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> 채널 수정
                </h2>
                <p className="text-sm text-muted-foreground">
                  오너 권한을 가진 채널의 프로필 및 정보를 관리합니다.
                </p>
              </div>
              <ChannelSettingsCard 
                channel={channel} 
                teams={teams}
                onUpdated={() => window.location.reload()} 
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
