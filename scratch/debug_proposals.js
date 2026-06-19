const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
  console.log('--- Testing query logic ---');
  try {
    const { data: chanData, error: chanErr } = await supabase
      .from("channel_proposals")
      .select("*")
      .order("created_at", { ascending: false });

    if (chanErr) throw chanErr;
    console.log('1. Channels proposals successfully retrieved! Count:', chanData.length);

    const { data: eventData, error: eventErr } = await supabase
      .from("event_proposals")
      .select(`
        *,
        channel_proposals:channel_proposal_id ( id, name, type, status, approved_channel_id )
      `)
      .order("created_at", { ascending: false });

    if (eventErr) throw eventErr;
    console.log('2. Event proposals successfully retrieved! Count:', eventData.length);

    const userIds = Array.from(new Set([
      ...(chanData || []).map(c => c.user_id),
      ...(eventData || []).map(e => e.user_id)
    ].filter(Boolean)));

    const profilesMap = {};
    if (userIds.length > 0) {
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);

      if (profErr) throw profErr;
      if (profData) {
        profData.forEach(p => {
          profilesMap[p.id] = p.nickname;
        });
      }
      console.log('3. Profiles map successfully loaded! Profiles found:', profData.length);
    } else {
      console.log('3. No user_ids to look up.');
    }

    const formattedChannels = (chanData || []).map(c => ({
      ...c,
      profiles: c.user_id ? { nickname: profilesMap[c.user_id] || "알 수 없음" } : null
    }));

    const formattedEvents = (eventData || []).map(e => ({
      ...e,
      profiles: e.user_id ? { nickname: profilesMap[e.user_id] || "알 수 없음" } : null
    }));

    console.log('4. Formatting and mapping in memory successful!');
    console.log('Sample channel proposal profile:', formattedChannels[0]?.profiles);
    console.log('Sample event proposal profile:', formattedEvents[0]?.profiles);

  } catch (error) {
    console.error('Test query failed:', error);
  }
}
check();
