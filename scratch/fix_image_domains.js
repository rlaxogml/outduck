const { Client } = require('pg');

const targetConfig = {
  host: '3.39.47.126', // aws-1-ap-northeast-2.pooler.supabase.com
  port: 5432,
  user: 'postgres.hdazhucnjpfbgkhtoqnx',
  password: 'wZ6ST3YzeHhhdB0P',
  database: 'postgres',
  ssl: {
    servername: 'aws-1-ap-northeast-2.pooler.supabase.com',
    rejectUnauthorized: false
  }
};

const oldDomain = 'https://maasnwelbrkjepurhiom.supabase.co';
const newDomain = 'https://hdazhucnjpfbgkhtoqnx.supabase.co';

async function fixDomains() {
  const client = new Client(targetConfig);
  try {
    await client.connect();
    console.log('Connected to Seoul DB to fix image domain urls...');

    const tablesToUpdate = [
      { name: 'posters', col: 'image_url' },
      { name: 'event_images', col: 'image_url' },
      { name: 'channels', col: 'image_url' },
      { name: 'offline_events', col: 'image_url' },
      { name: 'online_events', col: 'image_url' }
    ];

    for (const item of tablesToUpdate) {
      console.log(`Checking and updating table: ${item.name}.${item.col}...`);
      
      const res = await client.query(`
        UPDATE "${item.name}"
        SET "${item.col}" = REPLACE("${item.col}", $1, $2)
        WHERE "${item.col}" LIKE $3
      `, [oldDomain, newDomain, `%${oldDomain}%`]);

      console.log(`Updated ${res.rowCount} rows in ${item.name}.`);
    }

    console.log('✅ Image URL domains updated to Seoul server successfully!');
  } catch (err) {
    console.error('❌ Failed to update domains:', err.message);
  } finally {
    await client.end();
  }
}

fixDomains();
