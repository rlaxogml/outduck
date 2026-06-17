const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Testing RPC call...");
  const userId = 'da6c5e2d-3759-4458-9a4f-561bcf79df7b'; // dummy uuid
  
  const { data, error } = await supabase.rpc("get_favorite_channels_with_counts", { p_user_id: userId });
  if (error) {
    console.log("RPC call failed as expected (since it hasn't been created on remote DB yet):");
    console.log("Error code:", error.code);
    console.log("Error message:", error.message);
    
    console.log("\nTesting fallback table query...");
    const { data: fallbackData, error: fallbackError } = await supabase.from("favorites")
      .select("channel_id, created_at, channels(id, name, type, image_url, team_id, is_team)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
      
    if (fallbackError) {
      console.error("Fallback query failed:", fallbackError.message);
    } else {
      console.log("Fallback query succeeded! Rows returned:", fallbackData.length);
    }
  } else {
    console.log("RPC call succeeded! Data returned:", data);
  }
}

run();
