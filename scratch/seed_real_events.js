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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Starting DB seeding for Gaming & YouTuber (VTuber) real-world events...");

  // 1. Create or get Channels
  const channelData = [
    { name: "LCK 공식", type: "game", is_team: false, company: "LCK" },
    { name: "배틀그라운드 e스포츠", type: "game", is_team: false, company: "KRAFTON" },
    { name: "스텔라이브", type: "vtuber", is_team: true, company: "Stellive" },
    { name: "이터널 리턴 공식", type: "game", is_team: false, company: "Nimble Neuron" }
  ];

  const channelMap = {};
  for (const ch of channelData) {
    // Check if channel already exists
    const { data: existing } = await supabase.from('channels').select('id').eq('name', ch.name).maybeSingle();
    if (existing) {
      console.log(`- Channel '${ch.name}' already exists (ID: ${existing.id})`);
      channelMap[ch.name] = existing.id;
    } else {
      const { data: inserted, error } = await supabase.from('channels').insert(ch).select('id').single();
      if (error) {
        console.error(`Error inserting channel ${ch.name}:`, error);
      } else {
        console.log(`- Inserted Channel '${ch.name}' (ID: ${inserted.id})`);
        channelMap[ch.name] = inserted.id;
      }
    }
  }

  // 2. Define the Events
  const eventsToSeed = [
    {
      channelName: "LCK 공식",
      is_offline: true,
      is_online: false,
      offline_event: {
        title: "2026 LCK Road to MSI 토너먼트",
        start_date: "2026-06-06",
        end_date: "2026-06-14",
        reservation_type: "티켓팅",
        image_url: "/lck_msi.png",
        description: "<p>MSI 2026 및 Esports World Cup 진출팀을 가리는 LCK 토너먼트 매치! 종로 롤파크에서 펼쳐지는 치열한 승부를 직관하세요.</p>",
        start_time: "17:00:00",
        end_time: "22:00:00",
        is_reservation_always: false,
        links: { "티켓 예매 (인터파크)": "https://ticket.interpark.com" }
      },
      location: {
        location: "치지직 롤파크 (LoL PARK)",
        latitude: 37.5709,
        longitude: 126.9813
      },
      schedules: [
        { day_of_week: "WED", open_time: "17:00:00", close_time: "22:00:00", reservation_type: "티켓팅" },
        { day_of_week: "THU", open_time: "17:00:00", close_time: "22:00:00", reservation_type: "티켓팅" },
        { day_of_week: "FRI", open_time: "17:00:00", close_time: "22:00:00", reservation_type: "티켓팅" },
        { day_of_week: "SAT", open_time: "17:00:00", close_time: "22:00:00", reservation_type: "티켓팅" },
        { day_of_week: "SUN", open_time: "17:00:00", close_time: "22:00:00", reservation_type: "티켓팅" }
      ]
    },
    {
      channelName: "배틀그라운드 e스포츠",
      is_offline: true,
      is_online: false,
      offline_event: {
        title: "PNC 2026 팬 뷰잉 파티 및 오프라인 이벤트",
        start_date: "2026-06-12",
        end_date: "2026-06-14",
        reservation_type: "자유 입장",
        image_url: "/pnc_seongsu.png",
        description: "<p>펍지 네이션스 컵 2026 개최 기념 성수동 팬 뷰잉 파티! 현장 굿즈 증정 및 스페셜 유저 소통 행사가 진행됩니다.</p>",
        start_time: "13:00:00",
        end_time: "20:00:00",
        is_reservation_always: false,
        links: { "배그 e스포츠 공식 공지": "https://pubgesports.com" }
      },
      location: {
        location: "펍지 성수 (PUBG SEONGSU)",
        latitude: 37.5446,
        longitude: 127.0560
      },
      schedules: [
        { day_of_week: "FRI", open_time: "13:00:00", close_time: "20:00:00", reservation_type: "자유 입장" },
        { day_of_week: "SAT", open_time: "13:00:00", close_time: "20:00:00", reservation_type: "자유 입장" },
        { day_of_week: "SUN", open_time: "13:00:00", close_time: "20:00:00", reservation_type: "자유 입장" }
      ]
    },
    {
      channelName: "스텔라이브",
      is_offline: true,
      is_online: false,
      offline_event: {
        title: "아카네 리제 첫 단독 콘서트 『AKANE LIZE : OVT.』 티켓 오픈",
        start_date: "2026-06-11",
        end_date: "2026-07-11",
        reservation_type: "티켓팅",
        image_url: "/lize_concert.png",
        description: "<p>스텔라이브 소속 버튜버 아카네 리제의 첫 번째 솔로 콘서트! 고려대학교 화정체육관에서 펼쳐지는 라이브 무대를 예매하세요.</p>",
        start_time: "18:00:00",
        end_time: "21:00:00",
        is_reservation_always: false,
        links: { "일반 예매 (티켓링크)": "https://www.ticketlink.co.kr" }
      },
      location: {
        location: "고려대학교 화정체육관",
        latitude: 37.5872,
        longitude: 127.0274
      },
      schedules: [
        { day_of_week: "SAT", open_time: "18:00:00", close_time: "21:00:00", reservation_type: "티켓팅" }
      ]
    },
    {
      channelName: "이터널 리턴 공식",
      is_offline: true,
      is_online: false,
      offline_event: {
        title: "이터널 리턴 3주년 페스티벌 (루미아 야시장)",
        start_date: "2026-07-11",
        end_date: "2026-07-12",
        reservation_type: "자유 입장",
        image_url: "/eternal_return.png",
        description: "<p>이터널 리턴 서비스 3주년 기념 오프라인 페스티벌! 대전컨벤션센터에서 2차 창작 굿즈 플리마켓과 스페셜 이벤트가 열립니다.</p>",
        start_time: "10:00:00",
        end_time: "18:00:00",
        is_reservation_always: false,
        links: { "이터널 리턴 공식 공지": "https://playeternalreturn.com" }
      },
      location: {
        location: "대전컨벤션센터(DCC) 제1전시장",
        latitude: 36.3754,
        longitude: 127.3912
      },
      schedules: [
        { day_of_week: "SAT", open_time: "10:00:00", close_time: "18:00:00", reservation_type: "자유 입장" },
        { day_of_week: "SUN", open_time: "10:00:00", close_time: "18:00:00", reservation_type: "자유 입장" }
      ]
    }
  ];

  for (const item of eventsToSeed) {
    const channelId = channelMap[item.channelName];
    if (!channelId) {
      console.error(`Skipping event '${item.offline_event.title}' because channel ID wasn't found.`);
      continue;
    }

    // A. Check if the event title already exists to prevent duplicate seeds
    const { data: existingOff } = await supabase
      .from('offline_events')
      .select('id, event_id')
      .eq('title', item.offline_event.title)
      .maybeSingle();

    if (existingOff) {
      console.log(`- Event '${item.offline_event.title}' already seeded (ID: ${existingOff.id}). Skipping.`);
      continue;
    }

    // B. Insert parent 'events' row
    const { data: newEvent, error: evError } = await supabase
      .from('events')
      .insert({ is_offline: item.is_offline, is_online: item.is_online })
      .select('id')
      .single();

    if (evError) {
      console.error(`Failed to insert base event for '${item.offline_event.title}':`, evError);
      continue;
    }
    const eventId = newEvent.id;

    // C. Insert 'event_channels' mapping
    const { error: ecError } = await supabase
      .from('event_channels')
      .insert({ event_id: eventId, channel_id: channelId });

    if (ecError) {
      console.error(`Failed to insert event_channel mapping:`, ecError);
    }

    // D. Insert 'offline_events'
    const offlineEventData = {
      ...item.offline_event,
      event_id: eventId
    };
    const { data: newOffEvent, error: offError } = await supabase
      .from('offline_events')
      .insert(offlineEventData)
      .select('id')
      .single();

    if (offError) {
      console.error(`Failed to insert offline_event detail:`, offError);
      // Rollback base event
      await supabase.from('events').delete().eq('id', eventId);
      continue;
    }
    const offlineEventId = newOffEvent.id;

    // E. Insert 'offline_event_locations'
    const locationData = {
      ...item.location,
      offline_event_id: offlineEventId,
      order_num: 0
    };
    const { error: locError } = await supabase
      .from('offline_event_locations')
      .insert(locationData);

    if (locError) {
      console.error(`Failed to insert event location:`, locError);
    }

    // F. Insert 'event_schedules'
    const schedulesData = item.schedules.map(sch => ({
      ...sch,
      event_id: eventId
    }));
    const { error: schError } = await supabase
      .from('event_schedules')
      .insert(schedulesData);

    if (schError) {
      console.error(`Failed to insert schedules:`, schError);
    }

    console.log(`Successfully seeded real event: '${item.offline_event.title}' (Event ID: ${eventId}, Offline ID: ${offlineEventId})`);
  }

  console.log("DB Seeding completed successfully!");
}

main();
