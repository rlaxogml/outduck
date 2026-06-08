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

async function testQueries() {
  console.log('Starting direct query tests...');
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  const measure = async (label, promise) => {
    const s = performance.now();
    const { data, error } = await promise;
    const duration = performance.now() - s;
    if (error) {
      console.error(`[${label}] Error:`, error.message);
    } else {
      console.log(`[${label}] Success: ${data.length} rows, took ${duration.toFixed(1)}ms`);
    }
    return duration;
  };

  // 1. Posters query (Should be tiny)
  await measure(
    'Posters Query',
    supabase
      .from('posters')
      .select('*')
      .order('order', { ascending: true })
  );

  // 2. Online Events query
  await measure(
    'Online Events Query',
    supabase
      .from('online_events')
      .select(`
        id,
        title,
        start_at,
        end_at,
        image_url,
        created_at,
        events(
          event_channels(
            channels(
              id,
              name,
              type,
              image_url
            )
          )
        )
      `)
      .or(`end_at.gte.${todayStr},end_at.is.null`)
      .order('start_at', { ascending: true })
      .range(0, 29)
  );

  // 3. Offline Events query
  await measure(
    'Offline Events Query',
    supabase
      .from('offline_events')
      .select(`
        id,
        title,
        start_date,
        end_date,
        image_url,
        reservation_type,
        created_at,
        events(
          event_channels(
            channels(
              id,
              name,
              type,
              image_url
            )
          )
        ),
        offline_event_locations(
          location
        )
      `)
      .or(`end_date.gte.${todayStr},end_date.is.null`)
      .order('start_date', { ascending: true })
      .range(0, 29)
  );

  // 4. Parallel test to simulate page load
  console.log('\nStarting parallel query simulation...');
  const startParallel = performance.now();
  await Promise.all([
    supabase.from('posters').select('*').order('order', { ascending: true }),
    supabase.from('online_events').select(`id, title`).range(0, 2),
    supabase.from('offline_events').select(`id, title`).range(0, 2),
  ]);
  console.log(`Parallel lightweight query simulation took: ${(performance.now() - startParallel).toFixed(1)}ms`);
}

testQueries();
