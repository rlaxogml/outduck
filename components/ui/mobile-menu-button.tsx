"use client";

import { Menu } from "lucide-react";
import { triggerOpenMobileMenu } from "@/lib/events";

export function MobileMenuButton() {
  return (
    <button
      onClick={triggerOpenMobileMenu}
      className="flex md:hidden items-center justify-center h-9 w-9 bg-white dark:bg-slate-800 border border-border rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
      aria-label="메뉴 열기"
    >
      <Menu className="h-5 w-5 text-slate-800 dark:text-slate-200" />
    </button>
  );
}
