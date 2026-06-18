const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env
const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  if (error) {
    console.error(`${tableName} error:`, error.message);
  } else {
    console.log(`${tableName} columns:`, Object.keys(data?.[0] || {}));
    console.log(`${tableName} sample:`, data?.[0] || 'No rows found');
  }
  console.log('--------------------------------------------------');
}

async function check() {
  const tables = [
    'events', 
    'online_events',
    'offline_events', 
    'offline_event_locations',
    'event_channels',
    'channels',
    'channel_requests',
    'companies'
  ];
  for (const table of tables) {
    await checkTable(table);
  }
}

check();
