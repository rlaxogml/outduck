import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Webhook 페이로드 파싱
    const payload = await req.json()
    
    // 알림(notifications) 테이블의 INSERT 이벤트만 처리
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ message: 'Ignored payload.' }), { headers: corsHeaders })
    }

    const record = payload.record
    if (!record || !record.user_id || !record.message) {
      return new Response(JSON.stringify({ error: 'Invalid record data.' }), { headers: corsHeaders, status: 400 })
    }

    // 관리자 권한으로 Supabase 클라이언트 초기화
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 푸시 알림을 받을 유저의 expo_push_token 조회
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .eq('id', record.user_id)
      .single()

    if (error || !profile?.expo_push_token) {
      console.log(`푸시 토큰이 없거나 오류 발생 (User: ${record.user_id})`)
      return new Response(JSON.stringify({ message: 'User has no push token.' }), { headers: corsHeaders })
    }

    const pushToken = profile.expo_push_token

    // 알림 타입(type)에 따라 푸시 알림 제목(Title) 커스텀
    let title = 'OUTDUCK의 새로운 알림 🦆';
    if (record.type === 'new_reply') {
      title = '새로운 대댓글이 달렸어요!';
    } else if (record.type === 'new_event') {
      title = '새로운 행사가 등록되었어요!';
    } else if (record.type === 'new_notice') {
      title = '새로운 공지가 올라왔어요!';
    } else if (record.type === 'comment_ban') {
      title = '안내 메시지가 도착했습니다.';
    }

    // 엑스포(Expo) 푸시 서버로 발송 요청
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title: title,
        body: record.message, // 트리거가 만든 메시지 내용 (예: '댓글이 달렸습니다: ...')
        data: { 
          notificationId: record.id, 
          type: record.type, 
          event_id: record.event_id, 
          channel_id: record.channel_id 
        },
      }),
    })

    const expoResult = await expoResponse.json()
    console.log('Expo Push Response:', expoResult)

    return new Response(JSON.stringify({ success: true, expoResult }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    })

  } catch (err: any) {
    console.error('Error in send-expo-push:', err)
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    })
  }
})
