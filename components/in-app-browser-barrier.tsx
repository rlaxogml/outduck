"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function InAppBrowserBarrier() {
  const [isInApp, setIsInApp] = useState(false);
  const [isKakao, setIsKakao] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isKakaoTalk = userAgent.includes("kakaotalk");
    const isInstagram = userAgent.includes("instagram");
    const isFacebook = userAgent.includes("fb_iab") || userAgent.includes("fbios");
    const isLine = userAgent.includes("line");
    
    // 전체적인 인앱 브라우저 여부 감지
    const isInAppBrowser = isKakaoTalk || isInstagram || isFacebook || isLine || userAgent.includes("webview");
    
    const iOS = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;

    setIsInApp(isInAppBrowser);
    setIsKakao(isKakaoTalk);
    setIsIOS(iOS);

    if (isInAppBrowser) {
      const currentUrl = window.location.href;

      // 1. 카카오톡 인앱 브라우저의 경우 (스마트폰 기본 브라우저 강제 호출)
      if (isKakaoTalk) {
        window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
        return;
      }

      // 2. 안드로이드 기기의 기타 인앱 브라우저의 경우 (크롬 앱 강제 호출)
      if (!iOS && /android/.test(userAgent)) {
        const rawUrl = currentUrl.replace(/https?:\/\//i, "");
        window.location.href = `intent://${rawUrl}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }
    }
  }, []);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    toast.success("링크가 복사되었습니다! 외부 브라우저(사파리, 크롬)를 열어 주소창에 붙여넣어 주세요.");
  };

  // 자동 리다이렉트가 불가능한 iOS 인앱 브라우저(인스타/페이스북 등) 진입 시에만 수동 안내창 렌더링
  if (!isInApp || isKakao || (!isIOS && isInApp)) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-md px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">외부 브라우저 사용 권장</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            현재 사용 중인 브라우저는 <strong>구글 보안 정책</strong>으로 인해 구글 로그인이 불가능합니다. 원활한 서비스 이용을 위해 외부 브라우저로 이동해 주세요.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-muted hover:bg-muted/80 text-sm font-semibold transition-all duration-200 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>사이트 링크 복사하기</span>
          </button>
          
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs text-blue-600 dark:text-blue-400 space-y-2">
            <p className="font-extrabold flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> 수동으로 외부 브라우저 여는 방법:
            </p>
            <ul className="list-disc pl-4 space-y-1 font-medium leading-relaxed">
              <li>화면 우측 상단(또는 하단)의 <strong>더보기(⋮)</strong> 또는 <strong>공유(내보내기)</strong> 아이콘을 누릅니다.</li>
              <li>메뉴에서 <strong>[Safari로 열기]</strong> 또는 <strong>[다른 브라우저로 열기]</strong>를 선택해 주세요.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
