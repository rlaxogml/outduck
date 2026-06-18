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

async function inspectTrigger() {
  const client = new Client(singaporeConfig);
  try {
    await client.connect();

    console.log("Searching for triggers in Singapore DB...");
    const res = await client.query(`
      SELECT t.tgname AS trigger_name, c.relname AS table_name, pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND t.tgname ILIKE '%push%'
    `);
    console.log(res.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

inspectTrigger();
