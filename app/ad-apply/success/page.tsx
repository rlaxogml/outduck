"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Calendar, FileText, ChevronRight, Home, CreditCard } from "lucide-react";
import { toast } from "sonner";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amountStr = searchParams.get("amount");

  const [isLoading, setIsLoading] = useState(true);
  const [successData, setSuccessData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const registerPoster = async () => {
      if (!orderId) {
        setErrorMsg("잘못된 접근입니다. 주문 번호가 없습니다.");
        setIsLoading(false);
        return;
      }

      // Check if we already registered this order (using key in sessionStorage or localStorage to avoid double inserts)
      const processedKey = `processed_ad_${orderId}`;
      if (sessionStorage.getItem(processedKey)) {
        // Already processed, load historical info
        const savedInfo = sessionStorage.getItem(`info_ad_${orderId}`);
        if (savedInfo) {
          setSuccessData(JSON.parse(savedInfo));
        }
        setIsLoading(false);
        return;
      }

      const pendingKey = `pending_ad_${orderId}`;
      const pendingDataStr = localStorage.getItem(pendingKey);
      
      if (!pendingDataStr) {
        setErrorMsg("신청된 임시 광고 정보가 유실되었거나 이미 처리 완료되었습니다.");
        setIsLoading(false);
        return;
      }

      try {
        const pending = JSON.parse(pendingDataStr);

        // Fetch current user session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;

        // 1. Query the highest 'order' value currently in the posters table
        const { data: maxOrderData, error: orderQueryError } = await supabase
          .from("posters")
          .select("order")
          .order("order", { ascending: false })
          .limit(1);

        if (orderQueryError) {
          console.error("Failed to query max order:", orderQueryError);
          throw orderQueryError;
        }

        const maxOrder = maxOrderData?.[0]?.order ?? 0;
        const newOrder = maxOrder + 1;

        // 2. Insert into the posters table
        const { data: insertedPoster, error: insertError } = await supabase
          .from("posters")
          .insert([
            {
              title: `${pending.advertiser_name} 광고`,
              image_url: pending.image_url,
              link_url: pending.link_url,
              order: newOrder,
              is_active: false,
              start_date: pending.start_date,
              end_date: pending.end_date,
              advertiser_name: pending.advertiser_name,
              contact: pending.contact,
              payment_status: "paid",
              user_id: userId
            }
          ])
          .select("id")
          .single();

        if (insertError) {
          console.error("Poster insertion failed:", insertError);
          throw insertError;
        }

        // 3. Insert into ad_payments table
        const { error: paymentInsertError } = await supabase
          .from("ad_payments")
          .insert([
            {
              order_id: orderId,
              payment_key: paymentKey,
              poster_id: insertedPoster?.id,
              user_id: userId,
              amount: pending.amount || parseInt(amountStr || "0", 10),
              type: "payment",
              description: `배너 광고 ${pending.days}일 결제`
            }
          ]);

        if (paymentInsertError) {
          console.error("Payment insertion failed:", paymentInsertError);
          // We don't throw here to avoid failing the user's success page if poster was successfully registered,
          // but in production we might want a transaction.
        }

        // Save processing token to session to prevent double submission
        sessionStorage.setItem(processedKey, "true");
        sessionStorage.setItem(`info_ad_${orderId}`, JSON.stringify(pending));
        
        // Clean up localStorage pending data
        localStorage.removeItem(pendingKey);

        setSuccessData(pending);
        toast.success("결제 및 광고 신청 등록이 성공적으로 완료되었습니다!");
      } catch (err: any) {
        console.error("Registration error:", err);
        setErrorMsg("결제 완료 데이터베이스 등록 중 오류가 발생했습니다: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    registerPoster();
  }, [orderId, paymentKey, amountStr]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-5" />
        <h2 className="text-xl font-bold mb-1.5 text-slate-800 dark:text-slate-200">광고 결제 및 승인 대조 중</h2>
        <p className="text-muted-foreground text-sm">토스페이먼츠 토큰과 매핑 중입니다. 브라우저를 닫지 마세요.</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="py-16 max-w-md mx-auto">
        <Card className="rounded-3xl border-destructive/20 bg-destructive/[0.02] p-6 text-center shadow-md">
          <CardHeader>
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 rotate-180" />
            </div>
            <CardTitle className="text-lg text-destructive font-bold">오류가 발생했습니다</CardTitle>
            <CardDescription className="text-xs">{errorMsg}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center pt-2">
            <Button onClick={() => router.push("/ad-apply")} className="rounded-xl font-bold bg-slate-900 text-white">
              광고 신청 다시 하기
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-10 animate-in fade-in zoom-in-95 duration-500">
      <Card className="rounded-3xl border-border/60 shadow-xl bg-background/95 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
        
        {/* Animated Check Header */}
        <CardHeader className="text-center pb-6">
          <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <CardTitle className="text-2xl font-black text-slate-900 dark:text-slate-50">결제 및 배너 등록 성공!</CardTitle>
          <CardDescription className="font-semibold text-xs text-muted-foreground mt-1">
            주문번호: {orderId}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6">
          {/* Ad Registration Info Receipt Box */}
          <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">배너 등록 확인서</span>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>광고주명</span>
                <span className="text-foreground font-bold">{successData?.advertiser_name}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>담당자 연락처</span>
                <span className="text-foreground">{successData?.contact}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>광고 시작 날짜</span>
                <span className="text-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" /> {successData?.start_date}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>광고 종료 날짜</span>
                <span className="text-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" /> {successData?.end_date}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>광고 기간</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{successData?.days} 일간</span>
              </div>
              
              <div className="h-px bg-border/60 my-2" />
              
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-foreground">결제 완료 금액</span>
                <span className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-muted-foreground mr-0.5" />
                  {successData?.amount ? successData.amount.toLocaleString() : "0"} 원
                </span>
              </div>
            </div>
          </div>

          {/* Guidelines info */}
          <div className="bg-emerald-500/[0.04] border border-emerald-500/10 rounded-2xl p-4 flex gap-3">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 leading-relaxed">
              신청하신 광고 배너는 즉시 <strong>'노출 활성화(Active)'</strong> 상태로 슬라이더에 추가되었습니다. 노출 기간 중 광고 상태 제어(수정/삭제)는 어드민 콘솔을 통해 전속 관리됩니다.
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border/60 p-6 flex flex-col sm:flex-row items-center gap-3">
          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full sm:flex-1 h-11 font-bold border-border/80 text-muted-foreground hover:text-foreground rounded-xl flex items-center justify-center gap-1.5"
          >
            <Home className="w-4 h-4" /> 메인 홈으로
          </Button>
          <Button 
            onClick={() => router.push("/ad-apply")}
            className="w-full sm:flex-1 h-11 font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl flex items-center justify-center gap-1"
          >
            광고 추가 신청 <ChevronRight className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function AdApplySuccessPage() {
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
          <SuccessContent />
        </Suspense>
      </main>
    </div>
  );
}
