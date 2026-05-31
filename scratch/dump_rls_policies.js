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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; // USE SERVICE ROLE!
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Query pg_policies using an RPC, but we can't directly query system tables via rest unless a view exists.
  // We can try to insert a test event as service_role.
  const { data: baseEvent } = await supabase.from('events').insert({ is_offline: true, is_online: false }).select().single();
  
  if (!baseEvent) return console.log("Failed to insert event.");
  
  // What columns does offline_events have?
  // We can intentionally fail an insert with a bad type to get the column list.
  const res = await supabase.from('offline_events').insert({
    event_id: baseEvent.id,
    title: 12345 // Intentionally wrong type to see schema in error
  });
  console.log("Error inserting offline_events (for schema):", res.error);

  // We can also try a successful insert using service_role to see if it works.
  const res2 = await supabase.from('offline_events').insert({
    event_id: baseEvent.id,
    title: "Test Event by Service Role",
    start_date: "2026-06-01",
    end_date: "2026-06-01"
  }).select();
  
  console.log("Service role insert result:", res2);

  if (res2.data) {
     await supabase.from('offline_events').delete().eq('event_id', baseEvent.id);
  }
  await supabase.from('events').delete().eq('id', baseEvent.id);
}
main();
