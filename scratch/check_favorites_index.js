const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Querying a sample of favorites...");
  const { data: favs, error: favError } = await supabase
    .from('favorites')
    .select('channel_id, user_id, created_at')
    .limit(10);
  console.log("Favorites:", favs, favError);

  // Let's run query explaining if possible? Supabase REST API doesn't support EXPLAIN directly unless via raw SQL,
  // but let's check the size of the favorites table.
  const { count, error: countError } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true });
  console.log("Total favorites count:", count, countError);
}

check();
