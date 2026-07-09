"use client";

import { useEffect, useRef } from "react";

// 앱을 백그라운드로 오래 두었다가(탭 전환/홈 버튼/화면 잠금) 다시 돌아왔을 때,
// 콜드 스타트처럼 홈(디폴트 화면)으로 완전 새로고침한다.
// 모바일에선 뒤로가기로 "종료"해도 실제론 백그라운드에 살아있어, 오래 뒤 복귀하면
// 이전 상태가 그대로 남는데 — 이걸 "다시 켠 것 같은" 경험으로 초기화한다.
//
// 루트 레이아웃에 한 번만 마운트되며(레이아웃은 화면 이동에도 remount 안 됨) 전역에 적용된다.
const BACKGROUND_RESET_TTL_MS = 30 * 60 * 1000; // 30분

export function AppResumeReset() {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // 백그라운드 진입 시각 기록
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt != null && Date.now() - hiddenAt > BACKGROUND_RESET_TTL_MS) {
          // 오래 백그라운드에 있었으면 홈으로 완전 새로고침(콜드 스타트).
          // replace로 히스토리를 남기지 않아 뒤로가기로 이전 세션 화면으로 돌아가지 않는다.
          window.location.replace("/");
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return null;
}
