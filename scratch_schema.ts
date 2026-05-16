import { supabase } from "./lib/supabase/client";

async function getCols() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'notifications' });
  console.log(data, error);
}
getCols();
