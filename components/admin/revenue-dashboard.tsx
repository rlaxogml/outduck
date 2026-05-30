"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, DollarSign, TrendingUp, Calendar, ArrowDownCircle, Settings } from "lucide-react";

type PaymentRecord = {
  id: string;
  order_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

export function RevenueDashboard() {
  const [dailyPrice, setDailyPrice] = useState("");
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDesc, setRefundDesc] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  useEffect(() => {
    fetchDailyPrice();
    fetchPayments();
  }, []);

  const fetchDailyPrice = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'banner_daily_price')
        .single();
      if (!error && data) {
        setDailyPrice(data.value);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async () => {
    try {
      setIsLoadingStats(true);
      const { data, error } = await supabase
        .from('ad_payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setPayments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!dailyPrice) return;
    setIsUpdatingPrice(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .update({ value: dailyPrice, updated_at: new Date().toISOString() })
        .eq('key', 'banner_daily_price');
        
      if (error) throw error;
      toast.success("광고 1일 단가가 성공적으로 업데이트되었습니다.");
    } catch (err: any) {
      toast.error("업데이트 실패: " + err.message);
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleManualRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundAmount || !refundDesc) return;
    
    setIsRefunding(true);
    try {
      const amount = parseInt(refundAmount.replace(/,/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        toast.error("올바른 금액을 입력해주세요.");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase
        .from('ad_payments')
        .insert([{
          amount: -amount,
          type: 'refund',
          description: `[수동환불] ${refundDesc}`,
          user_id: session?.user?.id
        }]);

      if (error) throw error;
      
      toast.success("수동 환불 처리가 완료되었습니다.");
      setRefundAmount("");
      setRefundDesc("");
      fetchPayments();
    } catch (err: any) {
      toast.error("환불 처리 실패: " + err.message);
    } finally {
      setIsRefunding(false);
    }
  };

  // Calculate stats
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); 
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  let revToday = 0;
  let revWeek = 0;
  let revMonth = 0;
  let revYear = 0;
  let revTotal = 0;

  payments.forEach(p => {
    const d = new Date(p.created_at);
    const amt = p.amount;
    
    revTotal += amt;
    if (d >= today) revToday += amt;
    if (d >= startOfWeek) revWeek += amt;
    if (d >= startOfMonth) revMonth += amt;
    if (d >= startOfYear) revYear += amt;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">오늘 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revToday.toLocaleString()}원</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">이번 주 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revWeek.toLocaleString()}원</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revMonth.toLocaleString()}원</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">누적 총 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{revTotal.toLocaleString()}원</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5"/>단가 설정</CardTitle>
            <CardDescription>배너 광고의 1일 단가를 수정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>1일 광고 단가 (원)</Label>
              <Input 
                type="number" 
                value={dailyPrice} 
                onChange={e => setDailyPrice(e.target.value)} 
              />
            </div>
            <Button onClick={handleUpdatePrice} disabled={isUpdatingPrice} className="w-full">
              {isUpdatingPrice && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              업데이트
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-destructive"/>수동 환불 처리</CardTitle>
            <CardDescription>시스템 오류나 수동 취소로 인한 마이너스 수익을 기록합니다.</CardDescription>
          </CardHeader>
          <form onSubmit={handleManualRefund}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>환불 금액 (원)</Label>
                  <Input 
                    type="number" 
                    placeholder="예: 30000" 
                    value={refundAmount} 
                    onChange={e => setRefundAmount(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>환불 사유</Label>
                  <Input 
                    placeholder="예: 고객 변심" 
                    value={refundDesc} 
                    onChange={e => setRefundDesc(e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="destructive" disabled={isRefunding || !refundAmount || !refundDesc}>
                {isRefunding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                환불 반영하기
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">최근 거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : payments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">결제 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {payments.slice(0, 20).map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 rounded-lg border bg-card text-card-foreground">
                  <div>
                    <p className="font-semibold">{p.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                  <div className={`font-bold ${p.amount < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
