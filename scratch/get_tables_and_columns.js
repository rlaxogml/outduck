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

async function main() {
  // Test invalid company to check foreign key constraint
  console.log("=== Testing invalid company insert on channels ===");
  const { data, error } = await supabase
    .from('channels')
    .insert({
      name: 'FK Test Channel',
      type: 'youtuber',
      company: 'NON_EXISTENT_COMPANY_XYZ_123'
    })
    .select();

  if (error) {
    console.log("Insert failed as expected! Error details:");
    console.log("Message:", error.message);
    console.log("Details:", error.details);
    console.log("Hint:", error.hint);
    console.log("Code:", error.code);
  } else {
    console.log("Insert succeeded! This means 'company' is NOT a strict foreign key or there is no constraint.");
    // Clean up
    if (data && data[0]) {
      await supabase.from('channels').delete().eq('id', data[0].id);
      console.log("Cleanup: deleted test channel.");
    }
  }
}
main();
