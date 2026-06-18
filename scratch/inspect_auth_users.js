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

async function inspectAuthUsers() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("--- All Users in auth.users ---");
    const res = await client.query("SELECT id, email, created_at, raw_user_meta_data FROM auth.users");
    console.log(res.rows);

  } catch (err) {
    console.error("Error inspecting auth users:", err);
  } finally {
    await client.end();
  }
}

inspectAuthUsers();
