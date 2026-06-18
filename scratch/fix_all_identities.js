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

async function fixIdentities() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("Connected to both databases.");

    // 1. Fetch all identity columns from Singapore
    console.log("Fetching identity columns from Singapore database...");
    const sgRes = await sgClient.query(`
      SELECT table_name, column_name, is_identity, identity_generation 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND is_identity = 'YES'
      ORDER BY table_name, column_name
    `);
    
    const identityColumns = sgRes.rows;
    console.log(`Found ${identityColumns.length} identity columns to restore.`);

    // 2. Apply identity properties on Seoul DB
    for (const col of identityColumns) {
      const { table_name, column_name, identity_generation } = col;
      console.log(`\n⚙️ Restoring identity for public."${table_name}"."${column_name}" (${identity_generation})...`);

      try {
        // Drop default if any exists to avoid conflicts
        await slClient.query(`ALTER TABLE public."${table_name}" ALTER COLUMN "${column_name}" DROP DEFAULT;`);
      } catch (e) {
        // Ignore if no default exists
      }

      try {
        // Add GENERATED AS IDENTITY property
        const genType = identity_generation === 'ALWAYS' ? 'ALWAYS' : 'BY DEFAULT';
        await slClient.query(`
          ALTER TABLE public."${table_name}" 
          ALTER COLUMN "${column_name}" 
          ADD GENERATED ${genType} AS IDENTITY;
        `);
        console.log(`   ✅ Identity property added successfully.`);
      } catch (err) {
        console.error(`   ❌ Failed to add identity property:`, err.message);
      }

      try {
        // Sync the sequence value to the maximum ID currently in the table
        const seqName = `public."${table_name}"`;
        const syncRes = await slClient.query(`
          SELECT setval(
            pg_get_serial_sequence($1, $2), 
            coalesce(max("${column_name}"), 1)
          ) FROM public."${table_name}"
        `, [seqName.replace(/"/g, ''), column_name]);
        
        console.log(`   🔄 Sequence synchronized to: ${syncRes.rows[0].setval}`);
      } catch (err) {
        console.error(`   ⚠️ Failed to sync sequence:`, err.message);
      }
    }

    console.log("\n==============================================");
    console.log("🎉 All identity columns successfully restored!");
    console.log("==============================================");

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

fixIdentities();
