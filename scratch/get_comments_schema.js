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
const pathName = '/rest/v1/'; // OpenAPI spec is available at the root rest/v1/

const options = {
  hostname: hostname,
  path: pathName,
  method: 'GET',
  headers: {
    'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Accept': 'application/openapi+json'
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
      const commentsSchema = parsed.paths['/comments'];
      const commentsDefs = parsed.definitions?.comments;
      console.log("COMMENTS PATH SCHEMA:", JSON.stringify(commentsSchema, null, 2));
      console.log("COMMENTS PROPERTIES:", JSON.stringify(commentsDefs?.properties, null, 2));
    } catch (e) {
      console.log("Error parsing JSON:", e.message);
      console.log("Response headers:", res.headers);
      console.log("Response body (raw):", body.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error("HTTP Request Error:", e);
});

req.end();
