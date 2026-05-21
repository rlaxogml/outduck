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

async function checkRequests() {
  console.log('Fetching channel requests...');
  const { data, error } = await supabase
    .from('channel_requests')
    .select('id, name, company, company_id, status, request_type, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total Requests:', data.length);
    console.log('Recent 15 requests:');
    console.log(JSON.stringify(data.slice(0, 15), null, 2));
  }
}

checkRequests();
