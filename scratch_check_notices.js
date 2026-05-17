const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://maasnwelbrkjepurhiom.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYXNud2VsYnJramVwdXJoaW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODA1NzQsImV4cCI6MjA5MDM1NjU3NH0.ITlf2KdzmOYlde_63eLp-mmtfak9f8ch4qnXPQAvfTM'
);

async function check() {
  const { data, error } = await supabase
    .from('channel_notices')
    .select('*')
    .limit(1);
  console.log('Notice data:', data);
  console.log('Notice error:', error);
}
check();
