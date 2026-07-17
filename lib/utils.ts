import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(value: string): string {
  const clean = value.replace(/[^0-9]/g, "");
  
  // Handle Seoul area code (02)
  if (clean.startsWith("02")) {
    if (clean.length < 3) return clean;
    if (clean.length < 6) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    if (clean.length < 10) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
  }
  
  // Handle standard prefixes (010, 031, 070, etc.)
  if (clean.length < 4) return clean;
  if (clean.length < 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  if (clean.length < 11) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

const SUPABASE_PUBLIC_PREFIX =
  (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "") +
  "/storage/v1/object/public/";

/**
 * 설명·공지 본문 HTML(dangerouslySetInnerHTML) 속 <img>의 Supabase 원본 URL을
 * next/image 최적화 경로(/_next/image)로 치환한다.
 * → 브라우저가 Vercel에서 리사이즈·WebP를 받고, Supabase는 원본을 (캐시 기간당) 1회만 서빙
 *   → 조회수와 무관하게 캐시 이그레스가 급감.
 * 외부 호스트 URL(cafe24 등)·이미 최적화된 src는 그대로 둔다(멱등).
 */
export function optimizeHtmlImages(
  htmlString: string | null | undefined,
  width = 1080,
  quality = 75
): string {
  if (!htmlString) return "";
  // 환경변수 없으면 원본 유지
  if (SUPABASE_PUBLIC_PREFIX.length <= "/storage/v1/object/public/".length) {
    return htmlString;
  }
  return htmlString.replace(
    /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi,
    (full, pre: string, quote: string, src: string) => {
      if (!src.startsWith(SUPABASE_PUBLIC_PREFIX)) return full;
      const optimized = `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
      return `${pre}${quote}${optimized}${quote}`;
    }
  );
}

export function linkifyHtml(htmlString: string | null | undefined): string {
  if (!htmlString) return "";
  
  // Split the HTML by tags to avoid matching URLs inside tag attributes (like src, href)
  const parts = htmlString.split(/(<[^>]+>)/g);
  
  let inAnchor = false;
  // Regex to match URLs starting with http://, https://, or www.
  // It stops before whitespace, angle brackets, or trailing punctuation (. , : ; ! ? ' " ) ] })
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\}\s])/gi;
  
  const result = parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      const tagName = part.match(/^<\/?([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
      if (tagName === 'a') {
        if (part.startsWith('</')) {
          inAnchor = false;
        } else {
          inAnchor = true;
        }
      }
      return part;
    } else {
      if (inAnchor) {
        return part;
      }
      
      return part.replace(urlRegex, (match) => {
        let href = match;
        if (!/^https?:\/\//i.test(match)) {
          href = `https://${match}`;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline break-all">${match}</a>`;
      });
    }
  });
  
  return result.join('');
}

