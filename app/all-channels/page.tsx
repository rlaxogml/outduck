"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = {
  id: number;
  name: string;
  type: string | null;
  image_url: string | null;
};

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "game", label: "게임" },
  { id: "youtuber", label: "유튜버" },
  { id: "vtuber", label: "버튜버" },
  { id: "festival", label: "축제" },
];

export default function AllChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setIsLoading(true);
        const [{ data, error }, { data: companies, error: companiesError }] = await Promise.all([
          supabase
            .from("channels")
            .select("id, name, type, image_url")
            .order("name", { ascending: true }),
          supabase.from("companies").select("name"),
        ]);

        if (error) throw error;
        if (companiesError) throw companiesError;

        const companyNames = new Set((companies || []).map((c) => c.name));
        setChannels((data || []).filter((channel) => !companyNames.has(channel.name)));
      } catch (err) {
        console.error("Failed to fetch channels:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, []);

  const filteredChannels = channels.filter((channel) => {
    // 1. 텍스트 검색 필터
    const matchSearch = channel.name.toLowerCase().includes(searchText.toLowerCase());

    // 2. 카테고리 필터
    let matchCategory = true;
    if (activeFilter !== "all") {
      matchCategory = channel.type === activeFilter;
    }

    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-12">
      <Header />

      <div className="max-w-5xl mx-auto px-4 mt-6">
        <div className="bg-white dark:bg-muted/10 border border-border/60 shadow-sm rounded-3xl p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-6 text-foreground">모든 채널</h1>

          {/* 검색창 */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="채널명을 검색해보세요"
              className="w-full h-12 rounded-2xl border border-border bg-slate-50 dark:bg-muted pl-11 pr-4 text-[15px] outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 필터 버튼 */}
          <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border",
                  activeFilter === filter.id
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-sm"
                    : "bg-white dark:bg-muted border-border text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* 채널 목록 */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-900/30 border-t-slate-900 dark:border-white/30 dark:border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-medium">
              해당하는 채널이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-x-4 gap-y-8">
              {filteredChannels.map((channel) => (
                <Link key={channel.id} href={`/channels/${channel.id}`} className="flex flex-col items-center group">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border border-border shadow-sm overflow-hidden bg-white mb-2 sm:mb-3 group-hover:scale-105 transition-transform flex items-center justify-center">
                    {channel.image_url ? (
                      <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">{channel.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-[12px] sm:text-sm font-bold text-center text-foreground group-hover:text-primary transition-colors line-clamp-2 px-1">
                    {channel.name}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">
                    {FILTERS.find(f => f.id === channel.type)?.label || "기타"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
