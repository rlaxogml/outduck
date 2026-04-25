"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReservationType = "예약필수" | "예약우대" | "자유입장" | "티켓팅";

interface EventCardProps {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType?: ReservationType;
  channels?: { id: number; name: string; image_url: string }[];
}

const reservationBadgeColors: Record<ReservationType, string> = {
  "예약필수": "bg-red-500 text-white",
  "예약우대": "bg-orange-500 text-white",
  "자유입장": "bg-green-500 text-white",
  "티켓팅": "bg-purple-500 text-white",
};

export function EventCard({
  title,
  date,
  location,
  category,
  imageColor,
  imageUrl,
  reservationType,
  channels,
}: EventCardProps) {
  const [showChannels, setShowChannels] = useState(false);
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowChannels(false);
      }
    };
    if (showChannels) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showChannels]);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={`aspect-[5/3] ${!imageUrl ? imageColor : 'bg-muted'} relative`}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2/3 h-1/2 border-2 border-white/30 rounded-lg flex items-end p-3">
              <div className="w-full h-4 bg-white/20 rounded" />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background rounded-full"
        >
          <Heart className="h-4 w-4" />
          <span className="sr-only">찜하기</span>
        </Button>
        <span className="absolute top-2 left-2 px-2 py-1 bg-background/80 rounded text-sm font-medium">
          {category}
        </span>

        {channels && channels.length > 0 && (
          <div className="absolute -bottom-6 left-3" ref={popupRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (channels.length === 1) {
                  router.push(`/channels/${channels[0].id}`);
                } else {
                  setShowChannels(!showChannels);
                }
              }}
              className="flex items-center -space-x-9 transition-transform hover:scale-105 active:scale-95"
            >
              {channels.slice(0, 3).map((channel, i) => (
                <div
                  key={i}
                  className="relative w-18 h-18 rounded-full border-2 border-black/60 overflow-hidden bg-muted"
                  style={{ zIndex: 10 - i }}
                >
                  {channel.image_url ? (
                    <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">
                        {channel.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {channels.length > 3 && (
                <div
                  className="relative w-18 h-18 rounded-full border-2 border-black/60 bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground"
                  style={{ zIndex: 0 }}
                >
                  +{channels.length - 3}
                </div>
              )}
            </button>

            {showChannels && (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-background border border-border rounded-2xl shadow-lg p-3 min-w-[160px]">
                <div className="absolute -bottom-2 left-5 w-4 h-4 bg-background border-r border-b border-border rotate-45" />
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {channels.length === 1 ? "주최자" : "공동 주최자"}
                </p>
                <div className="flex flex-row gap-3">
                  {channels.map((c, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => router.push(`/channels/${c.id}`)}>
                      <div className="w-14 h-14 rounded-full border border-border overflow-hidden bg-muted flex-shrink-0">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground">
                              {c.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-center break-keep w-full">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <CardContent className="py-3 px-6">
        <div className="flex justify-between items-start gap-4">
          <h3 className="font-semibold text-xl line-clamp-2 mb-2">{title}</h3>
          {reservationType && (
            <span className={`shrink-0 mt-1 px-4 py-1.5 rounded text-base font-semibold ${reservationBadgeColors[reservationType]}`}>
              {reservationType}
            </span>
          )}
        </div>
        <p className="text-lg text-muted-foreground mb-1">{date}</p>
        <p className="text-lg text-muted-foreground">{location}</p>
      </CardContent>
    </Card>
  );
}