const dns = require('dns');
const https = require('https');
const { performance } = require('perf_hooks');

const url = 'maasnwelbrkjepurhiom.supabase.co';

async function testLatency() {
  console.log(`Testing latency to ${url}...`);

  // 1. DNS Lookup Time
  const t0 = performance.now();
  dns.lookup(url, (err, address) => {
    const t1 = performance.now();
    if (err) {
      console.error('DNS Lookup failed:', err);
      return;
    }
    console.log(`DNS Lookup took: ${(t1 - t0).toFixed(1)}ms (IP: ${address})`);
  });

  // 2. HTTPS Request timings
  const reqStart = performance.now();
  let dnsTime = 0;
  let connectTime = 0;
  let sslTime = 0;
  let ttfb = 0;
  let totalTime = 0;

  const req = https.request({
    hostname: url,
    path: '/rest/v1/',
    method: 'GET',
    headers: {
      'apikey': 'dummy',
    }
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      totalTime = performance.now() - reqStart;
      console.log('\n--- Connection Timings ---');
      console.log(`DNS Resolution:   ${dnsTime.toFixed(1)}ms`);
      console.log(`TCP Connection:   ${(connectTime - dnsTime).toFixed(1)}ms`);
      console.log(`SSL Handshake:    ${(sslTime - connectTime).toFixed(1)}ms`);
      console.log(`Time to First Byte: ${(ttfb - sslTime).toFixed(1)}ms`);
      console.log(`Total Response:   ${totalTime.toFixed(1)}ms`);
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
    console.error('HTTP request error:', e.message);
  });

  req.end();
}

testLatency();
