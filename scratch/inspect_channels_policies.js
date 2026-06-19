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

async function inspectPolicies() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("=== RLS Policies on 'channels' Table ===");
    const res = await client.query("SELECT * FROM pg_policies WHERE tablename = 'channels'");
    console.log(res.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectPolicies();
