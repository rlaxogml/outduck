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

async function inspectSchemas() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("=== All Schemas in Seoul DB ===");
    const schemaRes = await client.query("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name");
    console.log(schemaRes.rows.map(r => r.schema_name));

    console.log("\n=== Functions matching 'http' or 'request' ===");
    const funcRes = await client.query(`
      SELECT p.proname AS func_name, n.nspname AS schema_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname ILIKE '%http%' OR p.proname ILIKE '%request%'
      ORDER BY schema_name, func_name
    `);
    console.log(funcRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectSchemas();
