"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Header } from "@/components/header";
import { OrganizerSection } from "@/components/organizer-section";
import { toast } from "sonner";

export default function HostPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("로그인이 필요합니다.");
          if (isMounted) router.replace("/");
          return;
        }

        if (isMounted) setUser(session.user);

        // Check if user is a host (has at least one channel where they are the owner)
        const { data: hostData, error } = await supabase
          .from("channels")
          .select("id")
          .eq("owner_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (!hostData || error) {
          toast.error("주최자 권한이 없습니다.");
          if (isMounted) router.replace("/");
          return;
        }
      } catch (err) {
        console.error("HostPage error:", err);
        if (isMounted) router.replace("/");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-pulse text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <OrganizerSection user={user} />
      </div>
    </div>
  );
}
