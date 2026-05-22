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
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("1. Inserting request with status: approved...");
  const { data, error } = await supabase
    .from('channel_requests')
    .insert([{
      user_id: '4080180c-0607-4273-b2b7-959f99b85e3a',
      name: 'Approved Trigger Test',
      type: 'youtuber',
      company: '태스트',
      company_id: 2,
      status: 'approved',
      request_type: 'organizer'
    }])
    .select();

  if (error) {
    console.error("Insert failed:", error);
    return;
  }
  
  const req = data[0];
  console.log("Inserted request:", req);

  console.log("2. Waiting 2 seconds for any DB trigger...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("3. Querying channels with name 'Approved Trigger Test'...");
  const { data: channels, error: chanErr } = await supabase
    .from('channels')
    .select('*')
    .eq('name', 'Approved Trigger Test');

  console.log("Channels found:", channels, chanErr);

  console.log("4. Cleaning up...");
  await supabase.from('channel_requests').delete().eq('id', req.id);
  if (channels && channels.length > 0) {
    await supabase.from('channels').delete().eq('id', channels[0].id);
    console.log("Deleted created channel.");
  }
}

test();
