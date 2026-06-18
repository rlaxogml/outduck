const dns = require('dns');
const https = require('https');
const { performance } = require('perf_hooks');

const hosts = {
  Singapore: 'maasnwelbrkjepurhiom.supabase.co',
  Seoul: 'hdazhucnjpfbgkhtoqnx.supabase.co'
};

function lookupPromise(host) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    dns.lookup(host, (err, address) => {
      const t1 = performance.now();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, time: t1 - t0, address });
      }
    });
  });
}

function requestLatencyPromise(host) {
  return new Promise((resolve) => {
    const reqStart = performance.now();
    let dnsTime = 0;
    let connectTime = 0;
    let sslTime = 0;
    let ttfb = 0;
    let totalTime = 0;

    const req = https.request({
      hostname: host,
      path: '/rest/v1/',
      method: 'GET',
      headers: {
        'apikey': 'dummy',
      },
      timeout: 5000
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        totalTime = performance.now() - reqStart;
        resolve({
          success: true,
          dnsTime,
          tcpTime: connectTime - dnsTime,
          sslTime: sslTime - connectTime,
          ttfb: ttfb - sslTime,
          totalTime
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        dnsTime = performance.now() - reqStart;
      });
      socket.on('connect', () => {
        connectTime = performance.now() - reqStart;
      });
      socket.on('secureConnect', () => {
        sslTime = performance.now() - reqStart;
      });
    });

    req.on('response', () => {
      ttfb = performance.now() - reqStart;
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function testAll() {
  console.log("=== Supabase HTTP API Ping Latency Comparison ===\n");

  for (const [name, host] of Object.entries(hosts)) {
    console.log(`📡 [${name}] Testing to ${host}...`);
    
    // DNS Lookup
    const dnsRes = await lookupPromise(host);
    if (dnsRes.success) {
      console.log(`   DNS Lookup:       ${dnsRes.time.toFixed(1)}ms (IP: ${dnsRes.address})`);
    } else {
      console.log(`   DNS Lookup:       Failed (${dnsRes.error})`);
    }

    // HTTP Request
    const httpRes = await requestLatencyPromise(host);
    if (httpRes.success) {
      console.log(`   TCP Connection:   ${httpRes.tcpTime.toFixed(1)}ms`);
      console.log(`   SSL Handshake:    ${httpRes.sslTime.toFixed(1)}ms`);
      console.log(`   Time to First Byte: ${httpRes.ttfb.toFixed(1)}ms`);
      console.log(`   💡 Total Response:   ${httpRes.totalTime.toFixed(1)}ms`);
    } else {
      console.log(`   ❌ Connection:     Failed (${httpRes.error})`);
    }
    console.log("");
  }
  console.log("=================================================");
}

testAll();
