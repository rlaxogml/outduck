"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import { EmblaCarouselType } from "embla-carousel";

const posters = [
  {
    id: 1,
    title: "인기 행사 1",
    description: "광고용, 초기에는 인기행사 홍보용",
    bgColor: "bg-gradient-to-br from-blue-400 to-blue-600",
  },
  {
    id: 2,
    title: "인기 행사 2",
    description: "신규 오픈 이벤트",
    bgColor: "bg-gradient-to-br from-purple-400 to-purple-600",
  },
  {
    id: 3,
    title: "인기 행사 3",
    description: "특별 할인 이벤트",
    bgColor: "bg-gradient-to-br from-pink-400 to-pink-600",
  },
  {
    id: 4,
    title: "인기 행사 4",
    description: "한정판 굿즈 출시",
    bgColor: "bg-gradient-to-br from-orange-400 to-orange-600",
  },
  {
    id: 5,
    title: "인기 행사 5",
    description: "콜라보 이벤트",
    bgColor: "bg-gradient-to-br from-green-400 to-green-600",
  },
];

const numberWithinRange = (number: number, min: number, max: number) =>
  Math.min(Math.max(number, min), max);

export function PosterSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

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

      // The normalized slide distance from center. 0 is active, 1 is neighbor.
      const slideDistance = Math.abs(diffToTarget * scrollSnapList.length);
      
      // Inverse calculation: t goes from 1 (center) to 0 (far away).
      // We scale the decay such that side slides get notably affected.
      const t = numberWithinRange(1 - (slideDistance * 0.65), 0, 1);

      const innerNode = slideNode.querySelector(".poster-inner") as HTMLElement;
      const titleNode = slideNode.querySelector(".poster-title") as HTMLElement;
      const descNode = slideNode.querySelector(".poster-desc") as HTMLElement;
 
      if (innerNode) {
        const scale = 0.9 + (t * 0.1); // Scale down to 90%
        
        innerNode.style.transform = `scale(${scale})`;
        innerNode.style.opacity = ""; // Reset manual opacity override
        innerNode.style.filter = "";  // Reset legacy blur/brightness override
        // Elevate index for centered slide so overlap looks proper if scale increases
        innerNode.style.zIndex = t > 0.8 ? "10" : "0";
      }
      
      // Subtle inner content animation linked to tween factor
      if (titleNode) {
        titleNode.style.transform = `translateY(${(1 - t) * 10}px)`;
        titleNode.style.opacity = `${0.5 + (t * 0.5)}`;
      }
      if (descNode) {
        descNode.style.transform = `translateY(${(1 - t) * 20}px)`;
        descNode.style.opacity = `${t}`;
      }
    });
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    setScrollSnaps(emblaApi.scrollSnapList());
    
    // Core Tween events: run on every scroll and reInit
    setTweenNodes(emblaApi);
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", setTweenNodes);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("reInit", setTweenNodes);
  }, [emblaApi, onSelect, setTweenNodes]);

  return (
    /* Contained within normal 6xl container limits */
    <div className="w-full relative overflow-hidden py-2 group">
      <div className="overflow-visible" ref={emblaRef}>
        <div className="flex items-center touch-pan-y">
          {posters.map((poster) => (
            <div
              key={poster.id}
              className="flex-[0_0_100%] md:flex-[0_0_75%] min-[1152px]:flex-[0_0_950px] min-w-0 px-2 md:px-4 relative"
              style={{
                // Optimization for smooth scale/opacity adjustments
                backfaceVisibility: "hidden",
              }}
            >
              <div
                className={cn(
                  "poster-inner relative w-full aspect-[21/9] flex flex-col items-center justify-center text-white rounded-2xl md:rounded-3xl shadow-lg cursor-pointer will-change-transform",
                  poster.bgColor
                )}
                style={{
                  transition: "transform 0.2s ease-out, opacity 0.2s ease-out, filter 0.2s ease-out",
                  transformOrigin: "center center",
                }}
              >
                <div className="flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                  <h2 className="poster-title font-black tracking-tight mb-1.5 text-xl md:text-2xl lg:text-3xl transition-all duration-300 ease-out">
                    {poster.title}
                  </h2>
                  <p className="poster-desc text-sm md:text-base lg:text-lg font-medium transition-all duration-300 ease-out">
                    {poster.description}
                  </p>
                </div>
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

