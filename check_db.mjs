import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('favorites').select(`
    channel_id, 
    channels (
      id, name, type, image_url,
      offline_event_channels (
        offline_events ( id, end_date )
      )
    )
  `).limit(1);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
checkSchema();
