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

async function checkTable(tableName) {
  console.log(`\n=== Table: ${tableName} ===`);
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: tableName });
  if (error) {
    // try fallback
    const { data: rowData, error: rowError } = await supabase.from(tableName).select('*').limit(1);
    if (rowError) {
      console.error(`Failed to get schema for ${tableName}:`, rowError.message);
    } else {
      console.log(`Columns (fallback):`, rowData.length > 0 ? Object.keys(rowData[0]) : 'No rows found to extract columns');
      if (rowData.length > 0) {
        console.log(`Sample row:`, rowData[0]);
      }
    }
  } else {
    console.log(`Columns:`, data);
  }
}

async function run() {
  await checkTable('notifications');
  await checkTable('events');
  await checkTable('channel_notices');
  await checkTable('channel_requests');
  await checkTable('favorites');
  await checkTable('event_bookmarks');
}

run();
