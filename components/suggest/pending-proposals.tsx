"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2, CalendarPlus, Tv2 } from "lucide-react";

type PendingItem = {
  id: string | number;
  kind: "event" | "channel";
  label: string;
  createdAt: string;
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const day = 86_400_000;
  if (diff < 3_600_000) return "방금 전";
  if (diff < day) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

// /suggest 하단에 "현재 등록 대기중인 제보(status=pending)"를 보여준다.
// - 이용자가 이미 올라온 제보를 확인 → 중복 제보 방지
// - 본인이 제보한 게 잘 접수됐는지 확인
export function PendingProposals() {
  const [items, setItems] = useState<PendingItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: events }, { data: channels }] = await Promise.all([
        supabase
          .from("event_proposals")
          .select("id, title, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("channel_proposals")
          .select("id, name, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;

      const merged: PendingItem[] = [
        ...((events as any[] | null) || []).map((e) => ({
          id: e.id,
          kind: "event" as const,
          label: (e.title || "(제목 없음)").trim(),
          createdAt: e.created_at,
        })),
        ...((channels as any[] | null) || []).map((c) => ({
          id: c.id,
          kind: "channel" as const,
          label: (c.name || "(이름 없음)").trim(),
          createdAt: c.created_at,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setItems(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-bold text-foreground">현재 등록 대기중인 제보</h2>

      {items === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 py-8 text-center text-sm text-muted-foreground">
          현재 대기중인 제보가 없어요.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={`${it.kind}-${it.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {it.kind === "event" ? <CalendarPlus className="h-4 w-4" /> : <Tv2 className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{it.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {it.kind === "event" ? "행사 제보" : "채널 제안"} · {timeAgo(it.createdAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-500">
                대기중
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
