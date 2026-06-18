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

async function runIntegrityCheck() {
  const sgClient = new Client(singaporeConfig);
  const slClient = new Client(seoulConfig);

  try {
    await sgClient.connect();
    await slClient.connect();

    console.log("Connected to both databases successfully.");
    console.log("==========================================");
    console.log("🔍 Starting Database Integrity Comparison...");
    console.log("==========================================\n");

    // 1. Check Views
    console.log("1️⃣ Checking Views...");
    const viewQuery = `
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
    `;
    const sgViews = (await sgClient.query(viewQuery)).rows.map(r => r.table_name);
    const slViews = (await slClient.query(viewQuery)).rows.map(r => r.table_name);
    console.log(`- Singapore Views (${sgViews.length}):`, sgViews);
    console.log(`- Seoul Views (${slViews.length}):`, slViews);
    const missingViews = sgViews.filter(v => !slViews.includes(v));
    if (missingViews.length > 0) {
      console.warn(`⚠️ MISSING VIEWS in Seoul:`, missingViews);
    } else {
      console.log(`✅ No views missing.`);
    }
    console.log("");

    // 2. Check Custom User-Defined Types (Enums, etc.)
    console.log("2️⃣ Checking Custom Types (Enums/Domains)...");
    const typeQuery = `
      SELECT t.typname AS type_name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' 
        AND t.typtype = 'e' -- 'e' stands for enum type
    `;
    const sgTypes = (await sgClient.query(typeQuery)).rows.map(r => r.type_name);
    const slTypes = (await slClient.query(typeQuery)).rows.map(r => r.type_name);
    console.log(`- Singapore Custom Types (${sgTypes.length}):`, sgTypes);
    console.log(`- Seoul Custom Types (${slTypes.length}):`, slTypes);
    const missingTypes = sgTypes.filter(t => !slTypes.includes(t));
    if (missingTypes.length > 0) {
      console.warn(`⚠️ MISSING TYPES in Seoul:`, missingTypes);
    } else {
      console.log(`✅ No custom types missing.`);
    }
    console.log("");

    // 3. Check Row Counts in all Tables
    console.log("3️⃣ Checking Table Row Counts...");
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
      ORDER BY table_name
    `;
    const sgTables = (await sgClient.query(tableQuery)).rows.map(r => r.table_name);
    const slTables = (await slClient.query(tableQuery)).rows.map(r => r.table_name);
    
    const countDifferences = [];
    for (const table of sgTables) {
      if (!slTables.includes(table)) {
        countDifferences.push({ table, sgCount: 'Missing', slCount: 'Missing' });
        continue;
      }
      const sgCount = parseInt((await sgClient.query(`SELECT count(*) FROM public."${table}"`)).rows[0].count, 10);
      const slCount = parseInt((await slClient.query(`SELECT count(*) FROM public."${table}"`)).rows[0].count, 10);
      if (sgCount !== slCount) {
        countDifferences.push({ table, sgCount, slCount });
      }
    }
    
    if (countDifferences.length > 0) {
      console.warn(`⚠️ TABLE ROW COUNT DIFFERENCES / MISSING TABLES:`);
      console.table(countDifferences);
    } else {
      console.log(`✅ All tables have exactly matching row counts.`);
    }
    console.log("");

    // 4. Check Custom Functions Count
    console.log("4️⃣ Checking Custom Functions...");
    const funcQuery = `
      SELECT p.proname AS func_name
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.probin IS NULL
    `;
    const sgFuncs = (await sgClient.query(funcQuery)).rows.map(r => r.func_name);
    const slFuncs = (await slClient.query(funcQuery)).rows.map(r => r.func_name);
    console.log(`- Singapore Functions (${sgFuncs.length})`);
    console.log(`- Seoul Functions (${slFuncs.length})`);
    const missingFuncs = sgFuncs.filter(f => !slFuncs.includes(f));
    if (missingFuncs.length > 0) {
      console.warn(`⚠️ MISSING FUNCTIONS in Seoul:`, missingFuncs);
    } else {
      console.log(`✅ No custom functions missing.`);
    }
    console.log("");

    // 5. Check Triggers Count
    console.log("5️⃣ Checking Triggers...");
    const trigQuery = `
      SELECT t.tgname AS trigger_name, c.relname AS table_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND t.tgisinternal = false
    `;
    const sgTrigs = (await sgClient.query(trigQuery)).rows.map(r => `${r.table_name}.${r.trigger_name}`);
    const slTrigs = (await slClient.query(trigQuery)).rows.map(r => `${r.table_name}.${r.trigger_name}`);
    console.log(`- Singapore Triggers (${sgTrigs.length})`);
    console.log(`- Seoul Triggers (${slTrigs.length})`);
    const missingTrigs = sgTrigs.filter(t => !slTrigs.includes(t));
    if (missingTrigs.length > 0) {
      console.warn(`⚠️ MISSING TRIGGERS in Seoul:`, missingTrigs);
    } else {
      console.log(`✅ No triggers missing.`);
    }
    console.log("");

    // 6. Check RLS Policies Count
    console.log("6️⃣ Checking RLS Policies...");
    const policyQuery = `
      SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    `;
    const sgPolicies = (await sgClient.query(policyQuery)).rows.map(r => `${r.tablename}.${r.policyname}`);
    const slPolicies = (await slClient.query(policyQuery)).rows.map(r => `${r.tablename}.${r.policyname}`);
    console.log(`- Singapore Policies (${sgPolicies.length})`);
    console.log(`- Seoul Policies (${slPolicies.length})`);
    const missingPolicies = sgPolicies.filter(p => !slPolicies.includes(p));
    if (missingPolicies.length > 0) {
      console.warn(`⚠️ MISSING POLICIES in Seoul:`, missingPolicies);
    } else {
      console.log(`✅ No RLS policies missing.`);
    }
    console.log("");

    console.log("==========================================");
    console.log("🎉 Integrity Check Completed!");
    console.log("==========================================");

  } catch (err) {
    console.error("Integrity check failed with error:", err);
  } finally {
    await sgClient.end();
    await slClient.end();
  }
}

runIntegrityCheck();
