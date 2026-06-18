const { Client } = require('pg');

const sourceConfig = {
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

async function tryConnectTarget() {
  const possibleConfigs = [
    {
      host: '13.124.111.232', // aws-0-ap-northeast-2.pooler.supabase.com
      port: 5432,
      user: 'postgres.hdazhucnjpfbgkhtoqnx',
      password: 'wZ6ST3YzeHhhdB0P',
      database: 'postgres',
      ssl: {
        servername: 'aws-0-ap-northeast-2.pooler.supabase.com',
        rejectUnauthorized: false
      }
    },
    {
      host: '3.39.47.126', // aws-1-ap-northeast-2.pooler.supabase.com
      port: 5432,
      user: 'postgres.hdazhucnjpfbgkhtoqnx',
      password: 'wZ6ST3YzeHhhdB0P',
      database: 'postgres',
      ssl: {
        servername: 'aws-1-ap-northeast-2.pooler.supabase.com',
        rejectUnauthorized: false
      }
    }
  ];

  for (const config of possibleConfigs) {
    const target = new Client(config);
    try {
      console.log(`Trying to connect to target IP: ${config.host} (${config.ssl.servername})...`);
      await target.connect();
      return target; // Return active connected client
    } catch (err) {
      console.log(`Connection to target failed on IP ${config.host}:`, err.message);
      try { await target.end(); } catch (e) {}
    }
  }
  throw new Error('All target DB connection attempts failed.');
}

async function migrate() {
  const source = new Client(sourceConfig);
  let target;

  try {
    console.log('Connecting to Source Database (Singapore)...');
    await source.connect();
    
    console.log('Connecting to Target Database (Seoul)...');
    target = await tryConnectTarget();
    console.log('Connected to both databases successfully!');

    // 0. Clean target database public schema to prevent duplicate key or constraint errors
    console.log('Cleaning target database public schema (drop and recreate)...');
    await target.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await target.query('CREATE SCHEMA public;');
    await target.query('GRANT ALL ON SCHEMA public TO postgres;');
    await target.query('GRANT ALL ON SCHEMA public TO public;');

    // 1. Get list of tables in public schema from Source
    const tablesRes = await source.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tables to migrate:', tables);

    // 2. Disable target triggers to prevent side effects during data load
    await target.query('SET session_replication_role = \'replica\';');

    // 3. Migrate sequences (must be created before table columns using them as defaults)
    console.log('Migrating sequences...');
    const sequencesRes = await source.query(`
      SELECT c.relname AS sequence_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname = 'public'
    `);
    for (const seq of sequencesRes.rows) {
      console.log(`Creating sequence: ${seq.sequence_name}`);
      try {
        await target.query(`CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}";`);
      } catch (err) {
        console.warn(`Warning while creating sequence ${seq.sequence_name}:`, err.message);
      }
    }

    // 4. Migrate user defined functions (first, because triggers depend on functions)
    console.log('Migrating custom functions...');
    const functionsRes = await source.query(`
      SELECT pg_get_functiondef(p.oid) AS definition, p.proname
      FROM pg_proc p
      LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.probin IS NULL -- Exclude C-language or internal functions
    `);
    for (const row of functionsRes.rows) {
      if (row.definition) {
        console.log(`Creating function: ${row.proname}`);
        try {
          await target.query(row.definition);
        } catch (err) {
          console.warn(`Warning while creating function ${row.proname}:`, err.message);
        }
      }
    }

    // 5. Extract table schemas and recreate tables on Target (without foreign keys first)
    console.log('Creating tables on target database...');
    const tableDefinitions = {};
    for (const table of tables) {
      // Get column details
      const columnsRes = await source.query(`
        SELECT 
          column_name, 
          data_type, 
          udt_name,
          character_maximum_length, 
          is_nullable, 
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      // Get primary keys
      const pkRes = await source.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_name = $1
      `, [table]);
      const pks = pkRes.rows.map(r => r.column_name);

      let columnDefs = [];
      for (const col of columnsRes.rows) {
        let def = `"${col.column_name}" `;
        
        // Handle types (especially CJK custom types or enums)
        if (col.data_type === 'USER-DEFINED') {
          def += col.udt_name;
        } else if (col.data_type === 'ARRAY') {
          def += `${col.udt_name.replace(/^_/, '')}[]`;
        } else {
          def += col.data_type;
          if (col.character_maximum_length) {
            def += `(${col.character_maximum_length})`;
          }
        }

        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }

        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        columnDefs.push(def);
      }

      if (pks.length > 0) {
        columnDefs.push(`CONSTRAINT "${table}_pkey" PRIMARY KEY (${pks.map(k => `"${k}"`).join(', ')})`);
      }

      const createTableSQL = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${columnDefs.join(',\n  ')}\n);`;
      console.log(`Recreating structure for: ${table}`);
      await target.query(createTableSQL);
      tableDefinitions[table] = createTableSQL;
    }

    // 6. Migrate actual data
    console.log('Migrating table data...');
    for (const table of tables) {
      console.log(`Migrating data for: ${table}`);
      const dataRes = await source.query(`SELECT * FROM "${table}"`);
      const rows = dataRes.rows;
      if (rows.length === 0) {
        console.log(`Table ${table} is empty. Skipping data insert.`);
        continue;
      }

      const columns = Object.keys(rows[0]);
      const columnNamesEscaped = columns.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const insertSQL = `INSERT INTO "${table}" (${columnNamesEscaped}) VALUES (${placeholders});`;
        await target.query(insertSQL, values);
      }
      console.log(`Successfully migrated ${rows.length} rows for table ${table}`);
    }

    // 7. Sync Sequence Last Values
    console.log('Synchronizing sequence values...');
    for (const seq of sequencesRes.rows) {
      const seqName = seq.sequence_name;
      // Get the table and column name linked to this sequence
      const dependencyRes = await source.query(`
        SELECT 
          t.relname AS table_name,
          a.attname AS column_name
        FROM pg_depend d
        JOIN pg_class s ON s.oid = d.objid
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
        WHERE s.relname = $1 AND s.relkind = 'S'
      `, [seqName]);

      if (dependencyRes.rows.length > 0) {
        const { table_name, column_name } = dependencyRes.rows[0];
        console.log(`Setting sequence val for ${seqName} based on MAX(${column_name}) of ${table_name}`);
        
        const maxValRes = await target.query(`SELECT COALESCE(MAX("${column_name}"), 1) as max_val FROM "${table_name}"`);
        const maxVal = maxValRes.rows[0].max_val;
        
        await target.query(`SELECT setval('"${seqName}"', ${maxVal});`);
      }
    }

    // 8. Migrate foreign key constraints
    console.log('Migrating foreign key constraints...');
    const fksRes = await source.query(`
      SELECT
        tc.constraint_name, 
        tc.table_name,
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);

    for (const fk of fksRes.rows) {
      console.log(`Adding constraint ${fk.constraint_name} to ${fk.table_name}`);
      const addFkSQL = `
        ALTER TABLE "${fk.table_name}" 
        ADD CONSTRAINT "${fk.constraint_name}" 
        FOREIGN KEY ("${fk.column_name}") 
        REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}")
        ON UPDATE CASCADE ON DELETE CASCADE;
      `;
      try {
        await target.query(addFkSQL);
      } catch (err) {
        console.warn(`Warning while adding FK ${fk.constraint_name}:`, err.message);
      }
    }

    // 9. Migrate Indexes
    console.log('Migrating indexes...');
    const indexesRes = await source.query(`
      SELECT indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND indexdef NOT LIKE '%_pkey%' -- Skip PK indexes
    `);
    for (const row of indexesRes.rows) {
      if (row.indexdef) {
        console.log(`Executing: ${row.indexdef}`);
        try {
          await target.query(row.indexdef);
        } catch (err) {
          console.warn('Warning while creating index:', err.message);
        }
      }
    }

    // 10. Migrate Triggers
    console.log('Migrating triggers...');
    const triggerDefsRes = await source.query(`
      SELECT 
        t.tgname AS trigger_name,
        c.relname AS table_name,
        pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.tgisinternal = false
    `);

    for (const row of triggerDefsRes.rows) {
      if (row.definition) {
        console.log(`Creating trigger ${row.trigger_name} on ${row.table_name}`);
        try {
          await target.query(row.definition);
        } catch (err) {
          console.warn(`Warning while creating trigger ${row.trigger_name}:`, err.message);
        }
      }
    }

    // 11. Re-enable Target Triggers / Rules
    await target.query('SET session_replication_role = \'origin\';');

    // 12. Migrate RLS (Row Level Security) and Policies
    console.log('Enabling Row Level Security and migrating policies...');
    const rlsRes = await source.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
    `);
    for (const table of rlsRes.rows) {
      if (table.rowsecurity) {
        console.log(`Enabling RLS on: ${table.tablename}`);
        await target.query(`ALTER TABLE "${table.tablename}" ENABLE ROW LEVEL SECURITY;`);
      }
    }

    const policiesRes = await source.query(`
      SELECT policyname, tablename, cmd, roles, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public'
    `);
    for (const row of policiesRes.rows) {
      let rolesStr = 'public';
      if (row.roles) {
        if (Array.isArray(row.roles)) {
          rolesStr = row.roles.join(', ');
        } else if (typeof row.roles === 'string') {
          rolesStr = row.roles.replace(/[{}]/g, '').split(',').map(r => r.trim()).join(', ');
        } else {
          rolesStr = String(row.roles);
        }
      }
      
      let qualStr = row.qual ? `USING (${row.qual})` : '';
      let withCheckStr = row.with_check ? `WITH CHECK (${row.with_check})` : '';
      
      const createPolicySQL = `
        CREATE POLICY "${row.policyname}" ON "${row.tablename}"
        FOR ${row.cmd}
        TO ${rolesStr}
        ${qualStr}
        ${withCheckStr};
      `;
      
      console.log(`Creating policy ${row.policyname} on ${row.tablename}`);
      try {
        await target.query(createPolicySQL);
      } catch (err) {
        console.warn(`Warning while creating policy ${row.policyname}:`, err.message);
      }
    }

    // 13. Grant privileges on schema public to Supabase API roles (postgres, anon, authenticated, service_role)
    console.log('Granting privileges on schema public to Supabase API roles...');
    await target.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;');
    await target.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;');
    await target.query('GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;');

    console.log('==============================================');
    console.log('🎉 Database Migration completed successfully!');
    console.log('==============================================');

  } catch (error) {
    console.error('❌ Migration failed with error:', error);
  } finally {
    if (source) await source.end();
    if (target) await target.end();
  }
}

migrate();
