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

async function checkObjects() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();
    
    console.log("=== Objects in storage.objects (Top 10) ===");
    const res = await client.query(`
      SELECT id, bucket_id, name, owner, created_at, updated_at
      FROM storage.objects
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkObjects();
