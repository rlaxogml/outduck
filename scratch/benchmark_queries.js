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
  // Get some active channel IDs to test with
  const { data: channels } = await supabase.from('channels').select('id').limit(10);
  const channelIds = channels.map(c => c.id);
  console.log("Testing with channel IDs:", channelIds);

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  console.log("Today string:", todayStr);

  // Method 1: Current approach (offline + online parallel queries)
  console.log("\n--- METHOD 1: Current approach ---");
  const s1 = performance.now();
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
    .in("events.event_channels.channel_id", channelIds);

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
    .in("events.event_channels.channel_id", channelIds);

  const [resOffline, resOnline] = await Promise.all([offlinePromise, onlinePromise]);
  const d1 = performance.now() - s1;
  console.log(`Method 1 took: ${d1.toFixed(1)}ms`);
  console.log(`Offline rows: ${resOffline.data?.length || 0}, Online rows: ${resOnline.data?.length || 0}`);

  // Method 3: Direct query on event_channels with filters
  console.log("\n--- METHOD 3: Direct query on event_channels with filters ---");
  const s3 = performance.now();
  
  // To use .or() on nested tables, they must be marked as !inner if we want to filter by them.
  // Wait, if we use !inner, does it force the event to have BOTH?
  // Let's test if we can do nested OR filter.
  // Note: in postgrest, nested filters can be specified, but let's see if it works.
  const { data: ecData3, error: ecErr3 } = await supabase
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
    .in("channel_id", channelIds);
    // Let's see if we can filter in the DB using postgrest or if it fails
  const d3 = performance.now() - s3;
  console.log(`Method 3 took: ${d3.toFixed(1)}ms`);
  if (ecErr3) console.error(ecErr3);
  else {
    console.log(`Event channels rows: ${ecData3.length}`);
  }
}

run();
