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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching RLS policies...");
  const { data, error } = await supabase.rpc('execute_sql_query', {
    query_text: `
      SELECT tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename IN ('favorites', 'event_bookmarks', 'companies', 'channels');
    `
  });
  
  if (error) {
    // If the RPC execute_sql_query doesn't exist, we can try running query via SQL view or just direct postgres query if we have a way.
    // Let's print the error.
    console.error("Error fetching policies:", error);
    
    // Let's try running direct SQL using standard REST fallback or schema check
    console.log("Trying alternative query via postgres functions...");
  } else {
    console.log("Policies:", JSON.stringify(data, null, 2));
  }
}
main();
