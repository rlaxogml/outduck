const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testEventQuery() {
  console.log('Testing Offline Event Detail Query for ID: 31...');
  const s = performance.now();
  
  const { data, error } = await supabase
    .from("offline_events")
    .select(`
      id, event_id, title, description, start_date, end_date, start_time, end_time, image_url, reservation_type, reservation_starts_at, reservation_ends_at, links,
      events (
        event_channels ( channels ( id, name, type, image_url, owner_id, company ) ),
        event_images ( id, image_url, order ),
        event_schedules ( id, day_of_week, date, open_time, close_time, reservation_type )
      ),
      offline_event_locations ( location )
    `)
    .eq("id", 31)
    .maybeSingle();

  const duration = performance.now() - s;
  if (error) {
    console.error('Query failed:', error);
  } else {
    console.log(`Query succeeded in ${duration.toFixed(1)}ms. Title: ${data?.title}`);
    console.log('Returned Data structure details:', {
      hasEvents: !!data?.events,
      channelsCount: data?.events?.event_channels?.length || 0,
      imagesCount: data?.events?.event_images?.length || 0,
      schedulesCount: data?.events?.event_schedules?.length || 0,
      locationsCount: data?.offline_event_locations?.length || 0
    });
  }
}

testEventQuery();
