"use client";

import { cn } from "@/lib/utils";

type TabKey = "all" | "offline" | "online";

// showAllTab을 켜면 "전체" 탭이 추가되고 activeTab/onTabChange가 "all"까지 포함한다.
// 끄면(기본) 기존과 동일하게 오프라인/온라인 2개 탭만 노출 → 기존 사용처는 변화 없음.
type EventTabsProps =
  | {
      showAllTab: true;
      activeTab: TabKey;
      onTabChange: (tab: TabKey) => void;
    }
  | {
      showAllTab?: false;
      activeTab: "offline" | "online";
      onTabChange: (tab: "offline" | "online") => void;
    };

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "offline", label: "오프라인 일정" },
  { key: "online", label: "온라인 일정" },
];

export function EventTabs(props: EventTabsProps) {
  const { activeTab, showAllTab } = props;
  const onTabChange = props.onTabChange as (tab: TabKey) => void;

  const tabs = showAllTab ? ALL_TABS : ALL_TABS.filter((t) => t.key !== "all");
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeTab));
  const widthPct = 100 / tabs.length;

  return (
    <div className="flex w-full border-b border-border mt-1 md:mt-2 relative">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className="flex-1 relative py-3 md:py-4 text-sm md:text-base font-semibold transition-all duration-200"
          onClick={() => onTabChange(tab.key)}
        >
          <span className={cn(
            "transition-colors duration-200",
            activeTab === tab.key ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          )}>
            {tab.label}
          </span>
        </button>
      ))}

      {/* Sliding Underbar */}
      <div
        className="absolute bottom-0 left-0 h-[3px] bg-[linear-gradient(to_right,#3b82f6_0%,#8b5cf6_60%,#ec4899_100%)] rounded-t-full transition-transform duration-300 ease-out"
        style={{ width: `${widthPct}%`, transform: `translateX(${activeIndex * 100}%)` }}
      />
    </div>
  );
}
