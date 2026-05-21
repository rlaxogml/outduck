const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testGmailSignUp() {
  const email = `testuser${Math.floor(Math.random() * 100000)}@gmail.com`;
  const password = 'SuperSecretPassword123!';

  console.log(`Signing up user with gmail: ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }

  const user = signUpData.user;
  console.log('Sign up succeeded! User ID:', user.id);

  console.log('Attempting to insert a channel with owner_id matching our user ID...');
  const { data: testChan, error: chanErr } = await supabase
    .from('channels')
    .insert([{ 
      name: 'Test Authenticated Gmail Channel', 
      type: 'youtuber', 
      owner_id: user.id 
    }])
    .select();

  console.log('Insert Result:', { testChan, chanErr });

  if (testChan && testChan.length > 0) {
    console.log('Insert succeeded! Cleaning up...');
    await supabase.from('channels').delete().eq('id', testChan[0].id);
  }
}

testGmailSignUp();
