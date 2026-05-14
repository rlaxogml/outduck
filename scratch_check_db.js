const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('offline_events')
    .select('id, start_date, end_date, events ( event_schedules ( day_of_week ) )')
    .eq('id', 14)
    .maybeSingle();
  console.log(JSON.stringify(data, null, 2));
}

check();
