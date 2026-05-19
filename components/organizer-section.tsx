"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event-card";
import { Plus } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function OrganizerSection({ user }: { user: User | null }) {
  const [channel, setChannel] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
          .select("id, name, image_url")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (channelError || !channelData) {
          setLoading(false);
          return;
        }

        setChannel(channelData);

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
          if (t === "festival") return "동인 행사";
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

  return (
    <section className="mx-4 mb-8 pt-2">
      {/* Header Outside the box */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => router.push(`/channels/${channel.id}`)}>
          <div className="p-[3px] md:p-[4px] rounded-full bg-brand-gradient shadow-md group-hover:scale-105 transition-transform">
            <Avatar className="w-16 h-16 md:w-28 md:h-28 border-2 border-white bg-background shrink-0 overflow-hidden">
              <AvatarImage src={channel.image_url || undefined} className="object-cover" />
              <AvatarFallback className="font-bold text-2xl text-muted-foreground">{channel.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-xl md:text-3xl font-bold group-hover:text-primary transition-colors leading-tight">{channel.name}</h2>
            <span className="text-[10px] md:text-sm text-muted-foreground font-semibold mt-0.5 md:mt-1">주최자 대시보드</span>
          </div>
        </div>
        <Button onClick={() => router.push("/events/new")} className="gap-1.5 font-bold rounded-full h-10 px-4 md:px-5 bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80 shadow-sm border-0">
          <Plus className="w-4 h-4 md:w-5 md:h-5" /> 
          <span className="hidden md:inline">새 </span>행사 등록
        </Button>
      </div>

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
          <div className="flex overflow-x-auto gap-3 md:gap-4 pb-2 md:pb-3 snap-x [&::-webkit-scrollbar]:h-1.5 md:[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-primary/5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
            {events.map((event) => (
              <div key={event.id} className="min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] snap-start shrink-0">
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
              </div>
            ))}
            {/* + Card for adding new events */}
            <div 
              onClick={() => router.push("/events/new")}
              className="min-w-[280px] w-[280px] md:min-w-[320px] md:w-[320px] snap-start shrink-0"
            >
              <div className="border border-dashed border-primary/30 hover:border-primary/60 bg-background/50 hover:bg-background/80 rounded-2xl overflow-hidden transition-all h-full cursor-pointer group shadow-sm flex flex-col">
                <div className="aspect-[16/9] w-full border-b border-dashed border-primary/20 bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-background border border-dashed border-primary/30 group-hover:border-primary/60 flex items-center justify-center transition-all group-hover:scale-105">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-center">
                  <p className="font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors text-center">새 행사 등록</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 text-center">이벤트를 개최하여 팬들과 소통해보세요</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
