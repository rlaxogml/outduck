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

async function checkSingapore() {
  const client = new Client(singaporeConfig);
  try {
    await client.connect();
    console.log("Connected to Singapore DB.");

    console.log("=== Singapore DB Storage Buckets ===");
    const bucketsRes = await client.query("SELECT id, name, public FROM storage.buckets");
    console.table(bucketsRes.rows);

    console.log("=== Singapore DB Storage Tables RLS Status ===");
    const rlsRes = await client.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'storage'
    `);
    console.table(rlsRes.rows);

    console.log("=== Singapore DB Storage Policies ===");
    const res = await client.query(`
      SELECT policyname, tablename, cmd, roles, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'storage'
      ORDER BY tablename, policyname
    `);
    console.table(res.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkSingapore();
