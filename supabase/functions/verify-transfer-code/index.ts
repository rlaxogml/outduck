import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, message: '코드가 제공되지 않았습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Get the JWT from the Auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: '인증 헤더가 없습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create a Supabase client with the user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Extract the token from the Bearer string
    const token = authHeader.replace('Bearer ', '').trim()

    // Get the user from the JWT by passing it explicitly
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: '유효하지 않은 사용자입니다.', error: userError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create a Supabase client with the SERVICE ROLE key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 구글 심사관 전용 마스터 키 (절대 유출 금지)
    const REVIEWER_MASTER_CODE = 'GOOGLE_REVIEW_8F3K9A2P_2026';
    if (code === REVIEWER_MASTER_CODE) {
      const companyName = '구글 앱 심사팀';
      
      // 1. 회사(Company) 확인 및 생성/업데이트
      const { data: existingCompany, error: companySelectError } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCompany) {
        const { error: companyUpdateError } = await supabaseAdmin
          .from('companies')
          .update({ name: companyName, profile_image_url: 'https://outduck.vercel.app/logo.png' })
          .eq('id', existingCompany.id);
        if (companyUpdateError) return new Response(JSON.stringify({ success: false, message: '회사 정보 업데이트 실패: ' + companyUpdateError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } else {
        const { error: companyInsertError } = await supabaseAdmin
          .from('companies')
          .insert({ name: companyName, profile_image_url: 'https://outduck.vercel.app/logo.png', user_id: user.id });
        if (companyInsertError) return new Response(JSON.stringify({ success: false, message: '회사 정보 생성 실패: ' + companyInsertError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // 2. 테스트용 채널(Channel) 확인 및 생성/업데이트
      const channelName = '구글 심사 테스트 채널';
      const { data: existingChannel } = await supabaseAdmin.from('channels').select('id').eq('name', channelName).maybeSingle();
      
      if (existingChannel) {
        const { error: channelUpdateError } = await supabaseAdmin.from('channels').update({ owner_id: user.id, company: companyName }).eq('id', existingChannel.id);
        if (channelUpdateError) return new Response(JSON.stringify({ success: false, message: '채널 업데이트 실패: ' + channelUpdateError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } else {
        const { error: channelInsertError } = await supabaseAdmin.from('channels').insert({ name: channelName, type: 'creator', owner_id: user.id, company: companyName });
        if (channelInsertError) return new Response(JSON.stringify({ success: false, message: '채널 생성 실패: ' + channelInsertError.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      return new Response(
        JSON.stringify({ success: true, message: '심사관 마스터 권한(회사 계정 및 주최자)이 성공적으로 부여되었습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Hash the input code
    const codeData = new TextEncoder().encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', codeData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Query the code
    const { data: codeRecord, error: codeError } = await supabaseAdmin
      .from('owner_transfer_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .maybeSingle()

    if (codeError || !codeRecord) {
      return new Response(
        JSON.stringify({ success: false, message: '유효하지 않거나 존재하지 않는 코드입니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (codeRecord.is_used) {
      return new Response(
        JSON.stringify({ success: false, message: '이미 사용된 코드입니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (new Date(codeRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: '만료된 코드입니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Success! Update the channel owner
    const { error: updateChannelError } = await supabaseAdmin
      .from('channels')
      .update({ owner_id: user.id })
      .eq('id', codeRecord.channel_id)

    if (updateChannelError) {
      throw updateChannelError;
    }

    // Set code as used
    await supabaseAdmin
      .from('owner_transfer_codes')
      .update({ is_used: true })
      .eq('id', codeRecord.id)

    // Cleanup expired codes (fire and forget)
    supabaseAdmin
      .from('owner_transfer_codes')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .then()

    return new Response(
      JSON.stringify({ success: true, message: '권한 위임이 완료되었습니다.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: '서버 오류가 발생했습니다.', error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
