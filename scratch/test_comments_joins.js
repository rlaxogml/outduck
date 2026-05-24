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

async function testJoin(relationName) {
  const { data, error } = await supabase
    .from('comments')
    .select(`id, relation:${relationName}(*)`)
    .limit(1);
  if (error) {
    console.log(`Join on '${relationName}' failed:`, error.message);
  } else {
    console.log(`Join on '${relationName}' SUCCEEDED!`);
  }
}

async function run() {
  const relations = ['profiles', 'users', 'channels', 'companies', 'comment_authors'];
  console.log("Testing joins on comments table...");
  for (const rel of relations) {
    await testJoin(rel);
  }
}

run();
