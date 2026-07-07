import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { EventDetailClient, type EventDetail } from "@/components/events/event-detail-client";
import { RegisterServerTimings } from "@/components/register-server-timings";

export const revalidate = 60; // Route is dynamic (useSearchParams); kept in sync with the data cache below.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// React cache() dedups the call within a single request (page + generateMetadata run in one pass).
// unstable_cache persists the query RESULT across requests in Next's Data Cache. The route itself
// stays dynamic (EventDetailClient uses useSearchParams), so this doesn't serve the whole page from
// the edge — it just spares Supabase from being re-queried on every hit. 60s window absorbs traffic
// spikes (many hits on one event → ~1 query/min) while capping stale data at ~1 minute.
// Tagged per-event so an edit/delete can invalidate just this event immediately via revalidateTag.
const getOfflineEvent = cache((eventId: number) =>
  unstable_cache(
    async () => {
      const start = performance.now();
      const res = await supabase
        .from("offline_events")
        .select(`
          id, event_id, title, description, start_date, end_date, start_time, end_time, image_url, reservation_type, reservation_starts_at, reservation_ends_at, links,
          events (
            event_channels ( channels ( id, name, type, image_url, owner_id, company ) ),
            event_images ( id, image_url, order ),
            event_schedules ( id, day_of_week, date, open_time, close_time, reservation_type )
          ),
          offline_event_locations ( location )
        `)
        .eq("id", eventId)
        .maybeSingle();

      const duration = performance.now() - start;
      // const color = duration > 500 ? '\x1b[31m' : duration > 150 ? '\x1b[33m' : '\x1b[32m';
      // console.log(`${color}[Perf Server] SERVER - 오프라인 행사 상세 조회 (Server): ${duration.toFixed(1)}ms\x1b[0m`);

      // Never cache a transient DB error — throw so unstable_cache skips caching it.
      if (res.error) throw new Error(res.error.message);

      return { data: res.data, duration };
    },
    ["offline-event-detail", String(eventId)],
    { revalidate: 60, tags: [`offline-event-${eventId}`] }
  )()
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) return {};

  let data: any = null;
  try {
    ({ data } = await getOfflineEvent(eventId));
  } catch {
    return {};
  }

  if (!data) return { title: "행사를 찾을 수 없습니다 - 아웃덕" };

  return {
    title: `${data.title} - 아웃덕`,
    description: data.description ? data.description.substring(0, 150) : `${data.title} 행사 상세 정보입니다.`,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) {
    notFound();
  }

  let data: any = null;
  let duration = 0;
  try {
    ({ data, duration } = await getOfflineEvent(eventId));
  } catch {
    notFound();
  }

  if (!data) {
    notFound();
  }

  const eventObj = data.events as any;
  const channels = (eventObj?.event_channels || [])
    .map((ec: any) => ec.channels)
    .filter(Boolean);

  const event: EventDetail = {
    id: data.id,
    event_id: data.event_id,
    title: data.title,
    description: data.description,
    start_date: data.start_date,
    end_date: data.end_date,
    start_time: data.start_time,
    end_time: data.end_time,
    location: data.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
    locationsList: data.offline_event_locations?.map((l: any) => l.location).filter(Boolean) || [],
    image_url: data.image_url,
    reservation_type: data.reservation_type,
    reservation_starts_at: data.reservation_starts_at,
    reservation_ends_at: data.reservation_ends_at,
    links: (() => {
      const rawLinks = data.links as Record<string, string> | null;
      if (!rawLinks || typeof rawLinks !== "object") return [];
      return Object.entries(rawLinks).map(([name, url]) => ({
        link_name: name,
        link_url: url
      }));
    })(),
    channels,
    images: (eventObj?.event_images || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
    schedules: eventObj?.event_schedules || [],
  };

  const serverTimings = [
    { label: "오프라인 행사 상세 조회 (Server)", duration }
  ];

  return (
    <>
      <RegisterServerTimings timings={serverTimings} />
      <EventDetailClient initialEvent={event} />
    </>
  );
}
