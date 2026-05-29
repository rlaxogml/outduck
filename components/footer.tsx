"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Hide footer on specific pages if needed, for example map, admin, or chat pages
  if (pathname === "/map" || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="bg-muted/10 border-t border-border mt-auto w-full py-8 px-4 text-center pb-24 md:pb-8">
      <div className="max-w-screen-xl mx-auto flex flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-6 font-medium">
          <Link href="/terms" className="hover:text-primary transition-colors">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors font-bold text-foreground/80">
            개인정보처리방침
          </Link>
        </div>
        
        <div className="text-xs text-muted-foreground/60 space-y-1">
          <p>이메일: gkimth7@gmail.com</p>
          <p>&copy; {new Date().getFullYear()} OUTDUCK. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
