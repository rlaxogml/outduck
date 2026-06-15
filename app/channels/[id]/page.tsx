import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ChannelProfileClient } from "@/components/channels/channel-profile-client";

export const revalidate = 0; // Dynamic server rendering

export default async function ChannelProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const channelId = Number(resolvedParams.id);
  if (!Number.isFinite(channelId)) {
    notFound();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Fetch main channel details
  const { data: channelData, error: channelError } = await supabase
    .from("channels")
    .select("id, name, type, image_url, team_id, is_team, owner_id, links, company")
    .eq("id", channelId)
    .maybeSingle();

  if (channelError || !channelData) {
    notFound();
  }

  const currentChannel = channelData;

  // 2. Fetch team data, members list, and favorites count in parallel
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
      .then(res => res.data || [])
    : Promise.resolve([]);

  const favoriteCountPromise = supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", channelId)
    .then(res => res.count ?? 0);

  const [teamData, membersData, favCount] = await Promise.all([
    teamDataPromise,
    membersDataPromise,
    favoriteCountPromise,
  ]);

  // 3. Build relatedChannelIds
  const relatedChannelIds = [
    channelId,
    ...(teamData ? [(teamData as any).id] : []),
    ...((membersData as any[])?.map(m => m.id) || [])
  ];

  // 4. Fetch related events in parallel
  const offlineEventsPromise = supabase
    .from("offline_events")
    .select(`
      id, title, start_date, end_date, image_url, reservation_type,
      events!inner ( 
        event_channels!inner ( 
          channels!inner ( 
            id, name, type, image_url 
          ) 
        ) 
      ),
      offline_event_locations ( location )
    `)
    .in("events.event_channels.channels.id", relatedChannelIds)
    .order("start_date", { ascending: true })
    .then(res => res.data || []);

  const onlineEventsPromise = supabase
    .from("online_events")
    .select(`
      id, title, start_at, end_at, image_url,
      events!inner ( 
        event_channels!inner ( 
          channels!inner ( 
            id, name, type, image_url 
          ) 
        ) 
      )
    `)
    .in("events.event_channels.channels.id", relatedChannelIds)
    .order("start_at", { ascending: true })
    .then(res => res.data || []);

  const [offlineData, onlineData] = await Promise.all([
    offlineEventsPromise,
    onlineEventsPromise,
  ]);

  // 5. Format events
  const imageColors = [
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
    "bg-gradient-to-br from-green-400 to-green-600",
    "bg-gradient-to-br from-orange-400 to-orange-600",
    "bg-gradient-to-br from-purple-400 to-purple-600",
    "bg-gradient-to-br from-red-400 to-red-600",
  ];

  const channelTypeLabel: Record<string, string> = {
    game: "게임",
    youtuber: "유튜버",
    vtuber: "버튜버",
    festival: "축제",
  };

  function getChannelTypeText(type: string | null) {
    if (!type) return "기타";
    const normalized = type.trim().toLowerCase();
    return channelTypeLabel[normalized] || "기타";
  }

  const formattedOffline = offlineData.map((event, index) => {
    const allChannels = ((event.events as any)?.event_channels || [])
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
      location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
      category: getChannelTypeText(sorted[0]?.type),
      imageColor: imageColors[index % imageColors.length],
      imageUrl: event.image_url,
      reservationType: event.reservation_type as any,
      channels: sorted.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
      startDateValue: event.start_date,
      endDateValue: event.end_date,
      eventType: "offline" as const,
    };
  });

  const formattedOnline = onlineData.map((event, index) => {
    const allChannels = ((event.events as any)?.event_channels || [])
      .map((ec: any) => ec.channels)
      .filter(Boolean) as { id: number; name: string; type: string; image_url: string }[];
    const sorted = [
      ...allChannels.filter(c => c.id === channelId),
      ...allChannels.filter(c => c.id !== channelId),
    ];
    const date = event.end_at
      ? `${event.start_at.replaceAll("-", ".").slice(0, 10)} - ${event.end_at.replaceAll("-", ".").slice(0, 10)}`
      : event.start_at?.replaceAll("-", ".").slice(0, 10) ?? "상시";
    return {
      id: event.id,
      title: event.title,
      date,
      location: "온라인",
      category: getChannelTypeText(sorted[0]?.type),
      imageColor: imageColors[index % imageColors.length],
      imageUrl: event.image_url,
      reservationType: undefined,
      channels: sorted.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
      startDateValue: event.start_at,
      endDateValue: event.end_at,
      eventType: "online" as const,
    };
  });

  return (
    <ChannelProfileClient
      channelId={channelId}
      initialChannel={currentChannel as any}
      initialTeamChannel={teamData as any}
      initialMemberChannels={membersData as any[]}
      initialFavoriteCount={favCount}
      initialOfflineEvents={formattedOffline}
      initialOnlineEvents={formattedOnline}
    />
  );
}