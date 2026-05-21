const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://maasnwelbrkjepurhiom.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYXNud2VsYnJramVwdXJoaW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODA1NzQsImV4cCI6MjA5MDM1NjU3NH0.ITlf2KdzmOYlde_63eLp-mmtfak9f8ch4qnXPQAvfTM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Notifications query failed:', error);
  } else {
    console.log('Notifications query succeeded, table exists!', data);
  }
}

check();
