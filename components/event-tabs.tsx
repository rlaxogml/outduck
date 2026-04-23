"use client";

import { cn } from "@/lib/utils";

interface EventTabsProps {
  activeTab: "offline" | "online";
  onTabChange: (tab: "offline" | "online") => void;
}

export function EventTabs({ activeTab, onTabChange }: EventTabsProps) {
  return (
    <div className="flex w-full border-b border-border">
      <button
        className={cn(
          "flex-1 py-3 text-sm font-medium transition-colors",
          activeTab === "offline"
            ? "bg-blue-100 text-blue-700 border-b-2 border-blue-500"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={() => onTabChange("offline")}
      >
        오프라인 일정
      </button>
      <button
        className={cn(
          "flex-1 py-3 text-sm font-medium transition-colors",
          activeTab === "online"
            ? "bg-blue-100 text-blue-700 border-b-2 border-blue-500"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        onClick={() => onTabChange("online")}
      >
        온라인 일정
      </button>
    </div>
  );
}
