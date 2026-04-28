"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Star, Calendar, ShoppingBag } from "lucide-react";
import { EventCard } from "@/components/event-card";

type OfflineEvent = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType: "자유입장" | "예약필수" | "예약우대" | "티켓팅" | undefined;
  channels: { id: number; name: string; image_url: string }[];
};

type ChannelType = "game" | "youtuber" | "vtuber";

type Channel = {
  id: number;
  name: string;
  type: ChannelType | null;
  image_url: string | null;
  team_id: number | null;
  is_team: boolean;
};

const channelTypeLabel: Record<ChannelType, string> = {
  game: "게임",
  youtuber: "유튜버",
  vtuber: "버튜버",
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

export default function ChannelProfilePage() {
  const params = useParams<{ id: string }>();
  const channelId = useMemo(() => Number(params.id), [params.id]);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [teamChannel, setTeamChannel] = useState<Channel | null>(null);
  const [memberChannels, setMemberChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "goods">("events");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isLoadingSubscribe, setIsLoadingSubscribe] = useState(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>([]);
  const [onlineEvents, setOnlineEvents] = useState<OfflineEvent[]>([]);

  useEffect(() => {
    const loadChannel = async () => {
      if (!Number.isFinite(channelId)) {
        setErrorText("유효하지 않은 채널 ID입니다.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorText("");

      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("id, name, type, image_url, team_id, is_team")
        .eq("id", channelId)
        .maybeSingle();

      if (channelError || !channelData) {
        setChannel(null);
        setTeamChannel(null);
        setMemberChannels([]);
        setErrorText("채널 정보를 불러오지 못했습니다.");
        setIsLoading(false);
        return;
      }

      const currentChannel = channelData as Channel;
      setChannel(currentChannel);

      const teamDataPromise = (!currentChannel.is_team && currentChannel.team_id)
        ? supabase
            .from("channels")
            .select("id, name, type, image_url, team_id, is_team")
            .eq("id", currentChannel.team_id)
            .maybeSingle()
            .then(res => res.data)
        : Promise.resolve(null);

      const membersDataPromise = currentChannel.is_team
        ? supabase
            .from("channels")
            .select("id, name, type, image_url, team_id, is_team")
            .eq("team_id", currentChannel.id)
            .eq("is_team", false)
            .order("name", { ascending: true })
            .then(res => res.data)
        : Promise.resolve([]);

      const favoriteCountPromise = supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .then(res => res.count ?? 0);

      const userAndFavPromise = supabase.auth.getSession().then(async ({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        if (!currentUser) return { user: null, isSubscribed: false };
        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("channel_id", channelId)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        return { user: currentUser, isSubscribed: !!favData };
      }).catch((e) => {
        console.error("Auth session fetch error:", e);
        return { user: null, isSubscribed: false };
      });

      const offlineEventsPromise = supabase
        .from("offline_events")
        .select(`
          id, title, start_date, end_date, location, image_url, reservation_type,
          offline_event_channels ( channels ( id, name, type, image_url ) )
        `)
        .order("start_date", { ascending: true })
        .then(res => res.data);

      const [teamData, membersData, favCount, { user: currentUser, isSubscribed }, offlineData] = await Promise.all([
        teamDataPromise,
        membersDataPromise,
        favoriteCountPromise,
        userAndFavPromise,
        offlineEventsPromise,
      ]);

      setTeamChannel(teamData as Channel | null);
      setMemberChannels(membersData as Channel[] | null ?? []);
      setFavoriteCount(favCount);
      setUser(currentUser);
      setIsSubscribed(isSubscribed);

      if (offlineData) {
        const formatted = offlineData
          .filter(event =>
            event.offline_event_channels?.some((ec: any) => ec.channels?.id === channelId)
          )
          .map((event, index) => {
            const allChannels = (event.offline_event_channels || [])
              .map((ec: any) => ec.channels)
              .filter(Boolean) as { id: number; name: string; type: string; image_url: string }[];
            const sorted = [
              ...allChannels.filter(c => c.id === channelId),
              ...allChannels.filter(c => c.id !== channelId),
            ];
            const date = event.end_date
              ? `${event.start_date.replaceAll("-", ".")} - ${event.end_date.replaceAll("-", ".")}`
              : event.start_date?.replaceAll("-", ".") ?? "상시";
            return {
              id: event.id,
              title: event.title,
              date,
              location: event.location,
              category: getChannelTypeText(sorted[0]?.type),
              imageColor: imageColors[index % imageColors.length],
              imageUrl: event.image_url,
              reservationType: event.reservation_type as OfflineEvent["reservationType"],
              channels: sorted.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
            };
          });
        setOfflineEvents(formatted);
      }

      setIsLoading(false);
    };

    loadChannel();
  }, [channelId]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="text-sm text-muted-foreground">채널 정보를 불러오는 중...</div>
      </main>
    );
  }

  if (errorText || !channel) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="text-sm text-destructive">{errorText || "채널을 찾을 수 없습니다."}</div>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 py-3">
        <Header />
      </div>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 border border-border">
                <AvatarImage src={channel.image_url ?? undefined} alt={`${channel.name} 프로필`} className="object-cover" />
                <AvatarFallback className="bg-muted text-2xl font-bold text-foreground">
                  {getInitialText(channel.name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight">{channel.name}</h1>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-transparent">
                    {getChannelTypeText(channel.type)}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-muted-foreground/30 text-muted-foreground/50" /> {favoriteCount}
                  </span>
                </div>

                {!channel.is_team && channel.team_id && teamChannel && (
                  <Link
                    href={`/channels/${teamChannel.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <Avatar className="h-5 w-5 border border-border">
                      <AvatarImage src={teamChannel.image_url ?? undefined} alt={`${teamChannel.name} 팀 이미지`} className="object-cover" />
                      <AvatarFallback className="bg-muted text-[10px]">
                        {getInitialText(teamChannel.name)}
                      </AvatarFallback>
                    </Avatar>
                    소속팀: {teamChannel.name}
                  </Link>
                )}
              </div>
            </div>

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
                  } else {
                    await supabase.from("favorites").insert({ channel_id: channelId, user_id: user.id });
                  }
                } catch {
                  setIsSubscribed(previousSubscribed);
                  setFavoriteCount((prev) => previousSubscribed ? prev + 1 : prev - 1);
                } finally {
                  setIsLoadingSubscribe(false);
                }
              }}
              disabled={isLoadingSubscribe}
              className={`flex items-center justify-center rounded-full h-11 font-semibold transition-all duration-500 hover:scale-105 active:scale-95 shadow-sm disabled:opacity-90 disabled:pointer-events-none ${isSubscribed
                ? "px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40"
                : "px-6 bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                }`}
            >
              <Star className={`h-5 w-5 transition-all duration-300 ${isSubscribed ? "fill-white text-white" : "text-muted-foreground"}`} />
              <span className={`transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${isSubscribed ? "max-w-0 opacity-0 ml-0" : "max-w-[100px] opacity-100 ml-2"
                }`}>
                찜하기
              </span>
            </button>
          </div>

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
          <div className="flex gap-2 p-1 bg-muted/40 rounded-xl mb-6 w-full md:w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold transition-all rounded-lg ${activeTab === "events" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
            >
              오프라인 일정 <span className="ml-1 opacity-60">{offlineEvents.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("goods")}
              className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold transition-all rounded-lg ${activeTab === "goods" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
            >
              온라인 일정 <span className="ml-1 opacity-60">{onlineEvents.length}</span>
            </button>
          </div>

          {activeTab === "events" ? (
            offlineEvents.length === 0 ? (
              <div className="flex flex-col min-h-[300px] items-center justify-center gap-5 py-12 rounded-xl bg-muted/20 border border-dashed border-border/50">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                  <Calendar className="h-10 w-10 text-muted-foreground/60" />
                </div>
                <div className="text-center space-y-1.5">
                  <h3 className="text-lg font-semibold text-foreground">등록된 오프라인 일정이 없어요</h3>
                  <p className="text-sm text-muted-foreground">새로운 일정이 추가되면 이곳에서 확인하실 수 있습니다.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {offlineEvents.map(event => (
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
                  />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col min-h-[300px] items-center justify-center gap-5 py-12 rounded-xl bg-muted/20 border border-dashed border-border/50">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-semibold text-foreground">등록된 온라인 일정이 없어요</h3>
                <p className="text-sm text-muted-foreground">새로운 일정이 추가되면 이곳에서 확인하실 수 있습니다.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}