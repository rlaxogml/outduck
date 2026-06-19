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

async function checkUrls() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();
    
    console.log("=== Sample Image URLs from events ===");
    const eventsRes = await client.query("SELECT id, image_url FROM events WHERE image_url IS NOT NULL LIMIT 5");
    console.table(eventsRes.rows);

    console.log("=== Sample Image URLs from channels ===");
    const channelsRes = await client.query("SELECT id, name, image_url FROM channels WHERE image_url IS NOT NULL LIMIT 5");
    console.table(channelsRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkUrls();
