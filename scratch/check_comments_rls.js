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
  console.log("Attempting to insert an anonymous comment...");
  const { data, error } = await supabase
    .from('comments')
    .insert([{
      user_id: '4080180c-0607-4273-b2b7-959f99b85e3a',
      content: 'Anonymous test comment',
      event_id: 1
    }])
    .select();

  if (error) {
    console.log("Insert failed as expected under RLS:", error.message, error);
  } else {
    console.log("Insert succeeded! Data:", data);
    // Cleanup
    await supabase.from('comments').delete().eq('id', data[0].id);
  }
}

run();
