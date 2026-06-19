const { Client } = require('pg');

const singaporeConfig = {
  host: '54.179.210.0', // aws-1-ap-southeast-1.pooler.supabase.com
  port: 5432,
  user: 'postgres.maasnwelbrkjepurhiom',
  password: 'K8TVrPnTuScDwMLi',
  database: 'postgres',
  ssl: {
    servername: 'aws-1-ap-southeast-1.pooler.supabase.com',
    rejectUnauthorized: false
  }
};

async function inspectStoragePolicies() {
  const client = new Client(singaporeConfig);
  try {
    await client.connect();

    console.log("=== Storage Policies in Singapore DB ===");
    const res = await client.query("SELECT * FROM pg_policies WHERE schemaname = 'storage'");
    console.log(res.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectStoragePolicies();
