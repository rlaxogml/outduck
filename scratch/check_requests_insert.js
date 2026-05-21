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

async function checkInsert() {
  console.log('Inserting with status approved...');
  const { data, error } = await supabase
    .from('channel_requests')
    .insert([{
      user_id: '4080180c-0607-4273-b2b7-959f99b85e3a',
      name: 'Anon Test Approved',
      type: 'youtuber',
      company: '태스트',
      company_id: 2,
      status: 'approved',
      request_type: 'organizer'
    }])
    .select();

  console.log('Result:', { data, error });
  if (data && data.length > 0) {
    console.log('Saved Status:', data[0].status);
    await supabase.from('channel_requests').delete().eq('id', data[0].id);
  }
}

checkInsert();
