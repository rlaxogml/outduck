"use client";

import { useState, useRef, useEffect } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 px-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-30">
      <div 
        ref={containerRef}
        className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 md:pb-0"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-full border transition-all font-semibold shrink-0 cursor-pointer",
            isExpanded 
              ? "bg-slate-200 dark:bg-slate-800 border-slate-300 text-foreground" 
              : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>필터</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Always visible: Active Category */}
          <button
            className={cn(
              "px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-full border transition-all font-semibold shadow-sm whitespace-nowrap cursor-pointer",
              "bg-primary text-primary-foreground border-primary"
            )}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {categories.find((c) => c.id === activeCategory)?.label || "전체"}
          </button>

          {/* Collapsible container for other categories */}
          <div
            className={cn(
              "flex items-center gap-2 transition-all duration-300 ease-in-out origin-left",
              isExpanded 
                ? "max-w-[500px] opacity-100 scale-100" 
                : "max-w-0 opacity-0 scale-95 pointer-events-none overflow-hidden"
            )}
          >
            {categories
              .filter((c) => c.id !== activeCategory)
              .map((category) => (
                <button
                  key={category.id}
                  className="px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-full border bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all whitespace-nowrap cursor-pointer"
                  onClick={() => {
                    onCategoryChange(category.id);
                    setIsExpanded(false);
                  }}
                >
                  {category.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="relative flex items-center bg-muted/50 p-1 rounded-xl self-end md:self-auto w-[180px] h-9 border border-border/30 select-none">
        {/* Sliding pill background */}
        <div
          className={cn(
            "absolute top-[4px] bottom-[4px] left-[4px] w-[calc(50%-4px)] bg-background rounded-lg shadow-sm border border-border/10 transition-transform duration-300 ease-out z-0",
            sortType === "upcoming" ? "translate-x-0" : "translate-x-full"
          )}
        />
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
      </div>
    </div>
  );
}
