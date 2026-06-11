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

async function runTests() {
  console.log('--- Querying Favorites ---');
  let s = performance.now();
  const { data: favs, error: favErr } = await supabase.from('favorites').select('*').limit(10);
  console.log(`Favorites Query: ${favs ? favs.length : 0} rows, took ${(performance.now() - s).toFixed(1)}ms. Error:`, favErr);

  console.log('--- Querying Event Bookmarks ---');
  s = performance.now();
  const { data: bms, error: bmErr } = await supabase.from('event_bookmarks').select('*').limit(10);
  console.log(`Bookmarks Query: ${bms ? bms.length : 0} rows, took ${(performance.now() - s).toFixed(1)}ms. Error:`, bmErr);

  console.log('--- Querying Companies ---');
  s = performance.now();
  const { data: comps, error: compErr } = await supabase.from('companies').select('*').limit(10);
  console.log(`Companies Query: ${comps ? comps.length : 0} rows, took ${(performance.now() - s).toFixed(1)}ms. Error:`, compErr);

  // If there are any rows in favorites, let's look at one user's data
  if (favs && favs.length > 0) {
    const userId = favs[0].user_id;
    console.log(`\nTesting queries with real user_id: ${userId}`);

    s = performance.now();
    const { data: userFavs } = await supabase
      .from("favorites")
      .select("channel_id, created_at, channels(id, name, type, image_url, team_id, is_team)")
      .eq("user_id", userId);
    console.log(`User Favorites Query took ${(performance.now() - s).toFixed(1)}ms. Count: ${userFavs ? userFavs.length : 0}`);

    s = performance.now();
    const { data: userBms } = await supabase
      .from("event_bookmarks")
      .select("event_id")
      .eq("user_id", userId);
    console.log(`User Bookmarks Query took ${(performance.now() - s).toFixed(1)}ms. Count: ${userBms ? userBms.length : 0}`);
  }
}

runTests();
