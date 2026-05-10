"use client";

import { cn } from "@/lib/utils";

interface EventTabsProps {
  activeTab: "offline" | "online";
  onTabChange: (tab: "offline" | "online") => void;
}

export function EventTabs({ activeTab, onTabChange }: EventTabsProps) {
  return (
    <div className="flex w-full border-b border-border mt-2">
      <button
        className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
        onClick={() => onTabChange("offline")}
      >
        <span className={cn(
          "transition-colors",
          activeTab === "offline" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
        )}>
          오프라인 일정
        </span>
        {activeTab === "offline" && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[linear-gradient(to_right,#3b82f6_0%,#8b5cf6_60%,#ec4899_100%)] rounded-t-full" />
        )}
      </button>
      <button
        className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
        onClick={() => onTabChange("online")}
      >
        <span className={cn(
          "transition-colors",
          activeTab === "online" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
        )}>
          온라인 일정
        </span>
        {activeTab === "online" && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[linear-gradient(to_right,#3b82f6_0%,#8b5cf6_60%,#ec4899_100%)] rounded-t-full" />
        )}
      </button>
    </div>
  );
}
