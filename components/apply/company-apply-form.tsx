"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Building2,
  ArrowLeft
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { formatPhoneNumber } from "@/lib/utils";
import { useImageUpload } from "@/hooks/use-image-upload";

interface CompanyApplyFormProps {
  user: User;
  onBack: () => void;
  onSuccess: () => void;
}

export function CompanyApplyForm({ user, onBack, onSuccess }: CompanyApplyFormProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    imageUrl,
    imagePath,
    isUploading,
    handleImageUpload,
  } = useImageUpload({
    bucket: "event_images",
    folderPath: "channel-requests",
    prefix: "request-",
    successMessage: "프로필 이미지가 업로드되었습니다.",
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("회사명을 입력해주세요.");
      return;
    }
    if (!contact.trim()) {
      toast.error("연락처를 입력해주세요.");
      return;
    }
    if (!businessNumber.trim()) {
      toast.error("사업자등록번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const insertData = {
        user_id: user.id,
        name: name.trim(),
        image_url: imageUrl,
        contact: contact.trim(),
        business_number: businessNumber.trim(),
        request_type: "company",
        status: "pending",
      };

      const { error } = await supabase
        .from("channel_requests")
        .insert([insertData]);

      if (error) throw error;

      toast.success("신청이 성공적으로 접수되었습니다.");
      onSuccess();
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error("신청 과정에서 오류가 발생했습니다: " + (error.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onBack}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> 신청 유형 다시 선택
      </button>
      
      <div className="bg-background border border-border rounded-3xl p-6 sm:p-10 shadow-xl">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">관리자(회사) 신청서</h2>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Profile Image Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">회사 로고 / 프로필 이미지</Label>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-2xl overflow-hidden group border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground/40" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <input
                    type="file"
                    id="image-upload-admin"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <label htmlFor="image-upload-admin">
                    <Button type="button" variant="outline" className="cursor-pointer rounded-xl" asChild disabled={isUploading}>
                      <span>
                        <Upload className="w-4 h-4 mr-2" /> {imageUrl ? "이미지 변경" : "이미지 업로드"}
                      </span>
                    </Button>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">회사 공식 로고 또는 대표 이미지입니다.<br/>(정사각형 비율 권장)</p>
              </div>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="admin-name" className="text-base font-semibold">회사명 <span className="text-destructive">*</span></Label>
              <Input
                id="admin-name"
                placeholder="정식 회사명 또는 단체명을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact" className="text-base font-semibold">연락처 <span className="text-destructive">*</span></Label>
              <Input
                id="contact"
                placeholder="담당자 연락처 또는 회사 대표 번호"
                value={contact}
                onChange={(e) => setContact(formatPhoneNumber(e.target.value))}
                maxLength={13}
                className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessNumber" className="text-base font-semibold">사업자등록번호 <span className="text-destructive">*</span></Label>
              <Input
                id="businessNumber"
                placeholder="사업자등록번호(단체의 경우 고유번호 등)를 입력하세요"
                value={businessNumber}
                onChange={(e) => setBusinessNumber(e.target.value)}
                className="h-12 text-base rounded-xl bg-muted/30 border-border/50 focus:ring-primary/20"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold rounded-xl bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/20 text-white"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 처리 중...</>
              ) : (
                "관리자 신청 완료하기"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
