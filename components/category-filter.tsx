"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "전체" },
  { id: "game", label: "게임" },
  { id: "youtuber", label: "유튜버" },
  { id: "vtuber", label: "버튜버" },
  { id: "festival", label: "축제" },
  { id: "always", label: "상시" },
];

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  sortType: "recent" | "upcoming";
  onSortChange: (sort: "recent" | "upcoming") => void;
}

export function CategoryFilter({
  activeCategory,
  onCategoryChange,
  sortType,
  onSortChange,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 px-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 md:pb-0">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              className={cn(
                "px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-full border transition-all whitespace-nowrap",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center bg-muted/50 p-1 rounded-xl self-end md:self-auto w-[180px] h-9 border border-border/30 select-none">
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
          최근 등록
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
          가까운 일정
        </button>
      </div>
    </div>
  );
}
