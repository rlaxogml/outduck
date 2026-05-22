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

async function run() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  console.log('Fetching OpenAPI schema from:', url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Response status:', res.status);
    console.log('Response body preview:', text.slice(0, 1000));
  } catch (err) {
    console.error('Error fetching OpenAPI schema:', err);
  }
}

run();
