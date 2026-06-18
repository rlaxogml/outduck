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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);

// Test using anon key (which is what client uses)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testQuery() {
  console.log("Testing SELECT from 'posters' table...");
  const { data, error } = await supabase
    .from('posters')
    .select('*')
    .limit(1);

  if (error) {
    console.error("❌ SELECT Query Failed!");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
  } else {
    console.log("✅ SELECT Query Succeeded!");
    console.log("Data sample:", data);
  }
}

testQuery();
