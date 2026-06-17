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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findEvent() {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description')
    .ilike('description', '%game.naver.com%');
  
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${data.length} events matching game.naver.com:`);
  data.forEach(event => {
    console.log(`ID: ${event.id}`);
    console.log(`Title: ${event.title}`);
    console.log(`Description (JSON representation):`, JSON.stringify(event.description));
  });
}

findEvent();
