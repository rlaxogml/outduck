import { HomeClient } from "@/components/home-client";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60; // ISR cache revalidation every 60 seconds

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

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const offlineQuery = supabase
    .from("offline_events")
    .select(`
      id,
      title,
      start_date,
      end_date,
      image_url,
      reservation_type,
      created_at,
      events(
        event_channels(
          channels(
            id,
            name,
            type,
            image_url
          )
        )
      ),
      offline_event_locations(
        location
      )
    `)
    .or(`end_date.gte.${todayStr},end_date.is.null`)
    .order("start_date", { ascending: true });

  const onlineQuery = supabase
    .from("online_events")
    .select(`
      id,
      title,
      start_at,
      end_at,
      image_url,
      created_at,
      events(
        event_channels(
          channels(
            id,
            name,
            type,
            image_url
          )
        )
      )
    `)
    .or(`end_at.gte.${todayStr},end_at.is.null`)
    .order("start_at", { ascending: true });

  const posterQuery = supabase
    .from("posters")
    .select("*")
    .order("order", { ascending: true });

  const [{ data: offlineData }, { data: onlineData }, { data: posterData }] = await Promise.all([
    offlineQuery,
    onlineQuery,
    posterQuery,
  ]);

  const formatEventDate = (start: string | null, end: string | null) => {
    if (!start) return "상시";
    return end
      ? `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`
      : start.replaceAll("-", ".");
  };

  const formatOnlineEventDate = (start: string | null, end: string | null) => {
    if (!start) return "상시";
    
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${month}.${day}`;
    };

    const startFormatted = formatDate(start);
    if (!end) return startFormatted;
    
    const endFormatted = formatDate(end);
    return `${startFormatted} ~ ${endFormatted}`;
  };

  const extractChannels = (eventChannels: any[]) => {
    return (eventChannels || [])
      .map((ec: any) => ec.channels)
      .filter(Boolean) as { id: number; name: string; type: string; image_url: string }[];
  };

  const getCategory = (type?: string) => {
    if (!type) return "기타";
    const t = type.trim().toLowerCase();
    if (t === "game") return "게임";
    if (t === "youtuber") return "유튜버";
    if (t === "festival") return "축제";
    return "기타";
  };

  let offlineEvents: Event[] = [];
  if (offlineData) {
    const filteredOffline = offlineData.filter(event => {
      if (event.end_date && event.end_date < todayStr) return false;
      return true;
    });

    offlineEvents = filteredOffline.map((event, index) => {
      const channels = extractChannels((event.events as any)?.event_channels);
      return {
        id: event.id,
        title: event.title,
        date: formatEventDate(event.start_date, event.end_date),
        location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
        category: getCategory(channels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: event.reservation_type as Event["reservationType"],
        channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_date,
        createdAt: event.created_at,
        startDateValue: event.start_date,
      };
    });
  }

  let onlineEvents: Event[] = [];
  if (onlineData) {
    const filteredOnline = onlineData.filter(event => {
      const endAtDate = event.end_at ? event.end_at.split("T")[0] : null;
      if (endAtDate && endAtDate < todayStr) return false;
      return true;
    });

    onlineEvents = filteredOnline.map((event, index) => {
      const channels = extractChannels((event.events as any)?.event_channels);
      return {
        id: event.id,
        title: event.title,
        date: formatOnlineEventDate(event.start_at, event.end_at),
        location: "온라인",
        category: getCategory(channels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: undefined,
        channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_at,
        createdAt: event.created_at,
        startDateValue: event.start_at,
      };
    });
  }

  let posters: any[] = [];
  if (posterData) {
    posters = (posterData || []).filter((p: any) => {
      if (p.force_hide) return false; // Force hide takes highest precedence
      if (p.is_active) return true;   // Force show
      if (p.payment_status !== 'paid') return false; // Must be paid to auto show

      const start = p.start_date ? p.start_date.split('T')[0] : null;
      const end = p.end_date ? p.end_date.split('T')[0] : null;
      
      if (start && start > todayStr) return false;
      if (end && end < todayStr) return false;
      
      return true;
    });
  }

  return (
    <HomeClient 
      initialOfflineEvents={offlineEvents} 
      initialOnlineEvents={onlineEvents} 
      initialPosters={posters}
    />
  );
}
