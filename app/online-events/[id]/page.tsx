import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { OnlineEventDetailClient, type OnlineEventDetail } from "@/components/events/online-event-detail-client";
import { RegisterServerTimings } from "@/components/register-server-timings";

export const revalidate = 0; // Dynamic rendering for online event details

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) return {};

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data } = await supabase
    .from("online_events")
    .select("title, description")
    .eq("id", eventId)
    .maybeSingle();

  if (!data) return { title: "온라인 행사를 찾을 수 없습니다 - 아웃덕" };

  return {
    title: `${data.title} - 아웃덕`,
    description: data.description ? data.description.substring(0, 150) : `${data.title} 온라인 행사 상세 정보입니다.`,
  };
}

export default async function OnlineEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) {
    notFound();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const start = performance.now();
  const { data, error } = await supabase
    .from("online_events")
    .select(`
      id, event_id, title, description, start_at, end_at, image_url, links,
      events (
        event_channels ( channels ( id, name, type, image_url, owner_id, company ) )
      )
    `)
    .eq("id", eventId)
    .maybeSingle();

  const duration = performance.now() - start;
  const color = duration > 500 ? '\x1b[31m' : duration > 150 ? '\x1b[33m' : '\x1b[32m';
  console.log(`${color}[Perf Server] SERVER - 온라인 행사 상세 조회 (Server): ${duration.toFixed(1)}ms\x1b[0m`);

  if (error || !data) {
    notFound();
  }

  const eventObj = data.events as any;
  const channels = (eventObj?.event_channels || [])
    .map((ec: any) => ec.channels)
    .filter(Boolean);

  const event: OnlineEventDetail = {
    id: data.id,
    event_id: data.event_id,
    title: data.title,
    description: data.description,
    start_at: data.start_at,
    end_at: data.end_at,
    image_url: data.image_url,
    links: (() => {
      const rawLinks = data.links as Record<string, string> | null;
      if (!rawLinks || typeof rawLinks !== "object") return [];
      return Object.entries(rawLinks).map(([name, url]) => ({
        link_name: name,
        link_url: url
      }));
    })(),
    channels,
  };

  const serverTimings = [
    { label: "온라인 행사 상세 조회 (Server)", duration }
  ];

  return (
    <>
      <RegisterServerTimings timings={serverTimings} />
      <OnlineEventDetailClient initialEvent={event} />
    </>
  );
}
