"use server";

import { createClient } from "@supabase/supabase-js";
import { trackPerformance } from "@/lib/performance";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

const imageColors = [
  "bg-gradient-to-br from-indigo-400 to-indigo-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-green-400 to-green-600",
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-red-400 to-red-600",
];

const formatEventDate = (start: string | null, end: string | null) => {
  if (!start) return "상시";
  const startPt = start.replaceAll("-", ".").split("T")[0];
  const endPt = end ? end.replaceAll("-", ".").split("T")[0] : null;
  if (startPt === endPt || !endPt) {
    const parts = startPt.split(".");
    if (parts.length === 3) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}월 ${day}일`;
    }
    return startPt;
  }
  return `${startPt} - ${endPt}`;
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
  if (!end) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
    return startFormatted;
  }
  
  const endFormatted = formatDate(end);
  if (startFormatted === endFormatted) {
    const d = new Date(start);
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
    return startFormatted;
  }
  
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
  if (t === "vtuber") return "버튜버";
  if (t === "festival") return "축제";
  return "기타";
};

export async function fetchMoreEvents(
  type: "offline" | "online",
  offset: number,
  limit: number = 30
) {
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  try {
    if (type === "offline") {
      const { data, error } = await trackPerformance(
        `추가 오프라인 행사 페이징 조회 (${offset} - ${offset + limit - 1}) (ServerAction)`,
        "server",
        () => supabase
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
          .range(offset, offset + limit - 1)
      );

      if (error) throw error;
      
      const formatted = (data || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        return {
          id: event.id,
          title: event.title,
          date: formatEventDate(event.start_date, event.end_date),
          location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
          category: getCategory(channels[0]?.type),
          imageColor: imageColors[(offset + index) % imageColors.length],
          imageUrl: event.image_url,
          reservationType: event.reservation_type as any,
          channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
          isAlways: !event.start_date,
          createdAt: event.created_at,
          startDateValue: event.start_date,
        };
      });

      return { data: formatted, error: null };
    } else {
      const { data, error } = await trackPerformance(
        `추가 온라인 행사 페이징 조회 (${offset} - ${offset + limit - 1}) (ServerAction)`,
        "server",
        () => supabase
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
          .range(offset, offset + limit - 1)
      );

      if (error) throw error;
      
      const formatted = (data || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        return {
          id: event.id,
          title: event.title,
          date: formatOnlineEventDate(event.start_at, event.end_at),
          location: "온라인",
          category: getCategory(channels[0]?.type),
          imageColor: imageColors[(offset + index) % imageColors.length],
          imageUrl: event.image_url,
          reservationType: undefined,
          channels: channels.map(c => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
          isAlways: !event.start_at,
          createdAt: event.created_at,
          startDateValue: event.start_at,
        };
      });

      return { data: formatted, error: null };
    }
  } catch (error: any) {
    console.error("Error fetching more events:", error);
    return { data: null, error: error.message };
  }
}

export async function revalidatePaths(paths: string[]) {
  const { revalidatePath } = await import("next/cache");
  try {
    for (const p of paths) {
      console.log(`[revalidatePaths] Revalidating path: ${p}`);
      revalidatePath(p);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Revalidation failed:", error);
    return { success: false, error: error.message };
  }
}
