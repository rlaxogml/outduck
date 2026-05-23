"use client";

import { usePathname, useRouter } from "next/navigation";
import { House, Calendar, MapPinned, Star, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { id: "home", label: "홈", path: "/", icon: House },
    { id: "calendar", label: "캘린더", path: "/calendar", icon: Calendar },
    { id: "map", label: "지도", path: "/map", icon: MapPinned },
    { id: "subscriptions", label: "구독행사", path: "/subscriptions", icon: Star },
    { id: "bookmarks", label: "찜한행사", path: "/bookmarks", icon: Heart },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border/50 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 flex items-stretch justify-around select-none"
      style={{
        height: "calc(env(safe-area-inset-bottom, 0px) + 64px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: "8px",
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-muted-foreground transition-all duration-200 cursor-pointer relative"
          >
            {/* Active Top indicator line */}
            {isActive && (
              <span className="absolute top-0 w-8 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 animate-in fade-in slide-in-from-top-1 duration-300" />
            )}

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
                "text-[10px] font-bold tracking-tight transition-colors duration-200 mt-1",
                isActive
                  ? "bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
