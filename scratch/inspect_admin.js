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

async function inspect() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("=== Singapore DB Admins ===");
    const sgAdmins = await sgClient.query("SELECT id, nickname, is_admin FROM profiles WHERE is_admin = true");
    console.log(sgAdmins.rows);

    console.log("\n=== Seoul DB (New) Admins ===");
    const slAdmins = await slClient.query("SELECT id, nickname, is_admin FROM profiles WHERE is_admin = true");
    console.log(slAdmins.rows);

    console.log("\n=== Seoul DB Recent Profiles ===");
    const slProfiles = await slClient.query("SELECT id, nickname, is_admin FROM profiles ORDER BY id LIMIT 10");
    console.log(slProfiles.rows);

  } catch (err) {
    console.error("Error inspecting profiles:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

inspect();
