"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReservationType = "예약필수" | "예약우대" | "자유입장";

interface EventCardProps {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageColor: string;
  imageUrl?: string;
  reservationType?: ReservationType;
  channels?: { name: string; image_url: string }[];
}

const reservationBadgeColors: Record<ReservationType, string> = {
  "예약필수": "bg-red-500 text-white",
  "예약우대": "bg-orange-500 text-white",
  "자유입장": "bg-green-500 text-white",
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
          <div className="absolute -bottom-6 left-3 flex items-center">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowChannels(!showChannels);
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
                    <img
                      src={channel.image_url}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                    />
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

        {showChannels && channels && channels.length > 0 && (
          <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm font-semibold mb-2 text-muted-foreground">
              {channels.length === 1 ? "주최자" : "공동 주최자"}
            </p>
            <div className="flex flex-wrap gap-2">
              {channels.map((c, i) => (
                <span key={i} className="text-sm bg-secondary/50 text-secondary-foreground px-2.5 py-1 rounded-md">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
