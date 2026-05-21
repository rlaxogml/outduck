const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
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

async function checkRLS() {
  console.log('Fetching policies/triggers from DB...');
  // We can query pg_policies using custom sql if we have an RPC, or check what happens when we try to insert into channels.
  // Let's check what RPCs are available, or let's just insert a test channel row with a standard user role.
  const { data: testChan, error: chanErr } = await supabase
    .from('channels')
    .insert([{ name: 'Test RLS Channel', type: 'youtuber', owner_id: '4080180c-0607-4273-b2b7-959f99b85e3a' }])
    .select();
  
  console.log('Channels Insert Result:', { testChan, chanErr });
  if (testChan && testChan.length > 0) {
    // cleanup
    await supabase.from('channels').delete().eq('id', testChan[0].id);
  }
}

checkRLS();
