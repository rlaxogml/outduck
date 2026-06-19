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

async function checkStorage() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("=== Buckets in Seoul DB ===");
    const bucketsRes = await client.query("SELECT id, name, public FROM storage.buckets");
    console.table(bucketsRes.rows);

    console.log("\n=== RLS Status for storage tables ===");
    const rlsStatus = await client.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'storage'
    `);
    console.table(rlsStatus.rows);

    console.log("\n=== RLS Policies in storage schema ===");
    const policiesRes = await client.query(`
      SELECT policyname, tablename, cmd, roles, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'storage'
      ORDER BY tablename, policyname
    `);
    console.table(policiesRes.rows);

  } catch (err) {
    console.error("Error checking storage:", err);
  } finally {
    await client.end();
  }
}

checkStorage();
