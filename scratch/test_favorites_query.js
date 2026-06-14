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

async function testFavorites() {
  console.log("1. Querying favorites table details...");
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .limit(5);
    if (error) console.error("Favorites error:", error.message);
    else console.log("Favorites sample:", data);
  } catch (e) {
    console.error("Favorites exception:", e.message);
  }

  console.log("2. Querying event_bookmarks table details...");
  try {
    const { data, error } = await supabase
      .from('event_bookmarks')
      .select('*')
      .limit(5);
    if (error) console.error("Bookmarks error:", error.message);
    else console.log("Bookmarks sample:", data);
  } catch (e) {
    console.error("Bookmarks exception:", e.message);
  }

  console.log("3. Querying companies table details...");
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .limit(5);
    if (error) console.error("Companies error:", error.message);
    else console.log("Companies sample:", data);
  } catch (e) {
    console.error("Companies exception:", e.message);
  }
}

testFavorites();
