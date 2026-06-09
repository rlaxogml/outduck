import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    envVars[key.trim()] = rest.join('=').trim();
  }
}

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const key = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const supabase = createClient(url, key);

async function test() {
  // Check the full structure of event id=31
  console.log('--- Full structure of offline_event id=31 ---');
  const { data, error } = await supabase
    .from('offline_events')
    .select(`
      id, event_id, title, start_date, end_date,
      events(
        event_channels(
          channels(id, name, type, image_url)
        ),
        event_schedules(date, day_of_week)
      ),
      offline_event_locations(location)
    `)
    .eq('id', 31);
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));

  // Check what channels exist
  console.log('\n--- All channels ---');
  const { data: channels, error: ce } = await supabase
    .from('channels')
    .select('id, name, type')
    .limit(10);
  console.log('Error:', ce);
  console.log('Channels:', JSON.stringify(channels, null, 2));

  // Check mini calendar query - does it use weekStart/weekEnd correctly?
  const today = new Date('2026-06-09');
  const day = today.getDay(); // 1 = Mon
  const diff = today.getDate() - day + 1;
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(diff + i);
    weekDates.push(d);
  }
  const sorted = [...weekDates].sort((a, b) => a.getTime() - b.getTime());
  const weekStart = sorted[0].toLocaleDateString('sv-SE');
  const weekEnd = sorted[6].toLocaleDateString('sv-SE');
  console.log('\n--- Mini Calendar query ---');
  console.log('weekStart:', weekStart, 'weekEnd:', weekEnd);
  
  const { data: miniData, error: me } = await supabase
    .from('offline_events')
    .select(`id, event_id, title, start_date, end_date, offline_event_locations(location), events(event_channels(channels(id, name, image_url)))`)
    .lte('start_date', weekEnd)
    .gte('end_date', weekStart);
  console.log('Mini cal offline error:', me);
  console.log('Mini cal offline data count:', miniData?.length);
  console.log('Mini cal offline data:', JSON.stringify(miniData, null, 2));
}

test().catch(console.error);
