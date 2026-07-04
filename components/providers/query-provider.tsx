"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * 앱 전역 in-memory 데이터 캐시.
 *
 * 루트 레이아웃에 마운트되며, App Router에서 레이아웃은 클라이언트 네비게이션 시
 * remount되지 않으므로 QueryClient(캐시)가 화면 이동에도 살아남는다.
 * → 다른 화면 갔다 돌아오면 재요청 없이 캐시를 즉시 재사용.
 *
 * 반대로 앱 완전 종료 / 브라우저 탭 종료 / 하드 리로드(콜드 스타트) 시에는
 * JS 컨텍스트가 파괴되며 캐시도 함께 사라진다 → "세션 끝나면 초기화"가 공짜로 보장됨.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5분간은 fresh로 간주 → 세션 중 재방문 시 재요청 없이 캐시 즉시 사용.
            staleTime: 1000 * 60 * 5,
            // 30분간 아무 화면도 이 쿼리를 안 쓰면 메모리에서 회수(메모리 누적 방지).
            gcTime: 1000 * 60 * 30,
            // 앱 복귀/포커스마다 갑자기 재요청해서 깜빡이는 것 방지(위치·순서 유지).
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
