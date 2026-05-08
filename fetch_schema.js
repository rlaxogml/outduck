import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://maasnwelbrkjepurhiom.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYXNud2VsYnJramVwdXJoaW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODA1NzQsImV4cCI6MjA5MDM1NjU3NH0.ITlf2KdzmOYlde_63eLp-mmtfak9f8ch4qnXPQAvfTM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_schema_info'); // Wait, Supabase doesn't have this.
  
  // Actually we can just query a row to see types, or intentionally fail to get an error.
  console.log('Testing insert to offline_events');
  const res1 = await supabase.from('offline_events').insert({ title: 'test', start_date: null, end_date: null });
  console.log('Insert offline_events error:', JSON.stringify(res1.error, null, 2));

  console.log('Testing insert to offline_event_channels');
  const res2 = await supabase.from('offline_event_channels').insert({ event_id: 999999, channel_id: 999999 });
  console.log('Insert offline_event_channels error:', JSON.stringify(res2.error, null, 2));

  console.log('Testing insert to offline_event_locations');
  const res3 = await supabase.from('offline_event_locations').insert({ offline_event_id: 999999, location: 'test' });
  console.log('Insert offline_event_locations error:', JSON.stringify(res3.error, null, 2));
}
main();
