"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Textarea } from "@/components/ui/textarea";
import { notifyAdminsNewEventProposal } from "@/app/actions/email";


interface EventProposalFormProps {
  user: User | null;
  onSuccess: () => void;
}

export function EventProposalForm({ user, onSuccess }: EventProposalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventType, setEventType] = useState<"offline" | "online">("offline");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [isAlways, setIsAlways] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const defaultTemplate =
    `(다음과 같은 정보들을 기입해주세요)\n\n` +
    `주최 채널: \n\n` +
    `간단한 소개: \n\n` +
    `정보 확인가능한 링크: `;

  const [description, setDescription] = useState(defaultTemplate);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `event-main-image/${fileName}`;
      const { error } = await supabase.storage.from("event_images").upload(filePath, compressed);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("event_images").getPublicUrl(filePath);
      setImageUrl(publicUrl);
      toast.success("배너 이미지가 첨부되었습니다.");
    } catch (err: any) {
      toast.error("이미지 업로드에 실패했습니다: " + (err.message || "다시 시도해주세요."));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("행사 제목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isOffline = eventType === "offline";
      const eventProposalData = {
        user_id: user?.id ?? null,
        status: "pending",
        is_offline: isOffline,
        is_online: !isOffline,
        title: title.trim(),
        description: description || null,
        image_url: imageUrl,
        links: null,
        channel_proposal_id: null,
        channel_ids: null,
        start_date: isOffline && !isAlways && startDate ? startDate : null,
        end_date: isOffline && !isAlways && endDate ? endDate : null,
        start_time: null,
        end_time: null,
        reservation_type: null,
        is_reservation_always: false,
        reservation_starts_at: null,
        reservation_ends_at: null,
        locations: isOffline && location.trim() ? [location.trim()] : null,
        schedules: null,
        support_images: null,
        online_start_at: null,
        online_end_at: null,
      };

      const { error: eventProposalErr } = await supabase
        .from("event_proposals")
        .insert([eventProposalData]);

      if (eventProposalErr) throw eventProposalErr;

      // Trigger admin email notification in the background
      notifyAdminsNewEventProposal({
        title: title.trim(),
        is_online: eventType === "online",
        is_offline: eventType === "offline",
        description: description || null,
      }).catch((err) => {
        console.error("Failed to send admin notification email:", err);
      });

      toast.success("행사 제보가 성공적으로 등록되었습니다!");
      onSuccess();
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error("행사 제보 과정에서 오류가 발생했습니다: " + (err.message || "다시 시도해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-transparent sm:bg-background border-0 sm:border border-border rounded-none sm:rounded-3xl p-0 sm:p-10 shadow-none sm:shadow-xl animate-in fade-in duration-300">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">행사 제보서</h2>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Event Type (Offline / Online) */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">행사 유형 <span className="text-destructive">*</span></Label>
          <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/50 max-w-xs">
            <button
              type="button"
              onClick={() => setEventType("offline")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${eventType === "offline"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              오프라인
            </button>
            <button
              type="button"
              onClick={() => setEventType("online")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${eventType === "online"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              온라인
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3">
          <Label htmlFor="event-title" className="w-20 shrink-0 text-sm font-semibold">행사 제목 <span className="text-destructive">*</span></Label>
          <Input
            id="event-title"
            placeholder="행사 이름"
            className="h-12 flex-1 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Date (offline) */}
        {eventType === "offline" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">행사 날짜 <span className="text-xs font-normal text-muted-foreground">(선택)</span></Label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAlways}
                  onChange={(e) => setIsAlways(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-muted-foreground">상시</span>
              </label>
            </div>
            {!isAlways && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">시작일</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">종료일</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location (offline) */}
        {eventType === "offline" && (
          <div className="flex items-center gap-3">
            <Label htmlFor="event-location" className="w-20 shrink-0 text-sm font-semibold">장소</Label>
            <Input
              id="event-location"
              placeholder="예: 더현대 서울 B1F (선택)"
              className="h-12 flex-1 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        )}

        {/* Banner image (optional) */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">배너 이미지 <span className="text-xs font-normal text-muted-foreground">(선택)</span></Label>
          <p className="text-xs text-muted-foreground">행사 포스터/배너가 있으면 첨부해 주세요. 등록에 큰 도움이 돼요!</p>
          {imageUrl ? (
            <div className="relative aspect-video max-w-sm rounded-2xl overflow-hidden border border-border">
              <img src={imageUrl} alt="배너 미리보기" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center aspect-video max-w-sm rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
              {isUploadingImage ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium text-muted-foreground">이미지 업로드 (16:9 추천)</span>
                </>
              )}
              <input type="file" className="hidden" accept="image/*" onChange={handleBannerUpload} disabled={isUploadingImage} />
            </label>
          )}
        </div>

        {/* Description */}
        <div className="space-y-3">
          <Label htmlFor="event-description" className="text-sm font-semibold">설명</Label>
          <Textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="행사에 대한 상세한 설명 또는 홍보 문구를 입력해 주세요"
            className="min-h-[250px] bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20 p-4"
          />
        </div>

        {/* Submit button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            disabled={isSubmitting || isUploadingImage}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 제보 등록 중...</>
            ) : (
              "행사 제보 완료하기"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
