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
