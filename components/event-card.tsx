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
  reservationType?: ReservationType;
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
  reservationType,
}: EventCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={`aspect-[5/3] ${imageColor} relative`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2/3 h-1/2 border-2 border-white/30 rounded-lg flex items-end p-3">
            <div className="w-full h-4 bg-white/20 rounded" />
          </div>
        </div>
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
      </div>
      <CardContent className="py-3 px-6">
        <div className="flex justify-between items-start gap-4">
          <h3 className="font-semibold text-xl line-clamp-2 mb-2">{title}</h3>
          {reservationType && (
            <span className={`shrink-0 mt-1 px-3 py-1.5 rounded text-sm font-semibold ${reservationBadgeColors[reservationType]}`}>
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
