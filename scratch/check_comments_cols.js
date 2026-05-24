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

async function checkColumn(colName) {
  const { data, error } = await supabase.from('comments').select(`id, ${colName}`).limit(1);
  if (error) {
    if (error.message.includes('Could not find column')) {
      console.log(`Column '${colName}': DOES NOT EXIST`);
    } else {
      console.log(`Column '${colName}': Error - ${error.message}`);
    }
  } else {
    console.log(`Column '${colName}': EXISTS!`);
  }
}

async function run() {
  const columns = [
    'user_name', 'user_avatar', 'user_avatar_url', 'nickname', 'profile_img', 
    'author_name', 'author_avatar', 'avatar_url', 'name', 'email', 'content',
    'created_at', 'user_id', 'event_id', 'notice_id', 'parent_id'
  ];
  console.log("Checking columns in comments table...");
  for (const col of columns) {
    await checkColumn(col);
  }
}

run();
