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

const oldUuid = '4080180c-0607-4273-b2b7-959f99b85e3a'; // 별하수's old Singapore DB UUID
const newUuid = '214b08af-535c-4270-80f2-0da6a4dae8cd'; // 별하수's new Seoul DB UUID

async function updateProfileUuid() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("Updating profile ID from old Singapore UUID to new Seoul UUID...");
    
    // Perform the update
    const res = await client.query(
      "UPDATE profiles SET id = $1 WHERE id = $2",
      [newUuid, oldUuid]
    );

    console.log(`Update completed: ${res.rowCount} row(s) updated.`);

    // Verify
    const verifyRes = await client.query("SELECT * FROM profiles WHERE id = $1", [newUuid]);
    console.log("Updated profile row:", verifyRes.rows);

  } catch (err) {
    console.error("Error updating profile UUID:", err);
  } finally {
    await client.end();
  }
}

updateProfileUuid();
