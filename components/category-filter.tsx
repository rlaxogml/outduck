"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "전체" },
  { id: "game", label: "게임" },
  { id: "youtuber", label: "유튜버" },
];

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryFilter({
  activeCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border transition-colors",
              activeCategory === category.id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
            onClick={() => onCategoryChange(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}
