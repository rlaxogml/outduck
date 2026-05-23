const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log('Checking channel_notices...');
  const { data: cn, error: cnErr } = await supabase.from('channel_notices').select('*').limit(1);
  console.log('channel_notices error:', cnErr ? cnErr.message : 'None');
  if (cn) console.log('channel_notices cols:', Object.keys(cn[0] || {}));
  
  console.log('\nChecking event_notices...');
  const { data: en, error: enErr } = await supabase.from('event_notices').select('*').limit(1);
  console.log('event_notices error:', enErr ? enErr.message : 'None');
  if (en) console.log('event_notices cols:', Object.keys(en[0] || {}));
}

main();
