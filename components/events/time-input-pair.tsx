"use client";

import { useRef } from "react";

interface TimeInputPairProps {
  hour: string;
  minute: string;
  onHourChange: (v: string) => void;
  onMinuteChange: (v: string) => void;
  size?: "default" | "sm";
  disabled?: boolean;
}

export const TimeInputPair = ({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  size = "default",
  disabled = false,
}: TimeInputPairProps) => {
  const hourRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");

    if (val.length === 2) {
      const num = parseInt(val);
      if (num > 23) {
        const firstDigit = val.charAt(0);
        const rest = val.slice(1);
        onHourChange(firstDigit);
        onMinuteChange(rest);
        minRef.current?.focus();
        return;
      }
    }

    val = val.slice(0, 2);
    onHourChange(val);
    if (val.length === 2) {
      minRef.current?.focus();
    }
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 59) val = "59";
    onMinuteChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, isMin: boolean) => {
    if (e.key === "Backspace" && isMin && minute === "") {
      hourRef.current?.focus();
    }
  };

  const isSm = size === "sm";

  return (
    <div
      className={`flex items-center justify-center border-2 transition-all rounded-xl shadow-sm select-none shrink-0
      ${
        disabled
          ? "bg-slate-100/80 dark:bg-muted/10 border-border/40 opacity-40 cursor-not-allowed pointer-events-none"
          : "bg-white dark:bg-muted/20 border-border/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"
      }
      ${isSm ? "h-9.5 w-[96px] px-2" : "h-11 w-[118px] px-3"}`}
    >
      <input
        ref={hourRef}
        placeholder="__"
        disabled={disabled}
        className={`bg-transparent border-0 p-0 text-center font-mono font-extrabold placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 shrink-0
          ${disabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-foreground"}
          ${isSm ? "w-[20px] text-[13.5px]" : "w-[26px] text-[16px]"}`}
        value={hour}
        onChange={handleHourChange}
        maxLength={2}
      />
      <span
        className={`font-black shrink-0 select-none mx-1 relative bottom-[0.5px]
        ${disabled ? "text-muted-foreground/30" : "text-foreground/45"}
        ${isSm ? "text-[14px]" : "text-[17px]"}`}
      >
        :
      </span>
      <input
        ref={minRef}
        placeholder="__"
        disabled={disabled}
        className={`bg-transparent border-0 p-0 text-center font-mono font-extrabold placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 shrink-0
          ${disabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-foreground"}
          ${isSm ? "w-[20px] text-[13.5px]" : "w-[26px] text-[16px]"}`}
        value={minute}
        onChange={handleMinChange}
        onKeyDown={(e) => handleKeyDown(e, true)}
        maxLength={2}
      />
      <span
        className={`font-bold shrink-0 select-none ml-1
        ${disabled ? "text-slate-400/50" : "text-muted-foreground"}
        ${isSm ? "text-[11px]" : "text-[13px]"}`}
      >
        분
      </span>
    </div>
  );
};
