const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function checkCompaniesSchema() {
  console.log('Fetching columns for companies...');
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'companies' });
  
  if (error) {
    console.error('RPC Error:', error);
    // Fallback: fetch single row
    const { data: rowData, error: rowError } = await supabase.from('companies').select('*').limit(1).maybeSingle();
    console.log('Fallback Single Row:', rowData);
    if (rowData) {
      console.log('Columns from row:', Object.keys(rowData));
    }
  } else {
    console.log('Columns:', data);
  }
}

checkCompaniesSchema();
