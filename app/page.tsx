"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { PosterSlider } from "@/components/poster-slider";
import { EventTabs } from "@/components/event-tabs";
import { CategoryFilter } from "@/components/category-filter";
import { EventCard } from "@/components/event-card";
import { GoogleAd } from "@/components/google-ad";

const offlineEvents = [
  {
    id: 1,
    title: "게임 캐릭터 팝업스토어",
    date: "2024.12.20 - 2025.01.15",
    location: "서울 성수동",
    category: "게임",
    imageColor: "bg-gradient-to-br from-indigo-400 to-indigo-600",
    reservationType: "자유입장" as const,
  },
  {
    id: 2,
    title: "유명 유튜버 팬미팅",
    date: "2024.12.25",
    location: "서울 강남",
    category: "유튜버",
    imageColor: "bg-gradient-to-br from-pink-400 to-pink-600",
    reservationType: "예약필수" as const,
  },
  {
    id: 3,
    title: "인디 게임 페스티벌",
    date: "2025.01.05 - 2025.01.07",
    location: "부산 벡스코",
    category: "게임",
    imageColor: "bg-gradient-to-br from-green-400 to-green-600",
    reservationType: "예약우대" as const,
  },
  {
    id: 4,
    title: "크리에이터 콜라보 전시회",
    date: "2025.01.10 - 2025.01.20",
    location: "서울 동대문",
    category: "유튜버",
    imageColor: "bg-gradient-to-br from-orange-400 to-orange-600",
    reservationType: "자유입장" as const,
  },
  {
    id: 5,
    title: "게임 OST 콘서트",
    date: "2025.02.01",
    location: "서울 예술의전당",
    category: "게임",
    imageColor: "bg-gradient-to-br from-purple-400 to-purple-600",
    reservationType: "예약필수" as const,
  },
  {
    id: 6,
    title: "버튜버 라이브 이벤트",
    date: "2025.02.14",
    location: "서울 올림픽홀",
    category: "유튜버",
    imageColor: "bg-gradient-to-br from-red-400 to-red-600",
    reservationType: "예약필수" as const,
  },
];

const onlineGoods = [
  {
    id: 101,
    title: "한정판 게임 피규어",
    date: "예약: 2024.12.15 - 12.31",
    location: "온라인 판매",
    category: "게임",
    imageColor: "bg-gradient-to-br from-teal-400 to-teal-600",
     reservationType: undefined,
  },
  {
    id: 102,
    title: "유튜버 공식 MD 세트",
    date: "판매중",
    location: "공식 스토어",
    category: "유튜버",
    imageColor: "bg-gradient-to-br from-amber-400 to-amber-600",
     reservationType: undefined,
  },
  {
    id: 103,
    title: "게임 아트북 프리오더",
    date: "예약: 2025.01.01 - 01.31",
    location: "온라인 한정",
    category: "게임",
    imageColor: "bg-gradient-to-br from-cyan-400 to-cyan-600",
     reservationType: undefined,
  },
  {
    id: 104,
    title: "스트리머 굿즈 박스",
    date: "한정 수량 판매",
    location: "공식 스토어",
    category: "유튜버",
    imageColor: "bg-gradient-to-br from-rose-400 to-rose-600",
     reservationType: undefined,
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"offline" | "online">("offline");
  const [activeCategory, setActiveCategory] = useState("all");

  const events = activeTab === "offline" ? offlineEvents : onlineGoods;

  const filteredEvents =
    activeCategory === "all"
      ? events
      : events.filter(
          (event) =>
            event.category === (activeCategory === "game" ? "게임" : "유튜버")
        );

  return (
    <div className="min-h-screen bg-background">
      {/* Left Google Ad */}
      <GoogleAd position="left" />

      {/* Right Google Ad */}
      <GoogleAd position="right" />

      {/* Main Content */}
      <div className="mx-auto max-w-5xl lg:px-8 px-4">
        <Header />

        <main className="pb-8">
          {/* Poster Slider */}
          <section className="py-4">
            <PosterSlider />
          </section>

          {/* Tabs */}
          <EventTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Category Filter */}
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Event Grid */}
          <section className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  date={event.date}
                  location={event.location}
                  category={event.category}
                  imageColor={event.imageColor}
                  reservationType={event.reservationType}
                />
              ))}
            </div>

            {filteredEvents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                해당 카테고리의 행사가 없습니다.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
