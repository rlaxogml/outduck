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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMatching() {
  console.log("=== Fetching all companies ===");
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name');
  if (compErr) {
    console.error("Error fetching companies:", compErr.message);
    return;
  }
  const companyNames = new Set(companies.map(c => c.name));
  console.log("Registered companies in DB:", companies);

  console.log("\n=== Fetching all channels ===");
  const { data: channels, error: chanErr } = await supabase
    .from('channels')
    .select('id, name, company');
  if (chanErr) {
    console.error("Error fetching channels:", chanErr.message);
    return;
  }

  const unreferenced = [];
  const referenced = [];
  const empty = [];

  channels.forEach(ch => {
    if (!ch.company) {
      empty.push(ch);
    } else if (companyNames.has(ch.company)) {
      referenced.push(ch);
    } else {
      unreferenced.push(ch);
    }
  });

  console.log(`\nTotal Channels: ${channels.length}`);
  console.log(`- Connected to a valid company: ${referenced.length}`);
  console.log(`- Company column is empty (null): ${empty.length}`);
  console.log(`- Non-matching company values: ${unreferenced.length}`);
  
  if (unreferenced.length > 0) {
    console.log("\n--- Non-matching Channels list ---");
    unreferenced.forEach(ch => {
      console.log(`Channel ID: ${ch.id} | Name: "${ch.name}" | Company Value in DB: "${ch.company}"`);
    });
  }
}

checkMatching();
