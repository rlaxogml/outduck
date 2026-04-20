"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Calendar, Search, Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase/client";

export function Header() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.email as string | undefined) ??
    "사용자";
  const avatarFallbackText = userName.slice(0, 1).toUpperCase();

  return (
    <header className="border-b border-border bg-background">
      {/* Top bar: Logo and Login */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground">
            <Star className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">아이콘</span>
        </div>
        {user ? (
          <Avatar className="size-9 border border-border">
            <AvatarImage src={avatarUrl} alt={`${userName} 프로필`} />
            <AvatarFallback>{avatarFallbackText}</AvatarFallback>
          </Avatar>
        ) : (
          <Button
            variant="ghost"
            className="text-sm font-medium"
            onClick={handleGoogleLogin}
          >
            로그인
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex items-center justify-center gap-6 border-t border-border px-4 py-3">
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Calendar className="h-4 w-4" />
          캘린더
        </button>
        <span className="text-border">|</span>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Search className="h-4 w-4" />
          검색
        </button>
        <span className="text-border">|</span>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Star className="h-4 w-4" />
          구독 행사
        </button>
        <span className="text-border">|</span>
        <button className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Heart className="h-4 w-4" />
          찜한 행사
        </button>
      </nav>
    </header>
  );
}
