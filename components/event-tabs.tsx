"use client";

import { cn } from "@/lib/utils";

interface EventTabsProps {
  activeTab: "offline" | "online";
  onTabChange: (tab: "offline" | "online") => void;
}

export function EventTabs({ activeTab, onTabChange }: EventTabsProps) {
  return (
    <div className="flex w-full border-b border-border mt-1 md:mt-2 relative">
      <button
        className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
        onClick={() => onTabChange("offline")}
      >
        <span className={cn(
          "transition-colors duration-200",
          activeTab === "offline" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
        )}>
          오프라인 일정
        </span>
      </button>
      <button
        className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
        onClick={() => onTabChange("online")}
      >
        <span className={cn(
          "transition-colors duration-200",
          activeTab === "online" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
        )}>
          온라인 일정
        </span>
      </button>
      
      {/* Sliding Underbar */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 h-[3px] bg-[linear-gradient(to_right,#3b82f6_0%,#8b5cf6_60%,#ec4899_100%)] rounded-t-full transition-transform duration-300 ease-out w-1/2",
          activeTab === "offline" ? "translate-x-0" : "translate-x-full"
        )}
      />
    </div>
  );
}
