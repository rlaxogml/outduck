"use server";

import { createClient } from "@supabase/supabase-js";
import { trackPerformance } from "@/lib/performance";
import { imageColors, formatEventDate, formatOnlineEventDate, extractChannels, getCategory } from "@/lib/event-format";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

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
            event_id,
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
          .order("id", { ascending: true })
          .range(offset, offset + limit - 1)
      );

      if (error) throw error;
      
      const formatted = (data || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        return {
          id: event.id,
          baseEventId: event.event_id,
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
          endDateValue: event.end_date,
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
            event_id,
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
          .order("id", { ascending: true })
          .range(offset, offset + limit - 1)
      );

      if (error) throw error;
      
      const formatted = (data || []).map((event, index) => {
        const channels = extractChannels((event.events as any)?.event_channels);
        return {
          id: event.id,
          baseEventId: event.event_id,
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
          endDateValue: event.end_at,
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
