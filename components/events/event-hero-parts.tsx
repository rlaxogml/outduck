"use client";

import { useEffect, type ReactNode } from "react";
import { CoverImage } from "@/components/ui/cover-image";
import { Heart, ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 오프라인/온라인 행사 상세 페이지가 공유하는 히어로(상단) UI 조각 모음.
 *
 * 두 상세 페이지는 데이터 모델만 다를 뿐 상단 헤더(프로필·이름·제목·액션 버튼)와
 * 이미지 라이트박스는 사실상 동일하다. 예전에는 이 부분이 양쪽에 복붙돼 있어서
 * 한쪽만 수정하면 레이아웃이 어긋나는 버그가 반복됐다. 여기로 단일화해 그 문제를 없앤다.
 */

export type HeroChannel = { id: number; name: string; image_url: string };

/** 좌상단 플로팅 뒤로가기 버튼 */
export function HeroBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute left-6 md:-left-24 top-2 md:top-8 z-40 flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-full border border-border/60 bg-white/90 dark:bg-muted/90 text-foreground shadow-md backdrop-blur-sm hover:scale-105 active:scale-95 transition-all"
      aria-label="뒤로가기"
    >
      <ChevronLeft className="w-5 h-5 md:w-8 md:h-8 stroke-[2.5]" />
    </button>
  );
}

/**
 * 프로필 아바타(들) + 채널 이름.
 * 데스크톱: 아바타 오른쪽에 이름. 모바일: 이름 숨김(각 페이지가 제목 근처에 따로 표시).
 * avatarClassName / className으로 크기·여백만 페이지별로 조정한다.
 */
export function HeroProfileName({
  channels,
  onChannelClick,
  className,
  avatarClassName,
}: {
  channels: HeroChannel[];
  onChannelClick: (channelId: number) => void;
  className?: string;
  avatarClassName?: string;
}) {
  if (channels.length === 0) return null;

  return (
    <div className={cn("relative -mt-8 md:mt-0 z-20 flex items-center gap-3", className)}>
      <div className="flex items-center -space-x-3">
        {channels.map((channel, i) => (
          <div
            key={channel.id}
            className="transition-transform hover:scale-105 hover:z-30 cursor-pointer relative"
            style={{ zIndex: 20 - i }}
            onClick={() => onChannelClick(channel.id)}
          >
            <div
              className={cn(
                "rounded-full border-4 md:border-2 border-background shadow-md overflow-hidden bg-muted flex items-center justify-center",
                avatarClassName
              )}
            >
              {channel.image_url ? (
                <CoverImage src={channel.image_url} alt={channel.name} className="w-full h-full" sizes="80px" />
              ) : (
                <span className="text-lg md:text-base font-bold text-muted-foreground">{channel.name.charAt(0)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:flex flex-col pt-1 md:pt-0">
        <span className="text-[15px] md:text-base font-semibold text-muted-foreground">
          {channels.map((c) => c.name).join(", ")}
        </span>
      </div>
    </div>
  );
}

/** 주최자용 행사 수정 / 삭제 버튼 행 */
export function OwnerActionRow({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 mt-4 md:mt-6">
      <button
        onClick={onEdit}
        className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/80 transition-colors"
      >
        행사 수정
      </button>
      <button
        onClick={onDelete}
        className="flex-1 py-2 bg-destructive/10 text-destructive text-sm font-semibold rounded-xl hover:bg-destructive/20 transition-colors"
      >
        행사 삭제
      </button>
    </div>
  );
}

function ShareGlyph({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
      <polyline points="16 6 12 2 8 6"></polyline>
      <line x1="12" y1="2" x2="12" y2="15"></line>
    </svg>
  );
}

/** 모바일 전용 컴팩트 관심/공유 아이콘 (위치 지정 래퍼는 각 페이지가 담당) */
export function HeroMobileIcons({
  isBookmarked,
  onBookmark,
  onShare,
}: {
  isBookmarked: boolean;
  onBookmark: () => void;
  onShare: () => void;
}) {
  return (
    <>
      <button
        onClick={onBookmark}
        className={cn(
          "p-1.5 transition-all active:scale-95 duration-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800",
          isBookmarked ? "text-pink-500" : "text-[#6a83a8] dark:text-[#8ba3c7]"
        )}
        aria-label="관심 저장"
      >
        <Heart
          className={cn(
            "w-[24px] h-[24px] transition-all",
            isBookmarked ? "fill-pink-500 stroke-pink-500" : "stroke-current"
          )}
        />
      </button>
      <button
        onClick={onShare}
        className="p-1.5 text-[#6a83a8] dark:text-[#8ba3c7] hover:text-foreground transition-all active:scale-95 duration-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="공유"
      >
        <ShareGlyph className="w-[24px] h-[24px]" strokeWidth={2.5} />
      </button>
    </>
  );
}

/** 히어로 데스크톱 액션 버튼의 아웃라인 스타일 공통 버튼 (위치보기 / 이동하기 / 공유) */
export function HeroOutlineButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-row justify-center gap-2 px-4 py-3 rounded-xl border border-[#4f6b94]/30 dark:border-[#627fa6]/30 bg-background hover:bg-[#4f6b94]/10 dark:hover:bg-[#627fa6]/10 text-[#3a5378] dark:text-[#a0b8d6] text-sm font-semibold shadow-sm transition-colors"
    >
      <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

/**
 * 데스크톱 전용 액션 버튼 행: [저장] [가운데 버튼(children)] [공유]
 * children에 위치보기(오프라인) 또는 이동하기(온라인) 버튼을 넣는다.
 */
export function HeroDesktopActions({
  isBookmarked,
  onBookmark,
  onShare,
  children,
}: {
  isBookmarked: boolean;
  onBookmark: () => void;
  onShare: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="hidden md:flex justify-start gap-3 items-center mt-8 pt-0 border-t-0 border-border/40">
      <button
        onClick={onBookmark}
        className={cn(
          "flex flex-row justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold shadow-sm transition-colors",
          isBookmarked
            ? "text-pink-500 bg-pink-500 text-white border-pink-500 hover:bg-pink-600"
            : "text-[#3a5378] dark:text-[#a0b8d6] bg-background border-[#4f6b94]/30 dark:border-[#627fa6]/30 hover:bg-[#4f6b94]/10 dark:hover:bg-[#627fa6]/10"
        )}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <Heart className={cn("w-4 h-4", isBookmarked ? "fill-white" : "")} />
        </div>
        <span className="text-sm font-semibold">{isBookmarked ? "관심저장" : "저장"}</span>
      </button>

      {children}

      <HeroOutlineButton onClick={onShare} icon={<ShareGlyph className="w-4 h-4" />} label="공유" />
    </div>
  );
}

/** 이미지 확대 라이트박스 (ESC/배경 클릭으로 닫힘) */
export function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 md:top-8 md:right-8 text-white/70 hover:text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-8 h-8" />
      </button>
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={src}
          alt="확대 이미지"
          className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
