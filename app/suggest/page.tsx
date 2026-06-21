"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  CalendarPlus,
  Tv2,
  CheckCircle2,
  ArrowLeft
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { trackPerformance } from "@/lib/performance";
import { ChannelProposalForm } from "@/components/suggest/channel-proposal-form";
import { EventProposalForm } from "@/components/suggest/event-proposal-form";

export default function SuggestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [mode, setMode] = useState<"selection" | "channel" | "event">("selection");
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await trackPerformance(
        "제안 페이지 세션 조회 (Client)",
        "auth",
        () => supabase.auth.getSession()
      );
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
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
            <h2 className="text-2xl font-bold mb-2">접수 완료</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {successMessage || "제안이 성공적으로 접수되었습니다."}<br />
              관리자 검토 후 반영될 예정입니다.
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

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-12">
        {mode === "selection" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">제안 / 제보하기</h1>
              <p className="text-muted-foreground text-lg">아웃덕 플랫폼을 함께 만들어갈 제보 및 제안을 선택해 주세요.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 mt-12">
              {/* Event Suggestion */}
              <button
                onClick={() => setMode("event")}
                className="group relative flex flex-col items-center justify-center p-4 sm:p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 text-left cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CalendarPlus className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-center">행사 제보</h3>
                <p className="text-muted-foreground text-[11px] sm:text-sm text-center break-keep leading-relaxed">
                  등록되지 않은 <span className="whitespace-nowrap">온/오프라인</span> 행사 제보
                </p>
              </button>

              {/* Channel Proposal */}
              <button
                onClick={() => setMode("channel")}
                className="group relative flex flex-col items-center justify-center p-4 sm:p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 text-left cursor-pointer"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Tv2 className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 text-center">채널 증설 제안</h3>
                <p className="text-muted-foreground text-[11px] sm:text-sm text-center break-keep leading-relaxed">
                  크리에이터 및 게임 등 신규 채널 제안
                </p>
              </button>
            </div>
          </div>
        )}

        {mode === "channel" && (
          <div>
            <button 
              onClick={() => setMode("selection")}
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> 유형 다시 선택
            </button>
            <ChannelProposalForm
              user={user}
              onSuccess={() => {
                setSuccessMessage("채널 증설 제안이 성공적으로 접수되었습니다.");
                setIsSuccess(true);
              }}
            />
          </div>
        )}

        {mode === "event" && (
          <div>
            <button 
              onClick={() => setMode("selection")}
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> 유형 다시 선택
            </button>
            <EventProposalForm
              user={user}
              onSuccess={() => {
                setSuccessMessage("행사 제보가 성공적으로 접수되었습니다.");
                setIsSuccess(true);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
