"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventCard } from "@/components/event-card";
import { Plus, Settings2, Pencil, Megaphone, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChannelSettingsCard } from "@/app/settings/page";

const channelTypeLabel: Record<string, string> = {
  game: "게임",
  youtuber: "유튜버",
  festival: "축제",
};

function getChannelTypeText(type: string | null) {
  if (!type) return "기타";
  const normalized = type.trim().toLowerCase();
  return channelTypeLabel[normalized] || "기타";
}

function getInitialText(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function OrganizerSection({ user }: { user: User | null }) {
  const [channel, setChannel] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "offline" | "online">("all");
  const router = useRouter();

  const handleDeleteEvent = async (eventId: number, baseEventId: number) => {
    const userInput = prompt("이 행사를 삭제하려면 '행사/삭제한다'를 입력해 주세요.");
    if (userInput !== "행사/삭제한다") {
      if (userInput !== null) {
        toast.error("입력하신 문구가 일치하지 않아 삭제가 취소되었습니다.");
      }
      return;
    }

    try {
      // 1. Manually delete specific child records satisfying manual referential cleanup
      await supabase.from("offline_event_locations").delete().eq("offline_event_id", eventId);
      await supabase.from("event_channels").delete().eq("event_id", baseEventId);
      await supabase.from("event_bookmarks").delete().eq("event_id", baseEventId);
      await supabase.from("event_images").delete().eq("event_id", baseEventId);
      
      // 2. Delete offline specific row
      const { error: delOffErr } = await supabase.from("offline_events").delete().eq("id", eventId);
      if (delOffErr) throw delOffErr;

      // 3. Finally delete underlying universal event record
      const { error: delBaseErr } = await supabase.from("events").delete().eq("id", baseEventId);
      if (delBaseErr) throw delBaseErr;
      
      toast.success("행사가 성공적으로 삭제되었습니다.");
      
      // Refresh state without reload
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err: any) {
      console.error(err);
      toast.error("행사 삭제 중 오류가 발생했습니다.");
    }
  };

  const imageColors = [
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
    "bg-gradient-to-br from-green-400 to-green-600",
    "bg-gradient-to-br from-orange-400 to-orange-600",
    "bg-gradient-to-br from-purple-400 to-purple-600",
    "bg-gradient-to-br from-red-400 to-red-600",
  ];

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchOrganizerData = async () => {
      try {
        const { data: channelData, error: channelError } = await supabase
          .from("channels")
          .select("*")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (channelError || !channelData) {
          setLoading(false);
          return;
        }

        setChannel(channelData);

        const { data: teamsData } = await supabase
          .from("channels")
          .select("id, name")
          .eq("is_team", true)
          .order("name");
        setTeams(teamsData || []);

        const { data: mappingData, error: mappingError } = await supabase
          .from("event_channels")
          .select("event_id")
          .eq("channel_id", channelData.id);

        if (mappingError || !mappingData || mappingData.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const eventIds = mappingData.map((m: any) => m.event_id);

        const [offlineRes, onlineRes] = await Promise.all([
          supabase
            .from("offline_events")
            .select(`
              id,
              event_id,
              title,
              start_date,
              end_date,
              image_url,
              reservation_type,
              created_at,
              offline_event_locations(location),
              events(event_channels(channels(id, name, type, image_url)))
            `)
            .in("event_id", eventIds),
          supabase
            .from("online_events")
            .select(`
              id,
              event_id,
              title,
              start_at,
              end_at,
              image_url,
              created_at,
              events(event_channels(channels(id, name, type, image_url)))
            `)
            .in("event_id", eventIds)
        ]);

        const formatEventDate = (start: string | null, end: string | null) => {
          return end
            ? `${start?.replaceAll("-", ".").split("T")[0] ?? ""} - ${end.replaceAll("-", ".").split("T")[0]}`
            : start?.replaceAll("-", ".").split("T")[0] ?? "상시";
        };

        const getCategory = (type?: string) => {
          if (!type) return "기타";
          const t = type.trim().toLowerCase();
          if (t === "game") return "게임";
          if (t === "youtuber") return "유튜버";
          if (t === "festival") return "축제";
          return "기타";
        };

        const formattedEvents: any[] = [];

        if (offlineRes.data) {
          offlineRes.data.forEach((e: any) => {
            const evChannels = e.events?.event_channels
              ?.map((c: any) => c.channels)
              .filter(Boolean) || [];

            formattedEvents.push({
              id: e.id,
              baseEventId: e.event_id,
              eventType: "offline",
              title: e.title,
              date: formatEventDate(e.start_date, e.end_date),
              location: e.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
              category: getCategory(evChannels[0]?.type),
              imageUrl: e.image_url,
              reservationType: e.reservation_type,
              created_at: e.created_at,
              raw_start_date: e.start_date,
              raw_end_date: e.end_date,
              channels: evChannels.map((c: any) => ({
                id: c.id,
                name: c.name,
                image_url: c.image_url || "",
              })),
            });
          });
        }

        if (onlineRes.data) {
          onlineRes.data.forEach((e: any) => {
            const evChannels = e.events?.event_channels
              ?.map((c: any) => c.channels)
              .filter(Boolean) || [];

            formattedEvents.push({
              id: e.id,
              baseEventId: e.event_id,
              eventType: "online",
              title: e.title,
              date: formatEventDate(e.start_at, e.end_at),
              location: "온라인",
              category: getCategory(evChannels[0]?.type),
              imageUrl: e.image_url,
              reservationType: undefined,
              created_at: e.created_at,
              raw_start_at: e.start_at,
              raw_end_at: e.end_at,
              channels: evChannels.map((c: any) => ({
                id: c.id,
                name: c.name,
                image_url: c.image_url || "",
              })),
            });
          });
        }

        const sortedEvents = formattedEvents.sort((a, b) => {
          const parseEventDates = (event: any) => {
            let start: Date | null = null;
            let end: Date | null = null;
            let isAlwaysOn = false;

            if (event.eventType === "offline") {
              start = event.raw_start_date ? new Date(event.raw_start_date) : null;
              end = event.raw_end_date ? new Date(event.raw_end_date) : null;
            } else {
              start = event.raw_start_at ? new Date(event.raw_start_at) : null;
              end = event.raw_end_at ? new Date(event.raw_end_at) : null;
            }

            if (!start) {
              isAlwaysOn = true;
            }

            const now = new Date();
            let isOngoing = false;
            if (!isAlwaysOn && start) {
              if (start <= now) {
                if (!end || end >= now) {
                  isOngoing = true;
                }
              }
            }

            return { start, end, isAlwaysOn, isOngoing };
          };

          const infoA = parseEventDates(a);
          const infoB = parseEventDates(b);

          const getRank = (info: any) => {
            if (info.isOngoing) return 1;
            if (!info.isAlwaysOn && info.start && info.start > new Date()) return 2;
            if (!info.isAlwaysOn && info.end && info.end < new Date()) return 3;
            return 4; // Always-on
          };

          const rankA = getRank(infoA);
          const rankB = getRank(infoB);

          if (rankA !== rankB) {
            return rankA - rankB;
          }

          // Same rank sorting
          if (rankA === 1) {
            // Ongoing: earlier ending first
            if (infoA.end && infoB.end) {
              return infoA.end.getTime() - infoB.end.getTime();
            }
            if (infoA.end) return -1;
            if (infoB.end) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }

          if (rankA === 2) {
            // Upcoming: closer start time first (earlier start first)
            if (infoA.start && infoB.start) {
              return infoA.start.getTime() - infoB.start.getTime();
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }

          if (rankA === 3) {
            // Past: most recently ended first
            if (infoA.end && infoB.end) {
              return infoB.end.getTime() - infoA.end.getTime();
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }

          // Always-on: descending created_at
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const finalEvents = sortedEvents.map((e, index) => ({
          ...e,
          imageColor: imageColors[index % imageColors.length]
        }));

        setEvents(finalEvents);
      } catch (err) {
        console.error("Failed to fetch organizer data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizerData();
  }, [user]);

  if (loading) return null;
  if (!channel) return null;

  const filteredEvents = events.filter(e => {
    if (activeTab === "all") return true;
    return e.eventType === activeTab;
  });

  const offlineCount = events.filter(e => e.eventType === "offline").length;
  const onlineCount = events.filter(e => e.eventType === "online").length;

  const parsedLinks = (() => {
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
      return links.filter((l: any) => l.name?.trim() && l.url?.trim());
    } else if (typeof links === 'object') {
      return Object.entries(links).map(([name, url]) => ({ name, url: url as string })).filter((l: any) => l.name.trim() && l.url.trim());
    }
    return [];
  })();

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => router.push(`/channels/${channel.id}`)}>
            <Avatar className="h-20 w-20 md:h-24 md:w-24 border border-border group-hover:scale-105 transition-transform">
              <AvatarImage src={channel.image_url ?? undefined} alt={`${channel.name} 프로필`} className="object-cover" />
              <AvatarFallback className="bg-muted text-2xl font-bold text-foreground">
                {getInitialText(channel.name)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight group-hover:text-primary transition-colors leading-tight truncate">{channel.name}</h1>
              <div className="flex items-center gap-3">
                {channel.type && getChannelTypeText(channel.type) !== "기타" && (
                  <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-transparent">
                    {getChannelTypeText(channel.type)}
                  </Badge>
                )}
                <span className="text-[11px] md:text-sm text-muted-foreground font-semibold shrink-0">주최자 대시보드</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
            <Button
              onClick={(e) => { e.stopPropagation(); router.push("/ad-apply"); }}
              className="flex-1 md:flex-none inline-flex items-center gap-1.5 justify-center rounded-full h-11 px-5 font-bold text-sm bg-white text-black border border-black/20 transition-all hover:scale-105 active:scale-95 shadow-sm dark:bg-white dark:text-black dark:border-black/20"
            >
              광고 신청
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }}
              className="flex-1 md:flex-none inline-flex items-center gap-1.5 justify-center rounded-full h-11 px-5 font-bold text-sm bg-white text-black border border-black/20 transition-all hover:scale-105 active:scale-95 shadow-sm dark:bg-white dark:text-black dark:border-black/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              채널 수정
            </Button>
            <Button
              onClick={(e) => { e.stopPropagation(); router.push("/events/new"); }}
              className="flex-1 md:flex-none inline-flex items-center gap-1.5 justify-center rounded-full h-11 px-5 font-bold text-sm bg-primary/5 text-primary hover:bg-primary/10 border border-primary/60 transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              행사 등록
            </Button>
          </div>
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
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.url}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 mt-6">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 px-1">
          <div className="w-[5px] h-[18px] bg-blue-600 dark:bg-blue-400 rounded-full shrink-0" />
          <span>간편 관리창</span>
        </h2>
        <div className="bg-gradient-to-br from-[#eefcf9] via-background to-[#fdf2ff] dark:from-primary/5 dark:via-background dark:to-primary/10 rounded-2xl p-3 md:p-4 border border-primary/10 shadow-sm relative overflow-hidden">
          {events.length === 0 ? (
            <div className="py-10 text-center bg-background/60 rounded-xl border border-border/50">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm md:text-base text-foreground">아직 등록된 행사가 없어요</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">새로운 행사를 등록하고 팬들과 만나보세요!</p>
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-4 md:gap-5 pb-2 md:pb-3 snap-x items-center [&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-primary/5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
              <button 
                onClick={() => router.push("/events/new")}
                className="flex flex-col items-center justify-center gap-2.5 group min-w-[110px] ml-4 mr-2 pr-2 shrink-0 snap-start mt-4"
              >
                <div className="w-16 h-16 rounded-full border-[2.5px] border-dashed border-neutral-400 dark:border-neutral-500 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all shadow-sm">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors whitespace-nowrap">새 행사 등록</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">New</p>
                </div>
              </button>
              {events.map((event) => (
                <div key={event.id} className="min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] snap-start shrink-0 flex flex-col gap-2.5">
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
                    baseEventId={event.baseEventId}
                    showEventTypeBadge={true}
                  />
                  <div className="flex items-center gap-1.5 px-0.5 select-none shrink-0 w-full">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/events/${event.id}/edit`);
                      }}
                      variant="outline"
                      className="flex-1 h-9 rounded-xl text-xs font-bold border-border bg-background hover:bg-muted text-foreground transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Pencil className="h-3 w-3 text-slate-500 shrink-0" />
                      <span>수정</span>
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/events/${event.id}?tab=notices`);
                      }}
                      variant="outline"
                      className="flex-1 h-9 rounded-xl text-xs font-bold border-border bg-background hover:bg-muted text-foreground transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Megaphone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>공지</span>
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id, event.baseEventId);
                      }}
                      variant="outline"
                      className="flex-1 h-9 rounded-xl text-xs font-bold border-red-200/60 bg-red-50/10 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:border-red-950/40 dark:bg-red-950/10 dark:hover:bg-red-950/30 text-rose-500 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span>삭제</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex gap-2 p-1 bg-muted/40 rounded-xl mb-6 w-full md:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold transition-all rounded-lg ${activeTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
          >
            전체 <span className="ml-1 opacity-60">{events.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("offline")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold transition-all rounded-lg ${activeTab === "offline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
          >
            오프라인 일정 <span className="ml-1 opacity-60">{offlineCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("online")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold transition-all rounded-lg ${activeTab === "online" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
          >
            온라인 일정 <span className="ml-1 opacity-60">{onlineCount}</span>
          </button>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="flex flex-col min-h-[300px] items-center justify-center gap-5 py-12 rounded-xl bg-muted/20 border border-dashed border-border/50">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm md:text-base text-foreground">아직 등록된 행사가 없어요</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">새로운 행사를 등록하고 팬들과 만나보세요!</p>
            <div className="pt-4">
              <Link
                href="/events/new"
                className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
              >
                새 행사 등록하러 가기
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {filteredEvents.map((event, index) => (
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
                eventType={event.eventType}
                baseEventId={event.baseEventId}
                isRightCard={index % 2 === 1}
                showEventTypeBadge={true}
              />
            ))}
          </div>
        )}
      </section>

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
    </div>
  );
}
