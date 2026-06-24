"use client";

import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { cn } from "@/lib/utils";

interface SortingFilterBarProps {
  sortType: "recent" | "upcoming";
  onSortChange: (sort: "recent" | "upcoming") => void;
  recentLabel?: string;
  upcomingLabel?: string;
}

export function SortingFilterBar({
  sortType,
  onSortChange,
  recentLabel = "최근 등록",
  upcomingLabel = "가까운 일정",
}: SortingFilterBarProps) {
  return (
    <div className="flex items-center justify-between w-full md:w-auto md:justify-end px-4 py-2 bg-background/50 backdrop-blur-sm sticky top-0 z-30 border-b border-border/40 gap-2">
      {/* Mobile Hamburger Menu Button (Visible only on mobile) */}
      <MobileMenuButton />

      <div className="relative flex items-center bg-muted/50 p-1 rounded-xl w-[180px] h-9 border border-border/30 select-none self-end md:self-auto">
        {/* Sliding pill background */}
        <div
          className={cn(
            "absolute top-[4px] bottom-[4px] left-[4px] w-[calc(50%-4px)] bg-background rounded-lg shadow-sm border border-border/10 transition-transform duration-300 ease-out z-0",
            sortType === "recent" ? "translate-x-0" : "translate-x-full"
          )}
        />
        <button
          className={cn(
            "flex-1 text-center text-[12px] font-bold transition-colors duration-300 relative z-10 cursor-pointer",
            sortType === "recent"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSortChange("recent")}
        >
          {recentLabel}
        </button>
        <button
          className={cn(
            "flex-1 text-center text-[12px] font-bold transition-colors duration-300 relative z-10 cursor-pointer",
            sortType === "upcoming"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSortChange("upcoming")}
        >
          {upcomingLabel}
        </button>
      </div>
    </div>
  );
}
