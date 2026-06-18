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

const seoulServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYXpodWNuanBmYmdraHRvcW54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc4OTQyOSwiZXhwIjoyMDk3MzY1NDI5fQ.O-R-xBr3TLS6PlVDgQajUlWwcmbOsgEUHCsL3A7naEY';
const seoulUrl = 'https://hdazhucnjpfbgkhtoqnx.supabase.co';

async function fixIntegrityGaps() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("Connected to both databases.");
    console.log("------------------------------------------");

    // 2. Copy missing rows for channel_notices and notice_views
    // Disable triggers temporarily on target to insert replicas safely
    await slClient.query("SET session_replication_role = 'replica';");

    // Sync channel_notices (has identity column)
    {
      const table = 'channel_notices';
      console.log(`🔍 Syncing missing rows for table: ${table}...`);
      const sgRowsRes = await sgClient.query(`SELECT * FROM public."${table}"`);
      const sgRows = sgRowsRes.rows;
      console.log(`- Singapore has ${sgRows.length} rows.`);

      if (sgRows.length > 0) {
        const columns = Object.keys(sgRows[0]);
        const columnsEscaped = columns.map(c => `"${c}"`).join(', ');

        for (const row of sgRows) {
          const values = columns.map(c => row[c]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          // Use OVERRIDING SYSTEM VALUE because id is GENERATED ALWAYS
          const insertSQL = `
            INSERT INTO public."${table}" (${columnsEscaped}) OVERRIDING SYSTEM VALUE
            VALUES (${placeholders})
            ON CONFLICT (id) DO NOTHING
          `;
          await slClient.query(insertSQL, values);
        }
        console.log(`- Successfully synced rows for ${table}.`);

        // Synchronize sequence
        const seqRes = await slClient.query(`
          SELECT setval(
            pg_get_serial_sequence('public."${table}"', 'id'), 
            coalesce(max(id), 1)
          ) FROM public."${table}"
        `);
        console.log(`- Sequence synchronized to: ${seqRes.rows[0].setval}`);
      }
    }

    // Sync notice_views (no identity column)
    {
      const table = 'notice_views';
      console.log(`🔍 Syncing missing rows for table: ${table}...`);
      const sgRowsRes = await sgClient.query(`SELECT * FROM public."${table}"`);
      const sgRows = sgRowsRes.rows;
      console.log(`- Singapore has ${sgRows.length} rows.`);

      if (sgRows.length > 0) {
        const columns = Object.keys(sgRows[0]);
        const columnsEscaped = columns.map(c => `"${c}"`).join(', ');

        for (const row of sgRows) {
          const values = columns.map(c => row[c]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const insertSQL = `
            INSERT INTO public."${table}" (${columnsEscaped})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          await slClient.query(insertSQL, values);
        }
        console.log(`- Successfully synced rows for ${table}.`);
      }
    }

    // Re-enable triggers
    await slClient.query("SET session_replication_role = 'origin';");

    console.log("------------------------------------------");
    console.log("🎉 All integrity gaps successfully fixed!");
    console.log("==========================================");

  } catch (err) {
    console.error("❌ Error while fixing integrity gaps:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

fixIntegrityGaps();
