const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  
  // Test query
  const { data, error } = await supabase
    .from("event_channels")
    .select(`
      channel_id,
      event_id,
      events!inner (
        id,
        offline_events (id, end_date),
        online_events (id, end_at)
      )
    `)
    .in("channel_id", [69, 70, 71])
    .or(`events.offline_events.end_date.gte.${todayStr},events.online_events.end_at.gte.${todayStr}`);

  console.log("Error:", error ? error.message : "None");
  console.log("Data count:", data ? data.length : 0);
}

run();
