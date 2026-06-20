"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Textarea } from "@/components/ui/textarea";
import { notifyAdminsNewEventProposal } from "@/app/actions/email";


interface EventProposalFormProps {
  user: User;
  onSuccess: () => void;
}

export function EventProposalForm({ user, onSuccess }: EventProposalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventType, setEventType] = useState<"offline" | "online">("offline");
  const [title, setTitle] = useState("");

  const defaultTemplate = 
    `(다음과 같은 정보들을 기입해주세요)\n\n` +
    `주최 ip (게임 이름, 유튜버 이름 등): \n\n` +
    `유형: (게임,유튜버 등)\n\n` +
    `날짜: \n\n` +
    `장소: \n\n` +
    `정보 확인가능한 링크: `;

  const [description, setDescription] = useState(defaultTemplate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("행사 제목을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const eventProposalData = {
        user_id: user.id,
        status: "pending",
        is_offline: eventType === "offline",
        is_online: eventType === "online",
        title: title.trim(),
        description: description || null,
        image_url: null,
        links: null,
        channel_proposal_id: null,
        channel_ids: null,
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        reservation_type: null,
        is_reservation_always: false,
        reservation_starts_at: null,
        reservation_ends_at: null,
        locations: null,
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
        <div className="space-y-3">
          <Label htmlFor="event-title" className="text-sm font-semibold">행사 제목 <span className="text-destructive">*</span></Label>
          <Input
            id="event-title"
            placeholder="제보할 행사 이름을 입력해 주세요"
            className="h-12 bg-muted/30 border-border/50 rounded-xl focus:ring-primary/20"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
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
            disabled={isSubmitting}
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
