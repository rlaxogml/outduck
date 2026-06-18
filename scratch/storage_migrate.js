const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read new credentials from local .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const sourceUrl = 'https://maasnwelbrkjepurhiom.supabase.co';
const sourceServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYXNud2VsYnJramVwdXJoaW9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc4MDU3NCwiZXhwIjoyMDkwMzU2NTc0fQ.VXpxT4UxSURpVLzof1VIJ0PhOwO252CXXl3ZD6nUNu8';

const targetUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const targetServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetServiceKey) {
  console.error('❌ Error: Could not load target Supabase URL or Service Role Key from .env.local');
  process.exit(1);
}

const sourceSupabase = createClient(sourceUrl, sourceServiceKey);
const targetSupabase = createClient(targetUrl, targetServiceKey);

// Helper to recursively list all files in a Supabase Storage bucket
async function listAllFiles(supabase, bucketName, folderPath = '') {
  let files = [];
  const { data, error } = await supabase.storage.from(bucketName).list(folderPath, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    console.error(`Error listing files in ${bucketName}/${folderPath}:`, error.message);
    return [];
  }

  for (const item of data) {
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.id === null) {
      // It's a folder, traverse recursively
      const subFiles = await listAllFiles(supabase, bucketName, fullPath);
      files = files.concat(subFiles);
    } else {
      // It's a file
      files.push({
        name: item.name,
        path: fullPath,
        metadata: item.metadata
      });
    }
  }

  return files;
}

async function migrateStorage() {
  console.log('Initiating Storage Migration...');
  console.log(`Source Storage: ${sourceUrl}`);
  console.log(`Target Storage: ${targetUrl}`);

  try {
    // 1. Get all buckets from source
    const { data: buckets, error: bucketError } = await sourceSupabase.storage.listBuckets();
    if (bucketError) throw bucketError;

    console.log(`Found ${buckets.length} buckets to migrate:`, buckets.map(b => b.name));

    for (const bucket of buckets) {
      console.log(`\n========================================`);
      console.log(`📦 Processing Bucket: ${bucket.name}`);
      console.log(`========================================`);

      // 2. Ensure bucket exists on target
      const { data: targetBuckets, error: targetBucketsErr } = await targetSupabase.storage.listBuckets();
      if (targetBucketsErr) throw targetBucketsErr;

      const exists = targetBuckets.some(b => b.name === bucket.name);
      if (!exists) {
        console.log(`Creating bucket ${bucket.name} on target...`);
        const { error: createErr } = await targetSupabase.storage.createBucket(bucket.name, {
          public: bucket.public,
          fileSizeLimit: bucket.file_size_limit,
          allowedMimeTypes: bucket.allowed_mime_types
        });
        if (createErr) {
          console.error(`Failed to create bucket ${bucket.name}:`, createErr.message);
          continue;
        }
        console.log(`Bucket ${bucket.name} created successfully.`);
      } else {
        console.log(`Bucket ${bucket.name} already exists on target.`);
      }

      // 3. List all files in the source bucket
      console.log(`Listing all files in bucket ${bucket.name}...`);
      const files = await listAllFiles(sourceSupabase, bucket.name);
      console.log(`Found ${files.length} files in bucket ${bucket.name}`);

      // 4. Download and upload each file
      for (const file of files) {
        console.log(`Migrating file: ${file.path}`);
        
        // Download from source
        const { data: blob, error: downloadErr } = await sourceSupabase.storage
          .from(bucket.name)
          .download(file.path);

        if (downloadErr) {
          console.error(`❌ Failed to download ${file.path} from source:`, downloadErr.message);
          continue;
        }

        // Upload to target
        const contentType = file.metadata?.mimetype || 'application/octet-stream';
        const { error: uploadErr } = await targetSupabase.storage
          .from(bucket.name)
          .upload(file.path, blob, {
            contentType: contentType,
            upsert: true
          });

        if (uploadErr) {
          console.error(`❌ Failed to upload ${file.path} to target:`, uploadErr.message);
        } else {
          console.log(`✅ Successfully migrated: ${file.path}`);
        }
      }
    }

    console.log('\n==============================================');
    console.log('🎉 Storage Migration completed successfully!');
    console.log('==============================================');

  } catch (err) {
    console.error('❌ Storage Migration failed with error:', err.message);
  }
}

migrateStorage();
