"use client";

import { useEffect, useRef } from "react";
import { performanceTracker } from "@/lib/performance";

interface ServerTiming {
  label: string;
  duration: number;
}

export function RegisterServerTimings({ timings }: { timings: ServerTiming[] }) {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    timings.forEach(t => {
      performanceTracker.addLog({
        id: `server-${t.label}-${Date.now()}`,
        label: t.label,
        duration: t.duration,
        type: 'server'
      });
    });
  }, [timings]);

  return null;
}
