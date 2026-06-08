const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const hostname = url.hostname;

const options = {
  hostname: hostname,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log("STATUS:", res.statusCode);
      if (res.statusCode === 200) {
        const tables = Object.keys(parsed.definitions || {});
        console.log("TABLES FOUND:", tables);
        
        // Print column definitions for each table
        tables.forEach(table => {
          const columns = Object.keys(parsed.definitions[table].properties || {});
          console.log(`\nTable: ${table}`);
          console.log(`Columns:`, columns.join(', '));
        });
      } else {
        console.log("Error response:", body);
      }
    } catch (e) {
      console.log("Error parsing JSON:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error("HTTP Request Error:", e);
});

req.end();
