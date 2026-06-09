"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Loader2, 
  UploadCloud, 
  Calendar, 
  Building2, 
  PhoneCall, 
  ExternalLink, 
  AlertCircle, 
  Sparkles, 
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { AdManager } from "@/components/ad-manager";

interface AdDateInputTripleProps {
  year: string;
  month: string;
  day: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
}

const AdDateInputTriple = ({
  year,
  month,
  day,
  onYearChange,
  onMonthChange,
  onDayChange,
}: AdDateInputTripleProps) => {
  const yearRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const dayRef = React.useRef<HTMLInputElement>(null);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    onYearChange(val);
    if (val.length === 4) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");

    if (val.length === 2) {
      const num = parseInt(val);
      if (num > 12) {
        const firstDigit = val.charAt(0);
        const rest = val.slice(1);
        onMonthChange(firstDigit);
        onDayChange(rest);
        dayRef.current?.focus();
        return;
      }
    }

    val = val.slice(0, 2);
    onMonthChange(val);
    if (val.length === 2) {
      dayRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 2);
    const num = parseInt(val);
    if (num > 31) val = "31";
    onDayChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "month" | "day") => {
    if (e.key === "Backspace") {
      if (field === "month" && month === "") {
        yearRef.current?.focus();
      } else if (field === "day" && day === "") {
        monthRef.current?.focus();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <div className="flex items-center gap-1.5">
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="연도"
          className="w-16 h-11 bg-white dark:bg-muted/10 border border-border/80 focus:border-orange-500/50 rounded-xl text-center text-sm p-0 shadow-xs focus-visible:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-muted-foreground/60 text-slate-800 dark:text-slate-200"
          value={year}
          onChange={handleYearChange}
          maxLength={4}
        />
        <span className="text-xs font-semibold text-slate-500">년</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="월"
          className="w-12 h-11 bg-white dark:bg-muted/10 border border-border/80 focus:border-orange-500/50 rounded-xl text-center text-sm p-0 shadow-xs focus-visible:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-muted-foreground/60 text-slate-800 dark:text-slate-200"
          value={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, "month")}
          maxLength={2}
        />
        <span className="text-xs font-semibold text-slate-500">월</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="일"
          className="w-12 h-11 bg-white dark:bg-muted/10 border border-border/80 focus:border-orange-500/50 rounded-xl text-center text-sm p-0 shadow-xs focus-visible:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all placeholder:text-muted-foreground/60 text-slate-800 dark:text-slate-200"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, "day")}
          maxLength={2}
        />
        <span className="text-xs font-semibold text-slate-500">일</span>
      </div>
    </div>
  );
};

export default function AdApplyPage() {
  const router = useRouter();
  
  const [mode, setMode] = useState<"selection" | "apply" | "edit">("selection");
  const [user, setUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("광고 관리는 로그인이 필요합니다.");
        router.push("/");
        return;
      }
      setUser(session.user);
      setIsLoadingAuth(false);
    };
    checkAuth();
  }, [router]);
  
  // Form fields
  const [advertiserName, setAdvertiserName] = useState("");
  const [contact, setContact] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Custom date selection states matching event registration
  const currentYear = new Date().getFullYear().toString();
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");

  // Synchronize start triple states to YYYY-MM-DD format
  useEffect(() => {
    if (startYear && startMonth && startDay) {
      setStartDate(`${startYear}-${startMonth.padStart(2, "0")}-${startDay.padStart(2, "0")}`);
    } else {
      setStartDate("");
    }
  }, [startYear, startMonth, startDay]);

  // Synchronize end triple states to YYYY-MM-DD format
  useEffect(() => {
    if (endYear && endMonth && endDay) {
      setEndDate(`${endYear}-${endMonth.padStart(2, "0")}-${endDay.padStart(2, "0")}`);
    } else {
      setEndDate("");
    }
  }, [endYear, endMonth, endDay]);
  
  // Image Upload state
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // General loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle extension of an existing expired ad
  const handleExtendAd = (ad: any) => {
    setAdvertiserName(ad.advertiser_name || ad.title || "");
    setLinkUrl(ad.link_url || "");
    setImageUrl(ad.image_url || null);
    
    // reset dates to force user to choose new dates
    setStartYear(currentYear);
    setStartMonth("");
    setStartDay("");
    setEndYear(currentYear);
    setEndMonth("");
    setEndDay("");
    
    // Switch to apply mode
    setMode("apply");
    toast.success("기존 광고 정보가 등록 폼에 불러와졌습니다. 새로운 기간을 설정해주세요!");
  };

  // Price calculations
  const [dailyPrice, setDailyPrice] = useState(10000);
  const [durationDays, setDurationDays] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isDateValid, setIsDateValid] = useState(false);

  useEffect(() => {
    const fetchDailyPrice = async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'banner_daily_price')
        .single();
      
      if (data && !error) {
        setDailyPrice(parseInt(data.value, 10) || 10000);
      }
    };
    fetchDailyPrice();
  }, []);

  // Date range verification & automatic fee calculation
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Set to midnight to compare exact dates
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setIsDateValid(false);
        setDurationDays(0);
        setTotalAmount(0);
        return;
      }

      if (end < start) {
        setIsDateValid(false);
        setDurationDays(0);
        setTotalAmount(0);
        return;
      }

      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of start and end days
      
      setIsDateValid(true);
      setDurationDays(diffDays);
      setTotalAmount(diffDays * dailyPrice); 
    } else {
      setIsDateValid(false);
      setDurationDays(0);
      setTotalAmount(0);
    }
  }, [startDate, endDate, dailyPrice]);

  const [isValidatingSlots, setIsValidatingSlots] = useState(false);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    
    const checkSlots = async () => {
      if (!startDate || !endDate || !isDateValid) {
        setFullyBookedDates([]);
        return;
      }
      
      setIsValidatingSlots(true);
      try {
        const { data, error } = await supabase
          .from("posters")
          .select("start_date, end_date")
          .eq("payment_status", "paid")
          .is("force_hide", false)
          .lte("start_date", endDate)
          .gte("end_date", startDate);
          
        if (error) throw error;
        
        if (!active) return;
        
        const overlappingAds = data || [];
        const maxSlots = 8;
        const booked: string[] = [];
        
        let tempDate = new Date(startDate);
        const lastDate = new Date(endDate);
        
        tempDate.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);
        
        while (tempDate <= lastDate) {
          const dateStr = tempDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
          
          const adsCount = overlappingAds.filter(ad => {
            if (!ad.start_date || !ad.end_date) return false;
            const adStart = ad.start_date.split("T")[0];
            const adEnd = ad.end_date.split("T")[0];
            return adStart <= dateStr && adEnd >= dateStr;
          }).length;
          
          if (adsCount >= maxSlots) {
            booked.push(dateStr);
          }
          
          tempDate.setDate(tempDate.getDate() + 1);
        }
        
        if (active) {
          setFullyBookedDates(booked);
        }
      } catch (err) {
        console.error("Error checking slots:", err);
      } finally {
        if (active) {
          setIsValidatingSlots(false);
        }
      }
    };
    
    checkSlots();
    
    return () => {
      active = false;
    };
  }, [startDate, endDate, isDateValid]);

  // Handle immediate upload on file select for preview
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate type (images only)
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    // Validate size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 최대 5MB를 넘을 수 없습니다.");
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `ad-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      setUploadProgress(30);

      const { data, error: uploadError } = await supabase.storage
        .from("ad_poster")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { data: { publicUrl } } = supabase.storage
        .from("ad_poster")
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      setUploadProgress(100);
      toast.success("이미지가 성공적으로 업로드되었습니다.");
    } catch (err: any) {
      console.error("Storage upload error:", err);
      toast.error("이미지 업로드 중 오류가 발생했습니다: " + err.message);
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Toss Payments dynamic checkout triggering
  const handlePayment = async () => {
    if (!advertiserName.trim()) {
      toast.error("광고주 이름을 입력해주세요.");
      return;
    }
    if (!contact.trim()) {
      toast.error("연락처를 입력해주세요.");
      return;
    }
    if (!imageUrl) {
      toast.error("광고 이미지를 선택하고 업로드를 대기해주세요.");
      return;
    }
    if (!isDateValid) {
      toast.error("올바른 광고 기간을 설정해주세요.");
      return;
    }
    if (fullyBookedDates.length > 0) {
      toast.error("예약이 마감된 날짜가 포함되어 있습니다.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Dynamic loader for Toss Payments standard SDK v2
      await new Promise<void>((resolve, reject) => {
        if ((window as any).TossPayments) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = "https://js.tosspayments.com/v2/standard";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("토스페이먼츠 SDK 로드 실패"));
        document.head.appendChild(script);
      });

      const orderId = `ad-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
      
      // Store pending form data in localStorage before redirecting to checkout
      const pendingData = {
        advertiser_name: advertiserName,
        contact: contact,
        image_url: imageUrl,
        link_url: linkUrl || null,
        start_date: startDate,
        end_date: endDate,
        amount: totalAmount,
        days: durationDays
      };
      
      localStorage.setItem(`pending_ad_${orderId}`, JSON.stringify(pendingData));

      // 0원 무료 광고 신청 처리
      if (totalAmount === 0) {
        toast.success("무료 광고 신청 처리 중입니다...");
        router.push(`/ad-apply/success?orderId=${orderId}&amount=0&paymentKey=FREE_${orderId}`);
        return;
      }

      // Trigger Toss Payments Checkout using USER's test client key
      const clientKey = "test_ck_0RnYX2w5322DlmbX11LN3NeyqApQ";
      
      // Initialize the Toss Payments standard SDK v2 instance
      const tossPayments = (window as any).TossPayments(clientKey);

      // Create a unique temporary customer key for anonymous checkout session (2-50 chars)
      const tempCustomerKey = `ad-cust-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString().slice(-4)}`;
      
      // Create the essential payment instance in v2 standard SDK
      const payment = tossPayments.payment({ customerKey: tempCustomerKey });

      // Trigger Toss Payments Checkout using v2 standard requestPayment API (single object input spec)
      await payment.requestPayment({
        method: "CARD",
        amount: {
          currency: "KRW",
          value: totalAmount,
        },
        orderId: orderId,
        orderName: `[Outduck] ${advertiserName} 메인 배너 광고 신청`,
        successUrl: `${window.location.origin}/ad-apply/success`,
        failUrl: `${window.location.origin}/ad-apply/fail`,
      });
    } catch (err: any) {
      console.error("Payment setup error:", err);
      toast.error("결제 시스템 호출 중 오류가 발생했습니다: " + err.message);
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0B0B0E] text-foreground flex flex-col pb-20">
      <Header />
      
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10">
        
        {mode === "selection" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto pt-10">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">광고 센터</h1>
              <p className="text-muted-foreground text-lg">원하시는 작업을 선택해주세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {/* Ad Edit Option */}
              <button
                onClick={() => setMode("edit")}
                className="group relative flex flex-col items-center justify-center p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 text-left"
              >
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">내 광고 관리 및 수정</h3>
                <p className="text-muted-foreground text-sm text-center">기존에 결제된 광고의 이미지나<br/>내용을 손쉽게 수정합니다</p>
              </button>

              {/* Ad Apply Option */}
              <button
                onClick={() => setMode("apply")}
                className="group relative flex flex-col items-center justify-center p-8 bg-background border-2 border-border rounded-3xl shadow-sm transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:-translate-y-1 text-left"
              >
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center">신규 광고 신청</h3>
                <p className="text-muted-foreground text-sm text-center">메인 화면 슬라이더에<br/>새로운 광고 배너를 등록합니다</p>
              </button>
            </div>
          </div>
        )}

        {mode === "edit" && user && (
          <AdManager 
            userId={user.id} 
            onBack={() => setMode("selection")} 
            onExtendAd={handleExtendAd}
          />
        )}

        {mode === "apply" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <Button variant="ghost" onClick={() => setMode("selection")} className="-ml-4 mb-2 text-muted-foreground hover:text-foreground">
              ← 이전 화면으로
            </Button>
            
            {/* Page Hero Title */}
            <div className="space-y-4 text-center mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-bold select-none animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <span>프리미엄 노출 서비스</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                Outduck 광고 배너 신청
              </h1>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
                아웃덕 메인 슬라이더 영역에 배너를 게재하여, 다양한 팬들과 주최자들에게 본인의 채널 및 축제를 입체적으로 알릴 수 있습니다.
              </p>
              <div className="inline-block mt-4 bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                💡 신청한 광고는 노출기간이 끝나기 전까지 언제든지 수정 가능합니다!
              </div>
            </div>

        {/* 1. Full-width Banner Image upload Card */}
        <Card className="rounded-3xl border-border/60 shadow-lg bg-background/90 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">광고 이미지 업로드</CardTitle>
            <CardDescription className="text-sm font-semibold text-orange-600 dark:text-orange-400 mt-2 leading-relaxed bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
              💡 메인 슬라이더 광고 배너 최적화 규격은 <strong className="text-orange-700 dark:text-orange-300">약 16:9 비율</strong>입니다. <br/>
              5MB 이내의 PNG, JPG, JPEG 이미지 포맷을 권장합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imageUrl ? (
              <div className="relative group rounded-2xl overflow-hidden border border-border bg-muted flex items-center justify-center w-full aspect-[16/9]">
                <img 
                  src={imageUrl} 
                  alt="Uploaded Banner Preview" 
                  className="w-full h-full object-cover object-center animate-in fade-in duration-300"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <p className="text-xs font-bold text-white">이미지 정상 수신됨</p>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-[16/9] border-2 border-dashed border-border hover:border-orange-400 hover:bg-orange-500/[0.02] dark:hover:bg-orange-500/[0.01] rounded-2xl cursor-pointer group transition-all duration-300 select-none">
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="text-xs font-extrabold text-foreground/80 mt-1">업로드 중 ({uploadProgress}%)</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">배너 이미지 등록</p>
                      <p className="text-xs text-muted-foreground">클릭하여 이미지 파일을 업로드하세요.</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="hidden" 
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* 2. Split Form and Billing details in 2 columns (3:2 ratio) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          
          {/* Main Apply Form Card (3/5 Columns) */}
          <div className="lg:col-span-3">
            <Card className="rounded-3xl border-border/60 shadow-lg bg-background/90 backdrop-blur-sm relative overflow-hidden h-full">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500" />
              
              <CardHeader className="space-y-1.5 pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">광고 기본 정보</CardTitle>
                <CardDescription>메인 화면 배너 슬라이더에 등록될 정보를 상세하게 작성해주세요.</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-5">
                {/* 1. Advertiser Name */}
                <div className="space-y-2">
                  <Label htmlFor="advertiserName" className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> 광고주 이름 / 회사명 <span className="text-destructive font-black">*</span>
                  </Label>
                  <Input 
                    id="advertiserName"
                    value={advertiserName}
                    onChange={(e) => setAdvertiserName(e.target.value)}
                    placeholder="광고주명 혹은 공식 단체명을 적어주세요."
                    className="rounded-xl h-11 border-border/80 focus:border-orange-500/50"
                  />
                </div>

                {/* 2. Contact Info */}
                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5 text-muted-foreground" /> 연락처 (이메일 또는 전화번호) <span className="text-destructive font-black">*</span>
                  </Label>
                  <Input 
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="담당자 연락처 또는 이메일을 작성해주세요."
                    className="rounded-xl h-11 border-border/80 focus:border-orange-500/50"
                  />
                </div>

                {/* 3. Link URL */}
                <div className="space-y-2">
                  <Label htmlFor="linkUrl" className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> 링크 랜딩 URL (선택)
                  </Label>
                  <Input 
                    id="linkUrl"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="클릭 시 연결될 홈페이지, 유튜브, 행사 URL을 적어주세요."
                    className="rounded-xl h-11 border-border/80 focus:border-orange-500/50"
                  />
                </div>

                {/* 4. Date Range selection */}
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> 노출 시작일 <span className="text-destructive font-black">*</span>
                    </Label>
                    <AdDateInputTriple
                      year={startYear}
                      month={startMonth}
                      day={startDay}
                      onYearChange={setStartYear}
                      onMonthChange={setStartMonth}
                      onDayChange={setStartDay}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> 노출 종료일 <span className="text-destructive font-black">*</span>
                    </Label>
                    <AdDateInputTriple
                      year={endYear}
                      month={endMonth}
                      day={endDay}
                      onYearChange={setEndYear}
                      onMonthChange={setEndMonth}
                      onDayChange={setEndDay}
                    />
                  </div>

                  {/* Slot availability check states */}
                  {isValidatingSlots && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse mt-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>광고 슬롯 확인 중...</span>
                    </div>
                  )}

                  {!isValidatingSlots && fullyBookedDates.length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl space-y-1 mt-2 animate-in fade-in duration-200">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">{fullyBookedDates.join(", ")}</span>는 광고 예약이 다 차있어 신청이 불가합니다.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advertisement Billing Details (2/5 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-3xl border-border/60 shadow-lg bg-background/90 backdrop-blur-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">광고 결제 상세</CardTitle>
                <CardDescription>기간에 따른 광고 이용 가격 영수증입니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5 text-sm font-semibold">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>1일 광고 게재 단가</span>
                    <span className="text-foreground">{dailyPrice.toLocaleString()} 원</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>광고 게재 기간</span>
                    <span className="text-foreground font-bold">
                      {isDateValid ? `${durationDays} 일간` : "시작/종료일 선택 필요"}
                    </span>
                  </div>
                  <div className="h-px bg-border/60 my-2" />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-extrabold text-foreground">총 신청 금액</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {totalAmount.toLocaleString()} 원
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button 
                  onClick={handlePayment}
                  disabled={
                    isSubmitting || 
                    isUploading || 
                    isValidatingSlots || 
                    fullyBookedDates.length > 0 || 
                    !advertiserName.trim() || 
                    !contact.trim() || 
                    !imageUrl || 
                    !isDateValid
                  }
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-white/90 font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 group text-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      결제 프로세스 활성화 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                      토스페이먼츠 안전 결제하기
                    </>
                  )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
