const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const titlesToDelete = [
  "2026 LCK Road to MSI 토너먼트",
  "PNC 2026 팬 뷰잉 파티 및 오프라인 이벤트",
  "아카네 리제 첫 단독 콘서트 『AKANE LIZE : OVT.』 티켓 오픈",
  "이터널 리턴 3주년 페스티벌 (루미아 야시장)"
];

async function deleteSeededEvents() {
  console.log("Fetching seeded events to delete...");
  
  const { data: offlineEvents, error: fetchError } = await supabase
    .from('offline_events')
    .select('id, event_id, title')
    .in('title', titlesToDelete);

  if (fetchError) {
    console.error("Error fetching offline events:", fetchError);
    return;
  }

  if (!offlineEvents || offlineEvents.length === 0) {
    console.log("No matching seeded events found in database.");
    return;
  }

  console.log(`Found ${offlineEvents.length} events to delete:`);
  offlineEvents.forEach(e => console.log(`- Title: "${e.title}" (Event ID: ${e.event_id})`));

  const eventIds = offlineEvents.map(e => e.event_id);

  console.log("Deleting events from parent 'events' table...");
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .in('id', eventIds);

  if (deleteError) {
    console.error("Error deleting events:", deleteError);
  } else {
    console.log("Successfully deleted the seeded events from the database!");
  }
}

deleteSeededEvents();
