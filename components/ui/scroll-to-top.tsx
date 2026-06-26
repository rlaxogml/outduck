"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down by 400px
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out cursor-pointer",
        // Position: Higher on mobile to clear bottom nav, lower on desktop
        "right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+76px)]",
        "md:right-8 md:bottom-8",
        // Styling: Glassmorphism / Premium look
        "w-12 h-12 bg-white/90 dark:bg-slate-900/90 text-foreground border border-border/60 backdrop-blur-md",
        // Hover/Active animations
        "hover:scale-110 active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-xl hover:text-primary hover:border-primary/40",
        // Show/Hide transitions
        isVisible 
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
          : "opacity-0 translate-y-4 scale-75 pointer-events-none"
      )}
      aria-label="맨 위로 가기"
    >
      <ChevronUp className="w-6 h-6 stroke-[2.5] transition-transform duration-300 hover:-translate-y-0.5" />
    </button>
  );
}
