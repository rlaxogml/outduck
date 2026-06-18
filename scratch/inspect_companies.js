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

async function inspectCompanies() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("=== All Companies in Seoul DB ===");
    const compRes = await client.query("SELECT id, name, user_id FROM companies");
    console.log(compRes.rows);

    console.log("\n=== Channels with owner_id ===");
    const chanRes = await client.query("SELECT id, name, owner_id, company FROM channels WHERE owner_id IS NOT NULL OR company IS NOT NULL");
    console.log(chanRes.rows);

  } catch (err) {
    console.error("Error inspecting companies:", err);
  } finally {
    await client.end();
  }
}

inspectCompanies();
