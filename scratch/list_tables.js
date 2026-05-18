const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
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

async function listTables() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'offline_events' });
  if (error) {
    console.error("RPC Error:", error);
    
    // Fallback: try querying a non-existent table to see PostgREST error hint which lists valid tables
    const { error: fallbackErr } = await supabase.from('non_existent_table_xyz').select('*');
    console.log("Fallback Hint:", fallbackErr ? fallbackErr.hint : "No hint");
    console.log("Fallback Msg:", fallbackErr ? fallbackErr.message : "No message");
  } else {
    console.log("Columns of offline_events via RPC:", data);
  }
}

listTables();
