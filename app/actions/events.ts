"use server";

import { createClient } from "@supabase/supabase-js";
import { trackPerformance } from "@/lib/performance";
import { imageColors, formatEventDate, formatOnlineEventDate, extractChannels, getCategory } from "@/lib/event-format";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// 스토리지 삭제 전용 관리자 클라이언트.
// 클라이언트의 storage.remove()는 버킷 RLS에 막히면 조용히 실패하므로,
// service role 키로 RLS를 우회해 확실히 삭제한다.
const getStorageAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

const PUBLIC_URL_MARKER = "/storage/v1/object/public/";

/**
 * 특정 버킷에서 주어진 경로들을 삭제한다(service role). 실패해도 예외를 던지지 않는다.
 */
export async function deleteStoragePaths(
  bucket: string,
  paths: string[]
): Promise<{ ok: boolean; removed: number }> {
  const clean = Array.from(new Set(paths.filter((p) => !!p)));
  if (clean.length === 0) return { ok: true, removed: 0 };
  try {
    const { data, error } = await getStorageAdmin().storage.from(bucket).remove(clean);
    if (error) {
      console.error(`[deleteStoragePaths] '${bucket}' 삭제 실패:`, error.message);
      return { ok: false, removed: 0 };
    }
    return { ok: true, removed: data?.length ?? 0 };
  } catch (err) {
    console.error(`[deleteStoragePaths] '${bucket}' 예외:`, err);
    return { ok: false, removed: 0 };
  }
}

/**
 * 공개 스토리지 URL 목록을 받아 버킷별로 묶어 삭제한다(service role).
 * 외부 호스트 URL(cafe24 등)·빈 값은 자동으로 건너뛴다. 버킷 구분 없이 안전하게 호출 가능.
 */
export async function deleteStorageImages(
  urls: (string | null | undefined)[]
): Promise<{ ok: boolean; removed: number }> {
  const byBucket = new Map<string, string[]>();
  for (const raw of urls) {
    if (!raw) continue;
    const idx = raw.indexOf(PUBLIC_URL_MARKER);
    if (idx === -1) continue; // 외부 URL·비스토리지 값은 건너뜀
    let rest = raw.slice(idx + PUBLIC_URL_MARKER.length); // "<bucket>/<path...>"
    const q = rest.indexOf("?");
    if (q !== -1) rest = rest.slice(0, q);
    const slash = rest.indexOf("/");
    if (slash === -1) continue;
    const bucket = rest.slice(0, slash);
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!path) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(path);
  }

  let removed = 0;
  let ok = true;
  for (const [bucket, paths] of byBucket) {
    const res = await deleteStoragePaths(bucket, paths);
    removed += res.removed;
    if (!res.ok) ok = false;
  }
  return { ok, removed };
}

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

// 홈 신선도 머지용: created_at 최신순으로 오프라인/온라인 행사를 조회한다.
// (fetchMoreEvents는 start_date 순이라 "새로 등록된" 행사를 놓칠 수 있어 created_at 순으로 따로 조회)
export async function fetchLatestEvents(limit: number = 40) {
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  try {
    const offlineQuery = supabase
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
            channels(id, name, type, image_url)
          )
        ),
        offline_event_locations(location)
      `)
      .or(`end_date.gte.${todayStr},end_date.is.null`)
      .order("created_at", { ascending: false })
      .range(0, limit - 1);

    const onlineQuery = supabase
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
            channels(id, name, type, image_url)
          )
        )
      `)
      .or(`end_at.gte.${todayStr},end_at.is.null`)
      .order("created_at", { ascending: false })
      .range(0, limit - 1);

    const [{ data: offlineData, error: offErr }, { data: onlineData, error: onErr }] = await Promise.all([
      offlineQuery,
      onlineQuery,
    ]);
    if (offErr) throw offErr;
    if (onErr) throw onErr;

    const offline = (offlineData || []).map((event, index) => {
      const channels = extractChannels((event.events as any)?.event_channels);
      return {
        id: event.id,
        baseEventId: event.event_id,
        title: event.title,
        date: formatEventDate(event.start_date, event.end_date),
        location: event.offline_event_locations?.map((l: any) => l.location).join(", ") || "",
        category: getCategory(channels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: event.reservation_type as any,
        channels: channels.map((c) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_date,
        createdAt: event.created_at,
        startDateValue: event.start_date,
        endDateValue: event.end_date,
      };
    });

    const online = (onlineData || []).map((event, index) => {
      const channels = extractChannels((event.events as any)?.event_channels);
      return {
        id: event.id,
        baseEventId: event.event_id,
        title: event.title,
        date: formatOnlineEventDate(event.start_at, event.end_at),
        location: "온라인",
        category: getCategory(channels[0]?.type),
        imageColor: imageColors[index % imageColors.length],
        imageUrl: event.image_url,
        reservationType: undefined,
        channels: channels.map((c) => ({ id: c.id, name: c.name, image_url: c.image_url || "" })),
        isAlways: !event.start_at,
        createdAt: event.created_at,
        startDateValue: event.start_at,
        endDateValue: event.end_at,
      };
    });

    return { offline, online, error: null };
  } catch (error: any) {
    console.error("Error fetching latest events:", error);
    return { offline: null, online: null, error: error.message };
  }
}

// Busts the per-event Data Cache entry created by unstable_cache in app/events/[id]/page.tsx.
// Call on edit/delete so the cached detail doesn't stay stale for up to an hour.
export async function revalidateEventDetail(eventId: number) {
  const { revalidateTag } = await import("next/cache");
  try {
    // { expire: 0 } = expire immediately so the editor sees fresh data on the next load
    // (not stale-while-revalidate, which would show the pre-edit version once).
    revalidateTag(`offline-event-${eventId}`, { expire: 0 });
    return { success: true };
  } catch (error: any) {
    console.error("Event detail cache revalidation failed:", error);
    return { success: false, error: error.message };
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
