"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const SUPABASE_PUBLIC_PREFIX =
  (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "") +
  "/storage/v1/object/public/";

/** Supabase 공개 스토리지 URL만 next/image 최적화 대상으로 판단 */
function isOptimizable(src?: string | null): src is string {
  return (
    !!src &&
    SUPABASE_PUBLIC_PREFIX.length > "/storage/v1/object/public/".length &&
    src.startsWith(SUPABASE_PUBLIC_PREFIX)
  );
}

interface CoverImageProps {
  src?: string | null;
  alt: string;
  /** 래퍼 div에 적용 (크기/모양). 부모 안에서 채우려면 보통 "w-full h-full" */
  className?: string;
  /** <img>/Image 자체에 적용 (object-position 등). object-cover는 기본 포함 */
  imgClassName?: string;
  /** 반응형 srcset 선택용. 렌더 크기를 알려줄수록 과다 다운로드가 줄어든다. */
  sizes?: string;
  /** 뷰포트 상단에 바로 보이는 이미지면 true (LCP 최적화) */
  preload?: boolean;
  onClick?: React.MouseEventHandler;
}

/**
 * object-cover로 부모를 채우는 이미지를 위한 래퍼.
 * - Supabase 공개 URL: next/image(fill)로 최적화 → WebP·리사이즈·Vercel 캐시
 * - 그 외(외부 호스트/빈 값 방어): 일반 <img> 폴백
 * 자체적으로 `relative`인 래퍼 div를 두어 부모가 positioned가 아니어도 안전하다.
 */
export function CoverImage({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(max-width: 640px) 100vw, 500px",
  preload,
  onClick,
}: CoverImageProps) {
  const wrapper = cn("relative overflow-hidden", className);

  if (!isOptimizable(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <div className={wrapper} onClick={onClick}>
        <img
          src={src || undefined}
          alt={alt}
          className={cn("absolute inset-0 w-full h-full object-cover", imgClassName)}
          loading={preload ? "eager" : "lazy"}
        />
      </div>
    );
  }

  return (
    <div className={wrapper} onClick={onClick}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn("object-cover", imgClassName)}
        preload={preload}
      />
    </div>
  );
}
