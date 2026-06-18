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

async function inspectAuthColumns() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    const userColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'users'
    `);
    console.log("auth.users Columns:", userColsRes.rows.map(r => r.column_name));

    const identityColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'identities'
    `);
    console.log("auth.identities Columns:", identityColsRes.rows.map(r => r.column_name));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectAuthColumns();
