"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, KeyRound, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Supported channel types for company affiliation.
// Easily extensible in the future (e.g. adding 'game', 'festival', etc.)
export const SUPPORTED_AFFILIATION_TYPES = ["youtuber"];

export function isAffiliationSupported(type: string | null): boolean {
  if (!type) return false;
  return SUPPORTED_AFFILIATION_TYPES.includes(type.trim().toLowerCase());
}

interface CompanyAffiliationProps {
  channelId: number;
  channelType: string | null;
  onSuccess: () => void;
  className?: string;
}

export function CompanyAffiliation({
  channelId,
  channelType,
  onSuccess,
  className,
}: CompanyAffiliationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // If the channel type is not supported, do not render this feature
  if (!isAffiliationSupported(channelType)) {
    return null;
  }

  const handleAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = inviteCode.trim();
    if (!code) {
      toast.error("회사 코드를 입력해주세요.");
      return;
    }

    setIsValidating(true);
    try {
      // 1. Verify the invite code in companies table
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, name, invite_code, is_auto_approved")
        .eq("invite_code", code.toUpperCase())
        .maybeSingle();

      if (companyError) throw companyError;

      if (!companyData) {
        toast.error("유효하지 않은 회사 코드입니다. 다시 확인해 주세요.");
        setIsValidating(false);
        return;
      }

      if (!companyData.is_auto_approved) {
        toast.error("해당 소속사는 현재 자동 가입을 지원하지 않습니다. (수동 승인 기능 준비 중)");
        setIsValidating(false);
        return;
      }

      // 2. Update the channel's company field
      const { error: updateError } = await supabase
        .from("channels")
        .update({
          company: companyData.name,
        })
        .eq("id", channelId);

      if (updateError) throw updateError;

      toast.success(`${companyData.name} 회사로의 편입이 성공적으로 완료되었습니다!`);
      setIsExpanded(false);
      setInviteCode("");
      onSuccess();
    } catch (err: any) {
      console.error("Company affiliation error:", err);
      toast.error("회사 편입 중 오류가 발생했습니다: " + (err.message || "다시 시도해 주세요."));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className={cn("space-y-3 mt-1", className)}>
      {!isExpanded ? (
        <Button
          type="button"
          onClick={() => setIsExpanded(true)}
          variant="outline"
          size="sm"
          className="h-8 px-3 rounded-lg text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.98] transition-all flex items-center gap-1 cursor-pointer"
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span>회사 편입</span>
        </Button>
      ) : (
        <form
          onSubmit={handleAffiliate}
          className="border border-primary/20 bg-primary/[0.02] rounded-xl p-3.5 space-y-3.5 animate-in slide-in-from-top-2 duration-200 w-full max-w-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1 select-none">
              <KeyRound className="w-3.5 h-3.5 text-primary shrink-0" />
              회사 코드 입력
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsExpanded(false);
                setInviteCode("");
              }}
              className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="회사 코드를 입력하세요"
              disabled={isValidating}
              className="h-9 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-background uppercase font-mono tracking-widest placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus-visible:ring-primary/20"
              required
            />
            <Button
              type="submit"
              size="sm"
              disabled={isValidating || !inviteCode.trim()}
              className="h-9 px-4 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 active:scale-[0.98] shrink-0 cursor-pointer"
            >
              {isValidating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "확인"
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-normal select-none">
            * 회사 관리자에게 전달받은 8자리 코드를 입력해 주세요. 인증이 완료되면 소속사에 채널이 편입됩니다.
          </p>
        </form>
      )}
    </div>
  );
}
