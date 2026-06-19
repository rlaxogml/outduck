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

async function checkUsers() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("=== Current auth.users ===");
    const usersRes = await client.query("SELECT id, email, created_at FROM auth.users");
    console.log(usersRes.rows);

    console.log("\n=== Current auth.identities ===");
    const identRes = await client.query("SELECT id, user_id, provider, identity_data FROM auth.identities");
    console.log(identRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkUsers();
