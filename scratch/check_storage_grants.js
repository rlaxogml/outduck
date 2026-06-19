const { Client } = require('pg');

const singaporeConfig = {
  host: '54.179.210.0',
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

async function getGrants(config) {
  const client = new Client(config);
  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        grantee, 
        privilege_type, 
        table_name
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'storage'
      ORDER BY table_name, grantee, privilege_type
    `);
    return res.rows;
  } catch (err) {
    console.error(`Error:`, err);
    return [];
  } finally {
    await client.end();
  }
}

async function run() {
  const sgGrants = await getGrants(singaporeConfig);
  const slGrants = await getGrants(seoulConfig);

  console.log(`Singapore rows count: ${sgGrants.length}`);
  console.log(`Seoul rows count: ${slGrants.length}`);

  const sgMap = new Set(sgGrants.map(r => `${r.table_name}:${r.grantee}:${r.privilege_type}`));
  const slMap = new Set(slGrants.map(r => `${r.table_name}:${r.grantee}:${r.privilege_type}`));

  const onlyInSingapore = sgGrants.filter(r => !slMap.has(`${r.table_name}:${r.grantee}:${r.privilege_type}`));
  const onlyInSeoul = slGrants.filter(r => !sgMap.has(`${r.table_name}:${r.grantee}:${r.privilege_type}`));

  console.log("=== Only in Singapore ===");
  console.table(onlyInSingapore);

  console.log("=== Only in Seoul ===");
  console.table(onlyInSeoul);
}

run();
