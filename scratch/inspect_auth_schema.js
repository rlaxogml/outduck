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

async function inspectAuth() {
  const client = new Client(singaporeConfig);
  try {
    await client.connect();

    console.log("=== Auth Schema Tables in Singapore ===");
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'auth'
    `);
    console.log(tablesRes.rows.map(r => r.table_name));

    console.log("\n=== Singapore auth.users count & sample ===");
    const usersRes = await client.query("SELECT id, email, created_at, raw_user_meta_data FROM auth.users");
    console.log(`Total users: ${usersRes.rows.length}`);
    console.log(usersRes.rows);

    console.log("\n=== Singapore auth.identities count & sample ===");
    const identitiesRes = await client.query("SELECT id, user_id, provider, identity_data, created_at FROM auth.identities");
    console.log(`Total identities: ${identitiesRes.rows.length}`);
    console.log(identitiesRes.rows);

  } catch (err) {
    console.error("Error inspecting auth schema:", err);
  } finally {
    await client.end();
  }
}

inspectAuth();
