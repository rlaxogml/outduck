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

async function run() {
  console.log('Fetching companies...');
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('*');

  if (compErr) {
    console.error('Error fetching companies:', compErr);
    return;
  }

  console.log('Available companies:', companies);
  if (companies.length === 0) {
    console.log('No companies found in database.');
    return;
  }

  // Use the first company
  const company = companies[0];
  console.log(`Using company: ${company.name} (id: ${company.id})`);

  // Insert 12 mock channels
  const mockChannels = [];
  for (let i = 1; i <= 12; i++) {
    mockChannels.push({
      name: `${company.name} 소속 크리에이터 ${i}`,
      type: i % 3 === 0 ? 'game' : i % 3 === 1 ? 'youtuber' : 'festival',
      is_team: false,
      company: company.name,
      owner_id: null,
      image_url: `https://api.dicebear.com/7.x/bottts/svg?seed=mock${i}`
    });
  }

  console.log(`Inserting 12 mock channels for company ${company.name}...`);
  const { data, error } = await supabase
    .from('channels')
    .insert(mockChannels)
    .select();

  if (error) {
    console.error('Failed to insert mock channels:', error);
  } else {
    console.log(`Successfully inserted ${data.length} mock channels!`);
    console.log(data.map(c => ({ id: c.id, name: c.name })));
  }
}

run();
