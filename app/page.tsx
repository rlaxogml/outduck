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

const getWeekDates = (baseDate: Date) => {
  const dates = [];
  const day = baseDate.getDay(); // 0 = Sun
  
  if (day === 0) {
    for (let i = 1; i <= 6; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d);
    }
    dates.push(new Date(baseDate));
    return dates;
  }

  const diff = baseDate.getDate() - day + 1; 
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(diff + i);
    dates.push(d);
  }
  return dates;
};

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const [year, month, day] = todayStr.split("-").map(Number);
  const baseDate = new Date(year, month - 1, day);
  const weekDates = getWeekDates(baseDate);
  const sortedWeekDates = [...weekDates].sort((a, b) => a.getTime() - b.getTime());
  const weekStart = sortedWeekDates[0].toLocaleDateString("sv-SE");
  const weekEnd = sortedWeekDates[6].toLocaleDateString("sv-SE");

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
    .order("start_date", { ascending: true })
    .range(0, 29);

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
    .order("start_at", { ascending: true })
    .range(0, 29);

  const posterQuery = supabase
    .from("posters")
    .select("*")
    .order("order", { ascending: true });

  const weeklyOfflineQuery = supabase
    .from("offline_events")
    .select(`
      id, event_id, title, start_date, end_date,
      offline_event_locations(location),
      events(
        event_channels(channels(id, name, image_url)),
        event_schedules(date, day_of_week, reservation_type)
      )
    `)
    .lte("start_date", weekEnd)
    .gte("end_date", weekStart);

  const weeklyOnlineQuery = supabase
    .from("online_events")
    .select(`
      id, event_id, title, start_at, end_at,
      events(event_channels(channels(id, name, image_url)))
    `)
    .lte("start_at", weekEnd)
    .or(`end_at.gte.${weekStart},end_at.is.null`);

  const measureServerQuery = async <T,>(label: string, promise: PromiseLike<T>) => {
    const s = performance.now();
    try {
      const res = await promise;
      const duration = performance.now() - s;
      const color = duration > 500 ? '\x1b[31m' : duration > 150 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[Perf Server] SERVER - ${label}: ${duration.toFixed(1)}ms\x1b[0m`);
      return { res, duration, label };
    } catch (err) {
      const duration = performance.now() - s;
      console.log(`\x1b[31m[Perf Server Failed] SERVER - ${label}: failed after ${duration.toFixed(1)}ms\x1b[0m`);
      throw err;
    }
  };

  const [offlineRes, onlineRes, posterRes, weeklyOfflineRes, weeklyOnlineRes] = await Promise.all([
    measureServerQuery("홈 오프라인 행사 조회 (Server)", offlineQuery),
    measureServerQuery("홈 온라인 행사 조회 (Server)", onlineQuery),
    measureServerQuery("홈 포스터 광고 조회 (Server)", posterQuery),
    measureServerQuery("홈 주간 오프라인 일정 조회 (Server)", weeklyOfflineQuery),
    measureServerQuery("홈 주간 온라인 일정 조회 (Server)", weeklyOnlineQuery),
  ]);

  const offlineData = offlineRes.res.data;
  const onlineData = onlineRes.res.data;
  const posterData = posterRes.res.data;
  const weeklyOfflineData = weeklyOfflineRes.res.data || [];
  const weeklyOnlineData = weeklyOnlineRes.res.data || [];

  const serverTimings = [
    { label: offlineRes.label, duration: offlineRes.duration },
    { label: onlineRes.label, duration: onlineRes.duration },
    { label: posterRes.label, duration: posterRes.duration },
    { label: weeklyOfflineRes.label, duration: weeklyOfflineRes.duration },
    { label: weeklyOnlineRes.label, duration: weeklyOnlineRes.duration },
  ];

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

  // Format weekly events
  const formatWeeklyOfflineEventDate = (start: string, end: string | null) => {
    return end
      ? `${start.replaceAll("-", ".")} - ${end.replaceAll("-", ".")}`
      : start?.replaceAll("-", ".") ?? "상시";
  };

  const formatWeeklyOnlineEventDate = (start: string | null, end: string | null) => {
    if (!start) return "상시";
    const parseDate = (dStr: string) => {
      const d = new Date(dStr);
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };
    return end ? `${parseDate(start)} ~ ${parseDate(end)}` : parseDate(start);
  };

  const weeklyOfflineEvents = weeklyOfflineData.map((e: any) => ({
    id: e.id,
    baseEventId: e.event_id,
    title: e.title,
    startDateValue: e.start_date,
    endDateValue: e.end_date,
    eventType: "offline" as const,
    dateStr: formatWeeklyOfflineEventDate(e.start_date, e.end_date),
    location: e.offline_event_locations?.[0]?.location || "장소 정보 없음",
    channels: e.events?.event_channels?.map((c: any) => c.channels).filter(Boolean) || [],
    schedules: e.events?.event_schedules || []
  }));

  const weeklyOnlineEvents = weeklyOnlineData.map((e: any) => {
    const sDate = e.start_at ? new Date(e.start_at).toLocaleDateString("sv-SE") : null;
    const eDate = e.end_at ? new Date(e.end_at).toLocaleDateString("sv-SE") : null;
    return {
      id: e.id,
      baseEventId: e.event_id,
      title: e.title,
      startDateValue: sDate || "",
      endDateValue: eDate,
      eventType: "online" as const,
      dateStr: formatWeeklyOnlineEventDate(e.start_at, e.end_at),
      location: "온라인",
      channels: e.events?.event_channels?.map((c: any) => c.channels).filter(Boolean) || []
    };
  }).filter((e: any) => e.startDateValue !== "");

  const weeklyEvents = [...weeklyOfflineEvents, ...weeklyOnlineEvents];

  return (
    <>
      <HomeClient 
        initialOfflineEvents={offlineEvents} 
        initialOnlineEvents={onlineEvents} 
        initialPosters={posters}
        initialWeeklyEvents={weeklyEvents}
      />
    </>
  );
}
