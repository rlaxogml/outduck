const { Client } = require('pg');

const seoulConfig = {
  host: '3.39.47.126',
  port: 5432,
  user: 'postgres.hdazhucnjpfbgkhtoqnx',
  password: 'wZ6ST3YzeHhhdB0P',
  database: 'postgres',
  ssl: {
    servername: 'aws-1-ap-northeast-2.pooler.supabase.com',
    rejectUnauthorized: false
  }
};

async function inspectProfiles() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    // 1. Get column names
    const columnsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles'
    `);
    const cols = columnsRes.rows.map(r => r.column_name);
    console.log("Profiles Table Columns:", cols);

    // 2. Get all profiles
    console.log("\n--- All Profiles in Seoul DB ---");
    const allProfilesRes = await client.query("SELECT * FROM profiles");
    console.log(allProfilesRes.rows);

  } catch (err) {
    console.error("Error inspecting profiles:", err);
  } finally {
    await client.end();
  }
}

inspectProfiles();
