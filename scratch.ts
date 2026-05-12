import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import path from 'path';
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const envVars = envFile.split('\n').reduce((acc: any, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    acc[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
  }
  return acc;
}, {});
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase
    .from("event_bookmarks")
    .select(`
       events!inner(
          event_channels(channels(id, name)),
          offline_events!inner(id, title, start_date, end_date, image_url)
       )
    `)
    .limit(1);
  
  if(error) console.log('FAIL:', error.message);
  else console.log('SUCCESS! Cleaner result:', JSON.stringify(data, null, 2));
}
test();
