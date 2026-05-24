const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envFile = fs.readFileSync(envPath, "utf8");
envFile.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from("posters")
    .select("*");
  console.log("Error:", error);
  console.log("Posters:", JSON.stringify(data, null, 2));

  // let's also simulate the frontend filter
  const now = new Date();
  console.log("Current Now (Date):", now, now.toISOString());
  
  const validPosters = (data || []).filter((p) => {
    const start = p.start_date ? new Date(p.start_date) : null;
    const end = p.end_date ? new Date(p.end_date) : null;
    
    let valid = true;
    if (start && start > now) valid = false;
    if (end && end < now) valid = false;
    
    console.log(`Poster ${p.id}: start=${start}, end=${end}, is_active=${p.is_active}, isValidDate=${valid}`);
    return valid && p.is_active;
  });

  console.log("Valid Posters:", validPosters.map(p => p.id));
}

check();
