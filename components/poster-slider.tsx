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

export function PosterSlider() {
  const [posters, setPosters] = useState<Poster[]>(cachedPosters || []);
  const [isLoading, setIsLoading] = useState(cachedPosters === null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
  }, [
    Autoplay({
      delay: 4000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    })
  ]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  useEffect(() => {
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
          .eq("is_active", true)
          .order("order", { ascending: true });

        if (error) {
          console.error("PosterSlider: Supabase select error:", error);
          throw error;
        }

        console.log("PosterSlider: Posters fetched. Count:", data?.length);

        const now = new Date();
        const validPosters = (data || []).filter((p: any) => {
          const start = p.start_date ? new Date(p.start_date) : null;
          const end = p.end_date ? new Date(p.end_date) : null;
          
          if (start && start > now) return false;
          if (end && end < now) return false;
          
          return true;
        });

        cachedPosters = validPosters;
        if (isMounted) {
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

  const setTweenNodes = useCallback((emblaApi: EmblaCarouselType) => {
    const engine = emblaApi.internalEngine();
    const scrollProgress = emblaApi.scrollProgress();
    const scrollSnapList = emblaApi.scrollSnapList();

    emblaApi.slideNodes().forEach((slideNode, slideIndex) => {
      let diffToTarget = scrollSnapList[slideIndex] - scrollProgress;

      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((loopItem) => {
          const target = loopItem.target();
          if (slideIndex === loopItem.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) diffToTarget = scrollSnapList[slideIndex] - (1 + scrollProgress);
            if (sign === 1) diffToTarget = scrollSnapList[slideIndex] + (1 - scrollProgress);
          }
        });
      }

      const slideDistance = Math.abs(diffToTarget * scrollSnapList.length);
      const t = numberWithinRange(1 - (slideDistance * 0.65), 0, 1);

      const innerNode = slideNode.querySelector(".poster-inner") as HTMLElement;
 
      if (innerNode) {
        const scale = 0.9 + (t * 0.1);
        innerNode.style.transform = `scale(${scale})`;
        innerNode.style.zIndex = t > 0.8 ? "10" : "0";
      }
    });
  }, []);

  useEffect(() => {
    if (!emblaApi || posters.length === 0) return;

    onSelect(emblaApi);
    setScrollSnaps(emblaApi.scrollSnapList());
    
    setTweenNodes(emblaApi);
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", setTweenNodes);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("reInit", setTweenNodes);
  }, [emblaApi, posters, onSelect, setTweenNodes]);

  // Safeguards: Avoid rendering flash and hide if empty.
  if (isLoading) {
    return (
      <div className="w-full max-w-[950px] mx-auto aspect-[21/9] px-4 mb-4 animate-pulse bg-muted/50 rounded-3xl" />
    );
  }

  if (posters.length === 0) {
    return null; // Hide slider completely if zero active records found
  }

  return (
    /* Contained within normal 6xl container limits */
    <div className="w-full relative overflow-hidden py-2 group">
      <div className="overflow-visible" ref={emblaRef}>
        <div className="flex items-center touch-pan-y">
          {posters.map((poster, index) => (
            <div
              key={poster.id}
              className="flex-[0_0_100%] md:flex-[0_0_75%] min-[1152px]:flex-[0_0_950px] min-w-0 px-2 md:px-4 relative"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div
                onClick={() => poster.link_url && window.open(poster.link_url, "_blank")}
                className={cn(
                  "poster-inner relative w-full aspect-[21/9] flex flex-col items-center justify-center text-white rounded-2xl md:rounded-3xl shadow-lg will-change-transform bg-cover bg-center overflow-hidden",
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

      {/* Soft localized vignettes within the contained container - Hidden on Mobile to respect clean viewport edges */}
      <div className="hidden md:block absolute inset-y-0 left-0 w-[40px] md:w-[50px] bg-[linear-gradient(to_right,white_0%,transparent_100%)] z-20 pointer-events-none" />
      <div className="hidden md:block absolute inset-y-0 right-0 w-[40px] md:w-[50px] bg-[linear-gradient(to_left,white_0%,transparent_100%)] z-20 pointer-events-none" />



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
      <div className="flex items-center justify-center gap-2 mt-6">
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

