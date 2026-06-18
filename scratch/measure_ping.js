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
  host: '13.124.111.232', // aws-0-ap-northeast-2.pooler.supabase.com
  port: 5432,
  user: 'postgres.hdazhucnjpfbgkhtoqnx',
  password: 'wZ6ST3YzeHhhdB0P',
  database: 'postgres',
  ssl: {
    servername: 'aws-0-ap-northeast-2.pooler.supabase.com',
    rejectUnauthorized: false
  }
};

async function measureLatency(name, config) {
  console.log(`\n⚡ Measuring latency for ${name}...`);
  const client = new Client(config);
  
  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`   [${name}] Connection established in ${connectTime}ms`);

    const queryStartTime = Date.now();
    await client.query('SELECT 1');
    const queryTime = Date.now() - queryStartTime;
    console.log(`   [${name}] Simple query (SELECT 1) execution took ${queryTime}ms`);
    
    await client.end();
    const totalTime = Date.now() - startTime;
    console.log(`   [${name}] Total roundtrip time: ${totalTime}ms`);
    return { connectTime, queryTime, totalTime };
  } catch (err) {
    console.error(`   ❌ [${name}] Error:`, err.message);
    try { await client.end(); } catch (e) {}
    return null;
  }
}

async function run() {
  console.log("=== DB Connection & Query Latency Comparison ===");
  
  const singaporeResult = await measureLatency("Singapore DB (Old)", singaporeConfig);
  const seoulResult = await measureLatency("Seoul DB (New)", seoulConfig);
  
  console.log("\n================ Summary ================");
  if (singaporeResult && seoulResult) {
    const diff = singaporeResult.totalTime - seoulResult.totalTime;
    const speedup = (singaporeResult.totalTime / seoulResult.totalTime).toFixed(1);
    console.log(`📍 Singapore Total Time : ${singaporeResult.totalTime}ms`);
    console.log(`📍 Seoul Total Time     : ${seoulResult.totalTime}ms`);
    console.log(`🚀 Seoul is ${diff}ms faster (${speedup}x speed improvement!)`);
  } else {
    console.log("Could not measure latency for one or both servers.");
  }
  console.log("=========================================");
}

run();
