const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://maasnwelbrkjepurhiom.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYXNud2VsYnJramVwdXJoaW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODA1NzQsImV4cCI6MjA5MDM1NjU3NH0.ITlf2KdzmOYlde_63eLp-mmtfak9f8ch4qnXPQAvfTM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- INSERT TEST (APPROVED) ---');
  const insertData = {
    user_id: '4080180c-0607-4273-b2b7-959f99b85e3a', // Valid user ID
    name: 'DB Test Channel Approved',
    type: 'youtuber',
    company: '태스트',
    company_id: 2, // Valid company ID
    status: 'approved',
    request_type: 'organizer'
  };

  const { data, error } = await supabase
    .from('channel_requests')
    .insert([insertData])
    .select();

  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert succeeded:', data);
    // Let's check if the status is 'approved' or 'pending' in the returned data
    console.log('Saved status is:', data[0].status);
    
    // Let's delete it so we don't leave garbage
    const { error: delError } = await supabase
      .from('channel_requests')
      .delete()
      .eq('id', data[0].id);
    console.log('Cleanup error:', delError);
  }
}

check();
