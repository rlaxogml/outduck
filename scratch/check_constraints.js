const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; // Service role key is needed to query pg_catalog or run raw sql
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // We can query pg_catalog if we have an RPC, but let's see if we can try to insert a test row to see if constraints block it.
  // Wait, let's write a script that tries to insert a channel with type 'vtuber' in channels and channel_requests.
  console.log("Trying insert in channels table...");
  const { data: cData, error: cError } = await supabase
    .from('channels')
    .insert({
      name: 'test_vtuber_chk_channel',
      type: 'vtuber',
      is_team: false
    })
    .select();
  
  console.log("Channels insert result:", { data: cData, error: cError });

  if (cData && cData.length > 0) {
    // Clean up
    await supabase.from('channels').delete().eq('id', cData[0].id);
  }

  const { data: profiles, error: pError } = await supabase.from('profiles').select('id').limit(1);
  if (pError || !profiles || profiles.length === 0) {
    console.error("No profiles found to test channel_requests insert:", pError);
    return;
  }
  const validUserId = profiles[0].id;

  console.log("Trying insert in channel_requests table with user_id:", validUserId);
  const { data: rData, error: rError } = await supabase
    .from('channel_requests')
    .insert({
      user_id: validUserId,
      name: 'test_vtuber_chk_req',
      type: 'vtuber',
      is_team: false,
      status: 'pending',
      request_type: 'organizer'
    })
    .select();

  console.log("Requests insert result:", { data: rData, error: rError });
  if (rData && rData.length > 0) {
    await supabase.from('channel_requests').delete().eq('id', rData[0].id);
  }
}
check();
