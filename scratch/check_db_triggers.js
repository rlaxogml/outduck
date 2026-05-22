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

async function check() {
  console.log('Querying triggers via custom query if possible...');
  
  // Let's query notifications or check if there's any trigger on channel_requests
  // We can call an RPC to list triggers, or we can check the table structure of channels.
  // Actually, let's insert a pending request, update it to approved, and see if it automatically creates a channel!
  
  console.log('\n1. Creating a channel request...');
  const { data: requestData, error: insertErr } = await supabase
    .from('channel_requests')
    .insert([{
      user_id: '4080180c-0607-4273-b2b7-959f99b85e3a',
      name: 'Temp Trigger Test',
      type: 'youtuber',
      company: '태스트',
      company_id: 2,
      status: 'pending',
      request_type: 'organizer'
    }])
    .select();

  if (insertErr) {
    console.error('Insert failed:', insertErr);
    return;
  }

  const req = requestData[0];
  console.log('Created pending request ID:', req.id);

  console.log('\n2. Updating status to approved...');
  const { error: updateErr } = await supabase
    .from('channel_requests')
    .update({ status: 'approved' })
    .eq('id', req.id);

  if (updateErr) {
    console.error('Update failed:', updateErr);
  } else {
    console.log('Updated to approved successfully.');
  }

  console.log('\n3. Waiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n4. Checking if a channel was automatically created with name "Temp Trigger Test"...');
  const { data: channels, error: chanErr } = await supabase
    .from('channels')
    .select('*')
    .eq('name', 'Temp Trigger Test');

  console.log('Channels found:', channels, chanErr);

  console.log('\n5. Cleaning up...');
  await supabase.from('channel_requests').delete().eq('id', req.id);
  if (channels && channels.length > 0) {
    await supabase.from('channels').delete().eq('id', channels[0].id);
    console.log('Deleted auto-created channel.');
  }
}

check();
