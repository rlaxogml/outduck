import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

// supabase-js 기본 auth 락은 navigator.locks(Web Locks) 기반이라,
// 토큰 자동 갱신 요청이 멈추면(백그라운드→복귀·네트워크 블립 등) 그 락을 영구히 쥐고 놓지 않아
// 이후 모든 auth.getSession() 호출이 무한 대기하는 데드락이 간헐적으로 발생한다.
// 모든 DB 요청은 헤더를 붙이려 내부적으로 getSession()을 await하므로 → 화면 무한 로딩으로 이어짐.
// 크로스탭 락을 no-op으로 대체해 데드락을 원천 제거한다.
// 트레이드오프: 여러 탭이 동시에 토큰을 갱신할 수 있으나(수 KB 수준, 드묾) supabase가 안전하게 처리.
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
  },
});
