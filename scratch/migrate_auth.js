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

const oldUuid = '4080180c-0607-4273-b2b7-959f99b85e3a'; // 별하수's original Singapore DB UUID
const newUuid = '214b08af-535c-4270-80f2-0da6a4dae8cd'; // 별하수's temporary Seoul DB UUID

async function getWriteableColumns(client, schema, table) {
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 
      AND table_name = $2 
      AND is_generated = 'NEVER'
  `, [schema, table]);
  return res.rows.map(r => r.column_name);
}

async function runAuthMigration() {
  const source = new Client(singaporeConfig);
  const target = new Client(seoulConfig);

  try {
    await source.connect();
    await target.connect();

    console.log("Connected to both databases successfully.");

    // 1. Revert profiles table ID update (change newUuid back to oldUuid)
    console.log("Step 1: Reverting profile UUID update in public.profiles...");
    const revertProfileRes = await target.query(
      "UPDATE public.profiles SET id = $1 WHERE id = $2",
      [oldUuid, newUuid]
    );
    console.log(`Revert profile UUID: updated ${revertProfileRes.rowCount} row(s).`);

    // 2. Clean temporary user created during today's login testing from target DB
    console.log("Step 2: Cleaning temporary user from target DB auth schema...");
    await target.query("DELETE FROM auth.identities WHERE user_id = $1", [newUuid]);
    await target.query("DELETE FROM auth.users WHERE id = $1", [newUuid]);
    console.log("Cleaned temporary login testing user.");

    // 3. Get writeable columns in target
    console.log("Step 3: Finding writeable columns in target DB...");
    const targetUserCols = await getWriteableColumns(target, 'auth', 'users');
    const targetIdentityCols = await getWriteableColumns(target, 'auth', 'identities');
    
    // Get columns in source to find intersection
    const sourceUserColsRes = await source.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'users'
    `);
    const sourceUserCols = sourceUserColsRes.rows.map(r => r.column_name);

    const sourceIdentityColsRes = await source.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'auth' AND table_name = 'identities'
    `);
    const sourceIdentityCols = sourceIdentityColsRes.rows.map(r => r.column_name);

    // Compute intersection
    const userColumnsToMigrate = targetUserCols.filter(c => sourceUserCols.includes(c));
    const identityColumnsToMigrate = targetIdentityCols.filter(c => sourceIdentityCols.includes(c));

    console.log("Users columns to migrate:", userColumnsToMigrate);
    console.log("Identities columns to migrate:", identityColumnsToMigrate);

    // 4. Fetch and insert auth.users
    console.log("Step 4: Copying auth.users...");
    const userSelectCols = userColumnsToMigrate.map(c => `"${c}"`).join(', ');
    const usersRes = await source.query(`SELECT ${userSelectCols} FROM auth.users`);
    const users = usersRes.rows;
    console.log(`Found ${users.length} users in source auth.users.`);

    if (users.length > 0) {
      const userColsEscaped = userColumnsToMigrate.map(c => `"${c}"`).join(', ');
      
      for (const user of users) {
        const values = userColumnsToMigrate.map(c => user[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const insertUserSQL = `
          INSERT INTO auth.users (${userColsEscaped}) 
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET 
            email = EXCLUDED.email,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = EXCLUDED.updated_at;
        `;
        await target.query(insertUserSQL, values);
      }
      console.log("Successfully migrated auth.users.");
    }

    // 5. Fetch and insert auth.identities
    console.log("Step 5: Copying auth.identities...");
    const identitySelectCols = identityColumnsToMigrate.map(c => `"${c}"`).join(', ');
    const identitiesRes = await source.query(`SELECT ${identitySelectCols} FROM auth.identities`);
    const identities = identitiesRes.rows;
    console.log(`Found ${identities.length} identities in source auth.identities.`);

    if (identities.length > 0) {
      const identityColsEscaped = identityColumnsToMigrate.map(c => `"${c}"`).join(', ');

      for (const identity of identities) {
        const values = identityColumnsToMigrate.map(c => identity[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const insertIdentitySQL = `
          INSERT INTO auth.identities (${identityColsEscaped}) 
          VALUES (${placeholders})
          ON CONFLICT (provider, provider_id) DO UPDATE SET 
            identity_data = EXCLUDED.identity_data,
            updated_at = EXCLUDED.updated_at;
        `;
        await target.query(insertIdentitySQL, values);
      }
      console.log("Successfully migrated auth.identities.");
    }

    console.log("\n==============================================");
    console.log("🎉 Auth Schema Migration completed successfully!");
    console.log("==============================================");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await source.end();
    await target.end();
  }
}

runAuthMigration();
