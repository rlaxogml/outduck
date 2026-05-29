"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Calendar, Edit, ExternalLink, RefreshCw, X, CheckCircle, UploadCloud, Trash2, Clock } from "lucide-react";

export function AdManager({ userId, onBack, onExtendAd }: { userId: string; onBack: () => void, onExtendAd?: (ad: any) => void }) {
  const [ads, setAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAd, setEditingAd] = useState<any>(null);

  // Edit form state
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAds = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("posters")
      .select("*")
      .eq("user_id", userId)
      .order("order", { ascending: false });
    
    if (error) {
      console.error(error);
      toast.error("광고 목록을 불러오지 못했습니다.");
    } else {
      setAds(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAds();
  }, [userId]);

  const handleEditClick = (ad: any) => {
    setEditingAd(ad);
    setImageUrl(ad.image_url || "");
    setLinkUrl(ad.link_url || "");
    setAdvertiserName(ad.advertiser_name || "");
  };

  const handleCancelEdit = () => {
    setEditingAd(null);
  };

  const handleDeleteAd = async (adId: string) => {
    if (!window.confirm("이 광고 내역을 완전히 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")) {
      return;
    }
    const { error } = await supabase.from("posters").delete().eq("id", adId);
    if (error) {
      toast.error("광고 삭제에 실패했습니다.");
    } else {
      toast.success("광고가 삭제되었습니다.");
      fetchAds();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("5MB 이하의 이미지만 업로드 가능합니다.");
      return;
    }

    setIsUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `posters/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("ad_posters")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("ad_posters")
        .getPublicUrl(filePath);

      setImageUrl(publicUrlData.publicUrl);
      toast.success("이미지가 업로드되었습니다.");
    } catch (error) {
      console.error(error);
      toast.error("업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!imageUrl) {
      toast.error("배너 이미지를 등록해주세요.");
      return;
    }
    if (!advertiserName.trim()) {
      toast.error("광고주 이름을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("posters")
      .update({
        image_url: imageUrl,
        link_url: linkUrl,
        advertiser_name: advertiserName,
      })
      .eq("id", editingAd.id);

    setIsSaving(false);

    if (error) {
      console.error(error);
      toast.error("수정에 실패했습니다.");
    } else {
      toast.success("광고 정보가 수정되었습니다.");
      setEditingAd(null);
      fetchAds();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto pt-10">
        <Button variant="ghost" onClick={onBack} className="-ml-4 mb-4 text-muted-foreground hover:text-foreground">
          ← 이전 화면으로
        </Button>
        <div className="text-center space-y-4 py-20 border border-dashed border-border rounded-3xl bg-background/50">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto opacity-50" />
          <h2 className="text-xl font-bold">내 광고 데이터를 불러오는 중...</h2>
          <p className="text-muted-foreground text-sm">잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (editingAd) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto pt-10">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={handleCancelEdit} className="-ml-4 text-muted-foreground hover:text-foreground">
            ← 목록으로 돌아가기
          </Button>
        </div>

        <Card className="rounded-3xl border-border/60 shadow-lg bg-background/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">광고 정보 수정</CardTitle>
            <CardDescription>
              배너 이미지, 링크 URL, 그리고 광고주 이름을 수정할 수 있습니다. 노출 기간은 수정할 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-extrabold flex items-center gap-1">배너 이미지 <span className="text-destructive">*</span></Label>
              <div className="text-xs text-orange-500 bg-orange-500/10 p-2 rounded-md font-semibold mb-2 inline-block border border-orange-500/20">
                권장 규격: 21:9 비율, 5MB 이하
              </div>
              {imageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border border-border bg-muted flex items-center justify-center w-full aspect-[21/9]">
                  <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                    <UploadCloud className="w-8 h-8 text-white mb-2" />
                    <p className="text-sm font-bold text-white">클릭하여 이미지 변경</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} className="hidden" />
                  </label>
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-[21/9] border-2 border-dashed border-border hover:border-orange-400 rounded-2xl cursor-pointer">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-bold">이미지 업로드</p>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileChange} disabled={isUploading} className="hidden" />
                </label>
              )}
            </div>

            {/* Advertiser Name */}
            <div className="space-y-2">
              <Label htmlFor="advertiser" className="text-sm font-extrabold flex items-center gap-1">광고주 이름 <span className="text-destructive">*</span></Label>
              <Input 
                id="advertiser"
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="광고주명 입력"
                className="rounded-xl"
              />
            </div>

            {/* Link URL */}
            <div className="space-y-2">
              <Label htmlFor="link" className="text-sm font-extrabold flex items-center gap-1">링크 랜딩 URL</Label>
              <Input 
                id="link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="rounded-xl"
              />
            </div>

          </CardContent>
          <CardFooter className="bg-muted/50 p-6 flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving} className="rounded-xl">취소</Button>
            <Button onClick={handleSave} disabled={isSaving || isUploading} className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              수정 완료
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto pt-10">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={onBack} className="-ml-4 text-muted-foreground hover:text-foreground">
          ← 이전 화면으로
        </Button>
        <Button variant="outline" size="sm" onClick={fetchAds} className="rounded-xl flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 새로고침
        </Button>
      </div>

      <div className="space-y-2 text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">내 광고 관리</h1>
        <p className="text-muted-foreground">결제하신 광고의 노출 상태를 확인하고 정보를 수정할 수 있습니다.</p>
      </div>

      {ads.length === 0 ? (
        <div className="text-center space-y-4 py-20 border border-dashed border-border rounded-3xl bg-background/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">등록된 광고가 없습니다</h2>
          <p className="text-muted-foreground text-sm">신규 광고 신청을 통해 배너를 등록해 보세요.</p>
          <Button onClick={onBack} className="mt-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white">
            신규 광고 신청하러 가기
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {ads.map((ad) => {
            const isExpired = ad.end_date ? new Date(ad.end_date) < new Date() : false;
            
            return (
              <Card key={ad.id} className={`rounded-3xl border-border shadow-sm overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md ${isExpired ? 'opacity-70 saturate-50' : ''}`}>
                <div className="w-full md:w-1/3 aspect-[21/9] md:aspect-auto md:h-full bg-muted shrink-0 border-b md:border-b-0 md:border-r border-border">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted">
                      <ImageIcon className="w-8 h-8 opacity-20" />
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col justify-center flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold line-clamp-1">{ad.title || ad.advertiser_name}</h3>
                    <div className="flex gap-2">
                      {ad.force_hide ? (
                        <span className="px-2.5 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-full">노출 차단됨</span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-1 bg-zinc-500/10 text-zinc-500 text-xs font-bold rounded-full border border-zinc-200 dark:border-zinc-800">기간 만료됨</span>
                      ) : ad.is_active ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-bold rounded-full">실시간 노출 중</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 text-xs font-bold rounded-full">자동 상태 (기간 대기)</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mb-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>{ad.start_date} ~ {ad.end_date}</span>
                    </div>
                    {ad.link_url && (
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 shrink-0" />
                        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline line-clamp-1">
                          {ad.link_url}
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-auto flex justify-end gap-2">
                    {isExpired ? (
                      <>
                        <Button onClick={() => handleDeleteAd(ad.id)} variant="outline" className="rounded-xl flex items-center gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                          <Trash2 className="w-4 h-4" /> 내역 삭제
                        </Button>
                        <Button onClick={() => onExtendAd && onExtendAd(ad)} className="rounded-xl flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                          <Clock className="w-4 h-4" /> 기간 연장 신청
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleEditClick(ad)} variant="outline" className="rounded-xl flex items-center gap-2 border-border/80 hover:bg-muted">
                        <Edit className="w-4 h-4" /> 정보 수정
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
