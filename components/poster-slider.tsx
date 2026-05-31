"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import { EmblaCarouselType } from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";

import { supabase } from "@/lib/supabase/client";

type Poster = {
  id: number;
  title: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
};

const numberWithinRange = (number: number, min: number, max: number) =>
  Math.min(Math.max(number, min), max);

const fallbackGradients = [
  "bg-gradient-to-br from-blue-400 to-blue-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-orange-400 to-orange-600",
  "bg-gradient-to-br from-green-400 to-green-600",
];

let cachedPosters: Poster[] | null = null;

export function PosterSlider({ initialPosters }: { initialPosters?: Poster[] }) {
  const [posters, setPosters] = useState<Poster[]>(initialPosters || cachedPosters || []);
  const [isLoading, setIsLoading] = useState(!initialPosters && cachedPosters === null);

  if (initialPosters && !cachedPosters) {
    cachedPosters = initialPosters;
  }

  const [startIndex, setStartIndex] = useState<number>(() => {
    const p = initialPosters || cachedPosters;
    return (p && p.length > 0) ? Math.floor(Math.random() * p.length) : 0;
  });
  const [hasSetStart, setHasSetStart] = useState<boolean>(!!(initialPosters || cachedPosters));

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
    startIndex: startIndex,
  }, [
    Autoplay({
      delay: 4000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  ]);

  const [selectedIndex, setSelectedIndex] = useState(startIndex);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (initialPosters && initialPosters.length > 0) {
      return;
    }

    console.log("PosterSlider: Fetching posters...");
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("PosterSlider: Loading safety timeout reached (15s). Forcing isLoading to false.");
        setIsLoading(false);
      }
    }, 15000);

    const fetchPosters = async () => {
      try {
        const { data, error } = await supabase
          .from("posters")
          .select("*")
          .order("order", { ascending: true });

        if (error) {
          console.error("PosterSlider: Supabase select error:", error);
          throw error;
        }

        console.log("PosterSlider: Posters fetched. Count:", data?.length);

        const nowStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        const validPosters = (data || []).filter((p: any) => {
          if (p.force_hide) return false; // Force hide takes highest precedence
          if (p.is_active) return true;   // Force show
          if (p.payment_status !== 'paid') return false; // Must be paid to auto show

          const start = p.start_date ? p.start_date.split('T')[0] : null;
          const end = p.end_date ? p.end_date.split('T')[0] : null;
          
          if (start && start > nowStr) return false;
          if (end && end < nowStr) return false;
          
          return true;
        });

        cachedPosters = validPosters;
        if (isMounted) {
          if (!hasSetStart && validPosters.length > 0) {
            setStartIndex(Math.floor(Math.random() * validPosters.length));
            setHasSetStart(true);
          }
          setPosters(validPosters);
        }
      } catch (err) {
        console.error("PosterSlider: Poster load failed:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        clearTimeout(safetyTimeout);
        console.log("PosterSlider: Fetch completed.");
      }
    };
    fetchPosters();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);

  useEffect(() => {
    if (!emblaApi || posters.length === 0) return;

    onSelect(emblaApi);
    setScrollSnaps(emblaApi.scrollSnapList());
    
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, posters, onSelect]);

  // Safeguards: Avoid rendering flash and hide if empty.
  if (isLoading) {
    return (
      <div className="w-full aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1] animate-pulse bg-muted/50" />
    );
  }

  if (posters.length === 0) {
    return null; // Hide slider completely if zero active records found
  }

  return (
    /* Full width container without side padding */
    <div className="w-full relative overflow-hidden group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex items-center touch-pan-y">
          {posters.map((poster, index) => (
            <div
              key={poster.id}
              className="flex-[0_0_100%] min-w-0 relative"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div
                onClick={() => poster.link_url && window.open(poster.link_url, "_blank")}
                className={cn(
                  "poster-inner relative w-full aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1] flex flex-col items-center justify-center text-white will-change-transform bg-cover bg-center overflow-hidden",
                  poster.link_url ? "cursor-pointer" : "cursor-default",
                  !poster.image_url && fallbackGradients[index % fallbackGradients.length]
                )}
                style={{
                  backgroundImage: poster.image_url ? `url(${poster.image_url})` : undefined,
                  transition: "transform 0.2s ease-out, opacity 0.2s ease-out, filter 0.2s ease-out",
                  transformOrigin: "center center",
                }}
              >
                {/* Dynamic Poster Canvas with support for transparent PNG background images or fallback gradients */}
              </div>
            </div>
          ))}
        </div>
      </div>





      {/* Navigation Controls within local container bounds */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-2 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto bg-white/90 hover:bg-white dark:bg-black/50 dark:hover:bg-black/70 rounded-full h-10 w-10 md:h-12 md:w-12 shadow-md backdrop-blur-sm transition-transform opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 z-30"
          onClick={scrollPrev}
        >
          <ChevronLeft className="h-6 w-6 text-foreground" />
          <span className="sr-only">이전 슬라이드</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto bg-white/90 hover:bg-white dark:bg-black/50 dark:hover:bg-black/70 rounded-full h-10 w-10 md:h-12 md:w-12 shadow-md backdrop-blur-sm transition-transform opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 z-30"
          onClick={scrollNext}
        >
          <ChevronRight className="h-6 w-6 text-foreground" />
          <span className="sr-only">다음 슬라이드</span>
        </Button>
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 z-30">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            className={cn(
              "h-2 rounded-full transition-all duration-300 cursor-pointer",
              index === selectedIndex
                ? "bg-foreground w-6"
                : "bg-muted-foreground/30 w-2 hover:bg-muted-foreground/50"
            )}
            onClick={() => scrollTo(index)}
            aria-label={`슬라이드 ${index + 1}로 이동`}
          />
        ))}
      </div>
    </div>
  );
}

