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

async function checkPosters() {
  const { data, error } = await supabase
    .from('posters')
    .select('*')
    .limit(1);
  if (error) {
    console.error(`Posters table error:`, error.message);
  } else {
    console.log(`Posters table exists!`);
    console.log(`Posters columns:`, Object.keys(data?.[0] || {}));
    console.log(`Posters sample:`, data?.[0] || 'No rows found');
  }
}

checkPosters();
