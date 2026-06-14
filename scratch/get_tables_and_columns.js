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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== Querying existing Channels ===");
  const { data: ch } = await supabase.from('channels').select('*').limit(1);
  console.log(JSON.stringify(ch, null, 2));

  console.log("\n=== Querying existing Events ===");
  const { data: ev } = await supabase.from('events').select('*').limit(1);
  console.log(JSON.stringify(ev, null, 2));

  console.log("\n=== Querying existing Offline Events ===");
  const { data: off } = await supabase.from('offline_events').select('*').limit(1);
  console.log(JSON.stringify(off, null, 2));

  console.log("\n=== Querying existing Event Channels ===");
  const { data: ec } = await supabase.from('event_channels').select('*').limit(1);
  console.log(JSON.stringify(ec, null, 2));

  console.log("\n=== Querying existing Offline Event Locations ===");
  const { data: loc } = await supabase.from('offline_event_locations').select('*').limit(1);
  console.log(JSON.stringify(loc, null, 2));
}
main();
