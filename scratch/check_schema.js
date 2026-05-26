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
  console.log("Checking companies table...");
  const { data: compData, error: compErr } = await supabase.from('companies').select('*').limit(1);
  if (compErr) {
    console.error("companies error:", compErr.message);
  } else {
    console.log("companies columns:", compData.length > 0 ? Object.keys(compData[0]) : "No rows, but table exists.");
    console.log("companies sample:", compData[0]);
  }

  console.log("\nChecking channels table...");
  const { data: chanData, error: chanErr } = await supabase.from('channels').select('*').limit(1);
  if (chanErr) {
    console.error("channels error:", chanErr.message);
  } else {
    console.log("channels columns:", chanData.length > 0 ? Object.keys(chanData[0]) : "No rows, but table exists.");
    console.log("channels sample:", chanData[0]);
  }
}

run();
