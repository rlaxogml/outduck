"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "전체" },
  { id: "game", label: "게임" },
  { id: "youtuber", label: "유튜버" },
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
                "px-3 py-1.5 text-sm rounded-full border transition-all whitespace-nowrap",
                activeCategory === category.id
                  ? "bg-foreground text-background border-foreground font-medium shadow-sm"
                  : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
              )}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg self-end md:self-auto">
        <button
          className={cn(
            "px-3 py-1 text-[12px] font-medium rounded-md transition-all",
            sortType === "recent"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSortChange("recent")}
        >
          최근 등록
        </button>
        <div className="w-[1px] h-3 bg-border mx-0.5" />
        <button
          className={cn(
            "px-3 py-1 text-[12px] font-medium rounded-md transition-all",
            sortType === "upcoming"
              ? "bg-background text-foreground shadow-sm"
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
