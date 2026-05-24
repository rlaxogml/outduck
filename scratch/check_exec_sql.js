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
  console.log("Checking if RPC to run SQL exists...");
  const { data: r1, error: e1 } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
  console.log("exec_sql result:", r1, e1 ? e1.message : "Success");
  
  const { data: r2, error: e2 } = await supabase.rpc('run_sql', { sql: 'SELECT 1;' });
  console.log("run_sql result:", r2, e2 ? e2.message : "Success");
}

run();
