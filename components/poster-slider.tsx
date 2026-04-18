"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function PosterSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? posters.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === posters.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full">
      {/* Slider Container */}
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {posters.map((poster) => (
            <div
              key={poster.id}
              className={`min-w-full aspect-[21/9] flex flex-col items-center justify-center ${poster.bgColor} text-white`}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                {poster.title}
              </h2>
              <p className="text-sm md:text-base opacity-90">
                ({poster.description})
              </p>
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full h-10 w-10"
          onClick={goToPrevious}
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="sr-only">이전 슬라이드</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 rounded-full h-10 w-10"
          onClick={goToNext}
        >
          <ChevronRight className="h-6 w-6" />
          <span className="sr-only">다음 슬라이드</span>
        </Button>
      </div>

      {/* Pagination Dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {posters.map((_, index) => (
          <button
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index === currentIndex
                ? "bg-foreground"
                : "bg-muted-foreground/40"
            }`}
            onClick={() => goToSlide(index)}
            aria-label={`슬라이드 ${index + 1}로 이동`}
          />
        ))}
      </div>
    </div>
  );
}
