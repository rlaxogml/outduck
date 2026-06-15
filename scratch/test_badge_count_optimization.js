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

const allQueryChannelIds = [60]; // Let's use the favorite channel ID we saw (60) or multiple if any
const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

async function testOriginal() {
  console.log("--- ORIGINAL QUERY ---");
  const s = performance.now();
  const { data, error } = await supabase
    .from("event_channels")
    .select(`
      channel_id,
      events!inner (
        id,
        offline_events(id, end_date),
        online_events(id, end_at)
      )
    `)
    .in("channel_id", allQueryChannelIds);
  const duration = performance.now() - s;
  console.log(`Original query took: ${duration.toFixed(1)}ms`);
  if (error) console.error(error);
  else console.log(`Returned rows: ${data.length}`, JSON.stringify(data, null, 2));
}

async function testOptimized() {
  console.log("--- OPTIMIZED QUERIES ---");
  const s = performance.now();
  
  // Query active offline events for the channels
  const offlinePromise = supabase
    .from("offline_events")
    .select(`
      id,
      end_date,
      events!inner (
        id,
        event_channels!inner (
          channel_id
        )
      )
    `)
    .or(`end_date.gte.${todayStr},end_date.is.null`)
    .in("events.event_channels.channel_id", allQueryChannelIds);

  // Query active online events for the channels
  const onlinePromise = supabase
    .from("online_events")
    .select(`
      id,
      end_at,
      events!inner (
        id,
        event_channels!inner (
          channel_id
        )
      )
    `)
    .or(`end_at.gte.${todayStr},end_at.is.null`)
    .in("events.event_channels.channel_id", allQueryChannelIds);

  const [offlineRes, onlineRes] = await Promise.all([offlinePromise, onlinePromise]);
  const duration = performance.now() - s;

  console.log(`Optimized queries took: ${duration.toFixed(1)}ms`);
  if (offlineRes.error) console.error("Offline error:", offlineRes.error);
  if (onlineRes.error) console.error("Online error:", onlineRes.error);

  console.log(`Active Offline Events count: ${offlineRes.data?.length || 0}`);
  console.log("Offline sample:", JSON.stringify(offlineRes.data, null, 2));
  console.log(`Active Online Events count: ${onlineRes.data?.length || 0}`);
  console.log("Online sample:", JSON.stringify(onlineRes.data, null, 2));
}

async function run() {
  await testOriginal();
  await testOptimized();
}

run();
