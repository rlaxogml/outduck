import { supabase } from "./lib/supabase/client";

async function checkSchema() {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data?.[0] || {}, null, 2));
  }
}

checkSchema();
