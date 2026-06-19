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

async function migrateStoragePolicies() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("Connected to both databases.");

    // 1. Fetch storage policies from Singapore
    console.log("Fetching RLS policies for 'storage.objects' in Singapore...");
    const sgPoliciesRes = await sgClient.query(`
      SELECT policyname, tablename, cmd, roles, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'storage'
    `);
    
    const policies = sgPoliciesRes.rows;
    console.log(`Found ${policies.length} storage RLS policies in Singapore.`);

    // 2. Drop existing custom policies on storage.objects in Seoul to avoid duplicates
    console.log("Cleaning up existing policies on storage.objects in Seoul...");
    for (const policy of policies) {
      try {
        await slClient.query(`DROP POLICY IF EXISTS "${policy.policyname}" ON storage.objects;`);
      } catch (err) {
        console.log(`Warning while dropping policy ${policy.policyname}:`, err.message);
      }
    }

    // 3. Create the policies on Seoul DB
    console.log("Creating storage policies in Seoul DB...");
    for (const policy of policies) {
      const { policyname, cmd, roles, qual, with_check } = policy;
      
      let rolesStr = 'public';
      if (roles) {
        if (Array.isArray(roles)) {
          rolesStr = roles.join(', ');
        } else if (typeof roles === 'string') {
          rolesStr = roles.replace(/[{}]/g, '').split(',').map(r => r.trim()).join(', ');
        } else {
          rolesStr = String(roles);
        }
      }

      let qualStr = qual ? `USING (${qual})` : '';
      let withCheckStr = with_check ? `WITH CHECK (${with_check})` : '';

      const createSQL = `
        CREATE POLICY "${policyname}" ON storage.objects
        FOR ${cmd}
        TO ${rolesStr}
        ${qualStr}
        ${withCheckStr};
      `;

      console.log(`⚙️ Creating storage policy: "${policyname}" for command ${cmd}...`);
      try {
        await slClient.query(createSQL);
        console.log(`   ✅ Success!`);
      } catch (err) {
        console.error(`   ❌ Failed to create policy:`, err.message);
      }
    }

    console.log("\n==============================================");
    console.log("🎉 Storage RLS Policies successfully migrated!");
    console.log("==============================================");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

migrateStoragePolicies();
