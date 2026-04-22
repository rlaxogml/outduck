"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState} from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Star } from "lucide-react";

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

function getChannelTypeText(type: ChannelType | null) {
  if (!type || !(type in channelTypeLabel)) {
    return "기타";
  }

  return channelTypeLabel[type];
}

function getInitialText(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

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

      if (!currentChannel.is_team && currentChannel.team_id) {
        const { data: teamData } = await supabase
          .from("channels")
          .select("id, name, type, image_url, team_id, is_team")
          .eq("id", currentChannel.team_id)
          .maybeSingle();

        setTeamChannel((teamData as Channel | null) ?? null);
      } else {
        setTeamChannel(null);
      }

      if (currentChannel.is_team) {
        const { data: membersData } = await supabase
          .from("channels")
          .select("id, name, type, image_url, team_id, is_team")
          .eq("team_id", currentChannel.id)
          .eq("is_team", false)
          .order("name", { ascending: true });

        setMemberChannels((membersData as Channel[] | null) ?? []);
      } else {
        setMemberChannels([]);
      }
      // 찜 수 가져오기
      const { count } = await supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId);
      setFavoriteCount(count ?? 0);

      // 현재 유저 가져오기
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      // 찜 여부 확인
      if (currentUser) {
        const { data: favData } = await supabase
          .from("favorites")
          .select("id")
          .eq("channel_id", channelId)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        setIsSubscribed(!!favData);
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
      <div className="mx-auto w-full max-w-5xl lg:px-8 px-4">
        <Header />
      </div>
      <main className="mx-auto w-full max-w-5xl lg:px-8 px-4 py-8">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {channel.image_url ? (
                <img
                  src={channel.image_url}
                  alt={`${channel.name} 프로필`}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    const fallback = event.currentTarget.nextElementSibling as HTMLSpanElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <span
                className="text-2xl font-bold text-foreground"
                style={{ display: channel.image_url ? "none" : "flex" }}
              >
                {getInitialText(channel.name)}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{channel.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{getChannelTypeText(channel.type)}</Badge>
                <span className="text-sm text-muted-foreground">관심 {favoriteCount}</span>
              </div>

              {!channel.is_team && channel.team_id && teamChannel && (
                <Link
                  href={`/channels/${teamChannel.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-border">
                    {teamChannel.image_url ? (
                      <img
                        src={teamChannel.image_url}
                        alt={`${teamChannel.name} 팀 이미지`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{getInitialText(teamChannel.name)}</span>
                    )}
                  </span>
                  소속팀: {teamChannel.name}
                </Link>
              )}
            </div>
          </div>

          <button
            onClick={async () => {
              if (!user) {
                alert("로그인이 필요해요!");
                return;
              }
              setIsLoadingSubscribe(true);
              if (isSubscribed) {
                await supabase
                  .from("favorites")
                  .delete()
                  .eq("channel_id", channelId)
                  .eq("user_id", user.id);
                setIsSubscribed(false);
                setFavoriteCount((prev) => prev - 1);
              } else {
                await supabase
                  .from("favorites")
                  .insert({ channel_id: channelId, user_id: user.id });
                setIsSubscribed(true);
                setFavoriteCount((prev) => prev + 1);
              }
              setIsLoadingSubscribe(false);
            }}
            disabled={isLoadingSubscribe}
            className={`flex items-center gap-2 rounded-full px-4 py-2 border transition-colors ${
              isSubscribed
                ? "bg-yellow-400 border-yellow-400 text-white"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Star className={`h-4 w-4 ${isSubscribed ? "fill-white" : ""}`} />
            {isSubscribed ? "찜됨" : "찜하기"}
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
                  <span
                    key={member.id}
                    className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-background bg-muted text-xs font-semibold"
                    style={{ marginLeft: index === 0 ? 0 : -10 }}
                  >
                    {member.image_url ? (
                      <img
                        src={member.image_url}
                        alt={`${member.name} 프로필`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitialText(member.name)
                    )}
                  </span>
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
                      <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold">
                        {member.image_url ? (
                          <img
                            src={member.image_url}
                            alt={`${member.name} 프로필`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getInitialText(member.name)
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{member.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {getChannelTypeText(member.type)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "events"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          예정 행사 <span className="ml-1 text-xs">0</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("goods")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "goods"
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          굿즈 판매 <span className="ml-1 text-xs">0</span>
        </button>
      </div>

        <div className="flex min-h-64 items-center justify-center">
          <p className="text-lg font-semibold text-muted-foreground">
            {activeTab === "events" ? "아직 등록된 행사가 없어요." : "아직 등록된 굿즈 구매 일정이 없어요."}
          </p>
        </div>
      </section>
    </main>
    </>
  );
}
