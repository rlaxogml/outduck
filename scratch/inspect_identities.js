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

async function inspectIdentities() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("=== Singapore DB Identity Columns ===");
    const sgRes = await sgClient.query(`
      SELECT table_name, column_name, is_identity, identity_generation 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND is_identity = 'YES'
      ORDER BY table_name, column_name
    `);
    console.log(sgRes.rows);

    console.log("\n=== Seoul DB Identity Columns ===");
    const slRes = await slClient.query(`
      SELECT table_name, column_name, is_identity, identity_generation 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND is_identity = 'YES'
      ORDER BY table_name, column_name
    `);
    console.log(slRes.rows);

  } catch (err) {
    console.error("Error inspecting identities:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

inspectIdentities();
