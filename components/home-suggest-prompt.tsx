"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X, ArrowRight } from "lucide-react";

// 홈 "관심 채널" 아래에 노출되는 제보 안내 카드.
// X로 닫으면 sessionStorage에 표시 → 같은 앱 세션 동안은 다시 안 뜨고,
// 앱을 완전히 종료했다 재실행하면(새 세션) 다시 노출된다.
const DISMISS_KEY = "outduck:home-suggest-dismissed";

export function HomeSuggestPrompt() {
  // ready=false 동안은 렌더하지 않아, 이미 닫은 유저에게 깜빡임이 보이지 않게 한다.
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // sessionStorage 접근 불가 시엔 그냥 노출
    }
    setVisible(!dismissed);
    setReady(true);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장 실패해도 현재 세션 동안은 상태로만 숨긴다
    }
    setVisible(false);
  };

  if (!ready || !visible) return null;

  return (
    <div className="mt-3 mb-1 flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/40 px-3.5 py-3 animate-in fade-in slide-in-from-top-1 duration-300">
      <p className="min-w-0 flex-1 break-keep text-[13px] font-medium leading-snug text-foreground">
        <Megaphone className="mr-1 inline-block h-[14px] w-[14px] align-[-0.125em] text-primary" />
        찾는 행사가 없으면 운영자에게 제보해주세요
      </p>

      <Link
        href="/suggest"
        className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
      >
        제보하기
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
