import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
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
console.log('URL exists:', !!url);
console.log('Key exists:', !!key);

const supabase = createClient(url, key);

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();
const startDateLimit = new Date(year, month - 1, 20).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const endDateLimit = new Date(year, month + 1, 10).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
console.log('startDateLimit:', startDateLimit);
console.log('endDateLimit:', endDateLimit);

async function test() {
  // Test 1: online_events with date filter
  console.log('\n--- Test 1: online_events with current date filter ---');
  const { data: d1, error: e1, count: c1 } = await supabase
    .from('online_events')
    .select('id, title, start_at, end_at', { count: 'exact' })
    .not('start_at', 'is', null)
    .lte('start_at', endDateLimit)
    .or(`end_at.gte.${startDateLimit},end_at.is.null`);
  console.log('Error:', e1);
  console.log('Count:', c1);
  console.log('Data:', JSON.stringify(d1?.slice(0, 3), null, 2));

  // Test 2: all online_events without filter
  console.log('\n--- Test 2: all online_events (no filter) ---');
  const { data: d2, error: e2, count: c2 } = await supabase
    .from('online_events')
    .select('id, title, start_at, end_at', { count: 'exact' })
    .not('start_at', 'is', null)
    .limit(5);
  console.log('Error:', e2);
  console.log('Count:', c2);
  console.log('Data:', JSON.stringify(d2, null, 2));

  // Test 3: offline_events with date filter
  console.log('\n--- Test 3: offline_events with current date filter ---');
  const { data: d3, error: e3, count: c3 } = await supabase
    .from('offline_events')
    .select('id, title, start_date, end_date', { count: 'exact' })
    .not('start_date', 'is', null)
    .lte('start_date', endDateLimit)
    .or(`end_date.gte.${startDateLimit},end_date.is.null`);
  console.log('Error:', e3);
  console.log('Count:', c3);
  console.log('Data:', JSON.stringify(d3?.slice(0, 3), null, 2));

  // Test 4: all offline_events without filter
  console.log('\n--- Test 4: all offline_events (no filter) ---');
  const { data: d4, error: e4, count: c4 } = await supabase
    .from('offline_events')
    .select('id, title, start_date, end_date', { count: 'exact' })
    .not('start_date', 'is', null)
    .limit(5);
  console.log('Error:', e4);
  console.log('Count:', c4);
  console.log('Data:', JSON.stringify(d4, null, 2));

  // Test 5: Check RLS policies - are we authenticated?
  console.log('\n--- Test 5: Auth check ---');
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('Session:', sessionData?.session ? 'Logged in' : 'Not logged in');
}

test().catch(console.error);
