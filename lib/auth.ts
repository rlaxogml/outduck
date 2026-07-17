import { supabase } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";

/**
 * 앱에서 지원(예정)하는 소셜 로그인 제공자.
 * - google: 지원 중
 * - kakao:  Supabase 기본 제공자 → 대시보드에서 Kakao 활성화 + 키 등록만 하면 바로 사용 가능
 * - naver:  Supabase 기본 제공자가 아님 → custom OIDC 연동이 필요 (추후)
 */
export type SocialProvider = "google" | "kakao" | "naver";

type ProviderSetting = {
  /** Supabase에 넘길 실제 provider 값. 아직 미지원이면 null. */
  supabaseProvider: Provider | null;
  /** 버튼 라벨 등에 쓸 사람이 읽는 이름. */
  label: string;
  /**
   * OAuth 인가 URL에 덧붙는 쿼리 파라미터.
   * prompt=select_account → 로그아웃 후 "다른 계정"으로 로그인할 수 있도록
   * 매번 계정 선택 화면을 강제한다. (없으면 이전 계정으로 자동 로그인됨)
   */
  queryParams?: Record<string, string>;
  /** 추가로 요청할 scope (필요 시). */
  scopes?: string;
};

const PROVIDER_SETTINGS: Record<SocialProvider, ProviderSetting> = {
  google: {
    supabaseProvider: "google",
    label: "Google",
    queryParams: { prompt: "select_account" },
  },
  kakao: {
    supabaseProvider: "kakao",
    label: "카카오",
    // 카카오도 자동 로그인을 막고 매번 계정 선택을 유도.
    queryParams: { prompt: "select_account" },
  },
  naver: {
    // 네이버는 Supabase 기본 제공자가 아니라서 custom OIDC 연동 후
    // `custom:naver` 형태로 채워야 활성화된다.
    supabaseProvider: null,
    label: "네이버",
  },
};

/** 해당 제공자가 지금 로그인 가능한 상태인지. */
export function isProviderEnabled(provider: SocialProvider): boolean {
  return PROVIDER_SETTINGS[provider]?.supabaseProvider != null;
}

export type SignInOptions = {
  /** 로그인 완료 후 돌아올 URL. 기본값: 현재 페이지(window.location.href). */
  redirectTo?: string;
};

/**
 * 소셜 로그인 시작 (OAuth 리다이렉트).
 * 지원하지 않는 제공자(naver 등 미연동)면 에러를 던진다.
 */
export async function signInWithProvider(
  provider: SocialProvider,
  { redirectTo }: SignInOptions = {},
): Promise<void> {
  const setting = PROVIDER_SETTINGS[provider];
  if (!setting?.supabaseProvider) {
    throw new Error(`${setting?.label ?? provider} 로그인은 아직 준비 중입니다.`);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: setting.supabaseProvider,
    options: {
      redirectTo:
        redirectTo ??
        (typeof window !== "undefined" ? window.location.href : undefined),
      queryParams: setting.queryParams,
      scopes: setting.scopes,
    },
  });

  if (error) throw error;
}

/** 편의 함수: 구글 로그인. */
export function signInWithGoogle(options?: SignInOptions) {
  return signInWithProvider("google", options);
}

/**
 * 완전 로그아웃: Supabase 세션 로컬 캐시(sb-*)까지 지운다.
 * 이렇게 해야 다음 로그인 때 이전 세션이 남아 자동 복원되는 걸 막을 수 있다.
 * (Google 계정 선택 화면 강제는 signInWithProvider의 prompt=select_account가 담당)
 */
export async function signOutCompletely(): Promise<void> {
  if (typeof window !== "undefined") {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    }
  }
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Logout error:", error);
  }
}
