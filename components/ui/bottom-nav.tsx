"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, Calendar, MapPinned, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function BottomNav() {
  const pathname = usePathname();

  // 탭을 누르는 즉시 하이라이트를 옮겨 "반응이 빠른" 느낌을 준다 (실제 페이지 전환은 뒤이어).
  // Link를 유지하므로 prefetch 이점은 그대로. 실제 경로가 도달하면 낙관적 상태 해제.
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const activePath = pendingPath ?? pathname;

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const navItems = [
    { id: "home", label: "홈", path: "/", icon: House },
    { id: "calendar", label: "캘린더", path: "/calendar", icon: Calendar },
    { id: "map", label: "지도", path: "/map", icon: MapPinned },
    { id: "subscriptions", label: "팔로우 채널", path: "/subscriptions", icon: Star },
    { id: "settings", label: "MY", path: "/settings", icon: User },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 flex items-stretch justify-around select-none"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: "8px",
        minHeight: "calc(env(safe-area-inset-bottom, 0px) + 64px)",
      }}
    >
      {/* iOS Safari 등에서 주소창이 숨겨지며 바텀 바가 붕 뜰 때 빈 공간이 보이지 않도록 아래쪽으로 배경을 확장합니다 */}
      <div className="absolute top-full left-0 right-0 h-[50vh] bg-background -z-10" />

      {navItems.map((item) => {
        const isActive = activePath === item.path;
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            href={item.path}
            onClick={(e) => {
              // 이미 이 탭에 있을 때 다시 누르면 → 최상단으로 스크롤 (유튜브식 재탭 동작)
              if (item.path === pathname) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }
              setPendingPath(item.path);
            }}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all duration-200 cursor-pointer relative rounded-2xl mx-1",
              isActive ? "bg-slate-100 dark:bg-slate-800/60" : "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/30"
            )}
          >
            <Icon
              className={cn(
                "h-[22px] w-[22px] transition-all duration-300",
                isActive
                  ? "text-blue-600 dark:text-blue-400 scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
                  : "text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              )}
            />
            <span
              className={cn(
                item.id === "settings" ? "text-[12px]" : "text-[10px]",
                "font-bold tracking-tight transition-colors duration-200 mt-1",
                isActive
                  ? "bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
