"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function PushNotificationListener() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent | any) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        if (data.type === "EXPO_PUSH_TOKEN" && data.token) {
          const pushToken = data.token;
          
          // 로컬 스토리지에 토큰 임시 저장 (로그인 시점 대비)
          if (typeof window !== 'undefined') {
            localStorage.setItem("expo_push_token", pushToken);
          }
          
          // 현재 로그인된 유저가 있다면 바로 업데이트
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            updateTokenIfDifferent(session.user.id, pushToken);
          }
        }
      } catch (e) {
        // 파싱 에러 무시
      }
    };

    // 토큰 업데이트 함수
    const updateTokenIfDifferent = async (userId: string, newToken: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("expo_push_token")
        .eq("id", userId)
        .single();

      if (profile?.expo_push_token !== newToken) {
        await supabase
          .from("profiles")
          .update({ expo_push_token: newToken })
          .eq("id", userId);
      }
    };

    // 웹 및 안드로이드 환경 수신
    window.addEventListener("message", handleMessage);
    // iOS 환경 수신
    document.addEventListener("message", handleMessage as any);

    // 로그인 상태가 변할 때(로그인 완료 시) 스토리지에 저장된 토큰을 DB에 업데이트
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.id) {
        const savedToken = typeof window !== 'undefined' ? localStorage.getItem("expo_push_token") : null;
        if (savedToken) {
          updateTokenIfDifferent(session.user.id, savedToken);
        }
      }
    });

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("message", handleMessage as any);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
