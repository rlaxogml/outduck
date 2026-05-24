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
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Checking user-created profile/profiles table...");
  
  // Try querying 'profile'
  const { data: p1, error: e1 } = await supabase.from('profile').select('*').limit(1);
  if (e1) {
    console.log("'profile' table query error:", e1.message);
  } else {
    console.log("'profile' table exists! Columns:", p1.length > 0 ? Object.keys(p1[0]) : "Empty table but exists.");
    if (p1.length > 0) console.log("Sample:", p1[0]);
  }

  // Try querying 'profiles' just in case
  const { data: p2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
  if (e2) {
    console.log("'profiles' table query error:", e2.message);
  } else {
    console.log("'profiles' table exists! Columns:", p2.length > 0 ? Object.keys(p2[0]) : "Empty table but exists.");
    if (p2.length > 0) console.log("Sample:", p2[0]);
  }
}

run();
