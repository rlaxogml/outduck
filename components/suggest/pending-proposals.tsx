"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2, CalendarPlus, Tv2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/event-format";

type ProposalLink = { name?: string; url?: string };

type PendingItem = {
  id: string | number;
  kind: "event" | "channel";
  label: string;
  createdAt: string;
  subtype: string; // "오프라인 행사" / "온라인 행사" / 채널 유형 라벨
  description: string | null;
  dateRange: string | null;
  links: ProposalLink[] | null;
};

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  game: "게임",
  youtuber: "유튜버",
  vtuber: "버튜버",
  festival: "축제",
  always: "상시",
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

function withHttp(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// /suggest 하단에 "현재 등록 대기중인 제보(status=pending)"를 보여준다.
// 각 항목을 클릭하면 아래로 펼쳐져 상세 내용을 확인할 수 있다(아코디언).
// - 이미 올라온 제보 확인 → 중복 제보 방지
// - 본인이 제보한 게 잘 접수됐는지 확인
export function PendingProposals() {
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: events }, { data: channels }] = await Promise.all([
        supabase
          .from("event_proposals")
          .select("id, title, description, is_offline, is_online, start_date, end_date, links, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("channel_proposals")
          .select("id, name, type, links, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;

      const eventItems: PendingItem[] = ((events as any[] | null) || []).map((e) => ({
        id: e.id,
        kind: "event" as const,
        label: (e.title || "(제목 없음)").trim(),
        createdAt: e.created_at,
        subtype: e.is_online ? "온라인 행사" : "오프라인 행사",
        description: e.description ?? null,
        dateRange: e.start_date ? formatEventDate(e.start_date, e.end_date) : null,
        links: Array.isArray(e.links) ? e.links : null,
      }));

      const channelItems: PendingItem[] = ((channels as any[] | null) || []).map((c) => ({
        id: c.id,
        kind: "channel" as const,
        label: (c.name || "(이름 없음)").trim(),
        createdAt: c.created_at,
        subtype: `${CHANNEL_TYPE_LABEL[c.type] ?? c.type ?? "채널"} 증설 제안`,
        description: null,
        dateRange: null,
        links: Array.isArray(c.links) ? c.links : null,
      }));

      const merged = [...eventItems, ...channelItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
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
          {items.map((it) => {
            const key = `${it.kind}-${it.id}`;
            const open = openKey === key;
            const hasLinks = !!it.links && it.links.some((l) => l?.url);
            return (
              <li key={key} className="overflow-hidden rounded-xl border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {it.kind === "event" ? <CalendarPlus className="h-4 w-4" /> : <Tv2 className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{it.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {it.subtype} · {timeAgo(it.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-500">
                    대기중
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                      open && "rotate-180",
                    )}
                  />
                </button>

                {open && (
                  <div className="animate-in fade-in slide-in-from-top-1 space-y-3 border-t border-border bg-muted/20 px-3.5 py-3 text-sm duration-200">
                    {it.dateRange && (
                      <div>
                        <span className="text-xs font-bold text-muted-foreground">기간</span>
                        <p className="text-foreground">{it.dateRange}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-muted-foreground">내용</span>
                      <p className="whitespace-pre-wrap break-words text-foreground">
                        {it.description?.trim() || "작성된 상세 내용이 없어요."}
                      </p>
                    </div>
                    {hasLinks && (
                      <div>
                        <span className="text-xs font-bold text-muted-foreground">링크</span>
                        <div className="flex flex-col gap-1">
                          {it.links!
                            .filter((l) => l?.url)
                            .map((l, i) => (
                              <a
                                key={i}
                                href={withHttp(l.url!)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate font-medium text-blue-500 hover:underline dark:text-blue-400"
                              >
                                {l.name?.trim() ? `${l.name} · ` : ""}
                                {l.url!.replace(/^(https?:\/\/)?(www\.)?/, "")}
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
