"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  UserCircle2,
  Building2,
  CheckCircle2
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { CompanyApplyForm } from "@/components/apply/company-apply-form";
import { OrganizerApplyForm } from "@/components/apply/organizer-apply-form";

export default function ApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [hasChannel, setHasChannel] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [mode, setMode] = useState<"selection" | "admin" | "organizer">("selection");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("로그인이 필요합니다.");
        router.push("/");
        return;
      }
      setUser(session.user);
      
      try {
        const { data, error } = await supabase
          .from("channels")
          .select("id")
          .eq("owner_id", session.user.id)
          .limit(1);
        
        if (!error && data && data.length > 0) {
          setHasChannel(true);
        }
      } catch (e) {}

      setIsLoadingAuth(false);
    };
    checkAuth();
  }, [router]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-background rounded-3xl border border-border shadow-xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">신청 접수 완료</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              주최자 신청이 성공적으로 접수되었습니다.<br />
              관리자 승인 후 활성화될 예정입니다.
            </p>
            <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={() => router.push("/")}>
              홈으로 돌아가기
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background flex flex-col pb-20">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-12">
        
        {mode === "selection" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">신청하기</h1>
              <p className="text-muted-foreground text-lg">활동하려는 유형에 맞춰 신청을 진행해주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {/* Admin Option */}
              <button
                onClick={() => setMode("admin")}
                className="group relative flex flex-col items-center justify-center p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:-translate-y-1 text-left"
              >
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">관리자(회사) 신청</h3>
                <p className="text-muted-foreground text-sm text-center">소속사 또는 기업 단위로<br/>다양한 계정을 통합 관리</p>
              </button>

              {/* Organizer Option */}
              <button
                onClick={() => !hasChannel && setMode("organizer")}
                disabled={hasChannel}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-8 bg-background border-2 rounded-3xl transition-all duration-300 text-left",
                  hasChannel 
                    ? "border-border/50 opacity-50 cursor-not-allowed grayscale" 
                    : "border-border shadow-sm hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300",
                  hasChannel ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover:scale-110"
                )}>
                  <UserCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">주최자 신청</h3>
                {hasChannel ? (
                  <p className="text-primary font-bold text-sm text-center">이미 주최자 계정이 있습니다</p>
                ) : (
                  <p className="text-muted-foreground text-sm text-center">개인 크리에이터, 게임 등<br/>행사를 주최하고 싶으신 분</p>
                )}
              </button>
            </div>
          </div>
        )}

        {mode === "admin" && user && (
          <CompanyApplyForm
            user={user}
            onBack={() => setMode("selection")}
            onSuccess={() => setIsSuccess(true)}
          />
        )}

        {mode === "organizer" && user && (
          <OrganizerApplyForm
            user={user}
            onBack={() => setMode("selection")}
            onSuccess={() => setIsSuccess(true)}
          />
        )}
        
      </main>
    </div>
  );
}
