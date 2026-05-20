"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";

interface DateInputTripleProps {
  year: string;
  month: string;
  day: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
}

export const DateInputTriple = ({
  year,
  month,
  day,
  onYearChange,
  onMonthChange,
  onDayChange,
}: DateInputTripleProps) => {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    onYearChange(val);
    if (val.length === 4) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");

    if (val.length === 2) {
      const num = parseInt(val);
      if (num > 12) {
        const firstDigit = val.charAt(0);
        const rest = val.slice(1);
        onMonthChange(firstDigit);
        onDayChange(rest);
        dayRef.current?.focus();
        return;
      }
    }

    val = val.slice(0, 2);
    onMonthChange(val);
    if (val.length === 2) {
      dayRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 31) val = "31";
    onDayChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "month" | "day") => {
    if (e.key === "Backspace") {
      if (field === "month" && month === "") {
        yearRef.current?.focus();
      } else if (field === "day" && day === "") {
        monthRef.current?.focus();
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={yearRef}
          placeholder="----"
          className="w-16 sm:w-20 h-10 sm:h-11 bg-white dark:bg-muted/20 border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={year}
          onChange={handleYearChange}
          maxLength={4}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground/80 shrink-0">년</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={monthRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-white dark:bg-muted/20 border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, "month")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground/80 shrink-0">월</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Input
          ref={dayRef}
          placeholder="--"
          className="w-11 sm:w-12 h-10 sm:h-11 bg-white dark:bg-muted/20 border-2 border-border/80 focus:border-primary rounded-xl text-center font-mono text-base sm:text-lg font-extrabold focus:ring-primary/10 p-0 shadow-sm"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, "day")}
          maxLength={2}
        />
        <span className="text-xs sm:text-sm font-extrabold text-foreground/80 shrink-0">일</span>
      </div>
    </div>
  );
};
