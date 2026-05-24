"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ChevronLeft, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

function FailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const errorCode = searchParams.get("code") || "PAYMENT_CANCEL";
  const errorMessage = searchParams.get("message") || "사용자가 결제를 취소했거나 네트워크 요인으로 결제가 무산되었습니다.";

  return (
    <div className="max-w-xl mx-auto py-12 animate-in fade-in zoom-in-95 duration-300">
      <Card className="rounded-3xl border-destructive/20 shadow-xl bg-background/95 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-destructive" />
        
        <CardHeader className="text-center pb-6">
          <div className="w-16 h-16 bg-destructive/10 dark:bg-destructive/15 text-destructive rounded-full flex items-center justify-center mx-auto mb-4 border border-destructive/20 shadow-inner">
            <XCircle className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-black text-slate-900 dark:text-slate-50">결제에 실패하였습니다</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            에러코드: {errorCode}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6">
          {/* Error explanation box */}
          <div className="bg-destructive/[0.02] border border-destructive/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">실패 원인 정보</span>
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed break-words">
              {errorMessage}
            </p>
          </div>

          <div className="bg-slate-500/[0.04] border border-slate-500/10 rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
              * 결제 정보 오류, 한도 초과 또는 일시적 통신 지연일 수 있습니다. 문제가 지속되면 토스페이먼츠 고객센터 또는 당사 관리팀에 문의해주세요.
            </p>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border/60 p-6 flex flex-col sm:flex-row items-center gap-3">
          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full sm:flex-1 h-11 font-bold border-border/80 text-muted-foreground hover:text-foreground rounded-xl flex items-center justify-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> 메인 홈으로
          </Button>
          <Button 
            onClick={() => router.push("/ad-apply")}
            className="w-full sm:flex-1 h-11 font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> 광고 신청 재시도
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function AdApplyFailPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B0B0E] text-foreground flex flex-col pb-20">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        <Suspense fallback={
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-5" />
            <h2 className="text-xl font-bold mb-1.5">페이지 로딩 중</h2>
          </div>
        }>
          <FailContent />
        </Suspense>
      </main>
    </div>
  );
}
