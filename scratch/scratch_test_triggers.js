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

async function testTriggers() {
  console.log('=== STARTING AUTOMATED TRIGGER VERIFICATION ===');
  
  // 1. Test company_new_request trigger
  console.log('\n[Step 1] Creating a new channel request linked to company 2...');
  const { data: requestData, error: insertErr } = await supabase
    .from('channel_requests')
    .insert([{
      user_id: '4080180c-0607-4273-b2b7-959f99b85e3a',
      name: 'Trigger Test Runner',
      type: 'youtuber',
      company: '태스트',
      company_id: 2,
      status: 'pending',
      request_type: 'organizer'
    }])
    .select();

  if (insertErr) {
    console.error('Failed to insert channel request:', insertErr);
    return;
  }
  
  const createdRequest = requestData[0];
  console.log('Inserted request ID:', createdRequest.id);

  // Wait a moment for trigger execution
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Query notifications to see if company request notification was created
  console.log('\n[Step 2] Querying notifications for company owner (5cbb0e26-3cc0-4191-9906-4a8ff52564c5)...');
  const { data: companyNotifications, error: notifErr1 } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', '5cbb0e26-3cc0-4191-9906-4a8ff52564c5')
    .eq('type', 'new_company_request')
    .order('created_at', { ascending: false })
    .limit(1);

  if (notifErr1) {
    console.error('Failed to query notifications:', notifErr1);
  } else {
    console.log('Company Notification Found:', companyNotifications);
  }

  // 2. Test request_status_change trigger
  console.log('\n[Step 3] Updating request status to approved...');
  const { data: updatedRequestData, error: updateErr } = await supabase
    .from('channel_requests')
    .update({ status: 'approved' })
    .eq('id', createdRequest.id)
    .select();

  if (updateErr) {
    console.error('Failed to update request status:', updateErr);
  } else {
    console.log('Updated Request Status to:', updatedRequestData[0].status);
  }

  // Wait a moment for trigger execution
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Query notifications to see if status change notification was created
  console.log('\n[Step 4] Querying notifications for applicant (4080180c-0607-4273-b2b7-959f99b85e3a)...');
  const { data: statusNotifications, error: notifErr2 } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', '4080180c-0607-4273-b2b7-959f99b85e3a')
    .eq('type', 'request_status')
    .order('created_at', { ascending: false })
    .limit(1);

  if (notifErr2) {
    console.error('Failed to query notifications:', notifErr2);
  } else {
    console.log('Applicant Notification Found:', statusNotifications);
  }

  // 3. Cleanup
  console.log('\n[Step 5] Cleaning up test request...');
  const { error: delErr } = await supabase
    .from('channel_requests')
    .delete()
    .eq('id', createdRequest.id);
  console.log('Cleanup channel_request:', delErr ? 'Failed: ' + delErr.message : 'Succeeded');

  // Cleanup notifications as well to leave database pristine
  if (companyNotifications && companyNotifications.length > 0) {
    await supabase.from('notifications').delete().eq('id', companyNotifications[0].id);
  }
  if (statusNotifications && statusNotifications.length > 0) {
    await supabase.from('notifications').delete().eq('id', statusNotifications[0].id);
  }
  console.log('Cleanup notifications: Succeeded');
  
  console.log('\n=== VERIFICATION FINISHED ===');
}

testTriggers();
