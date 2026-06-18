const { Client } = require('pg');

const seoulConfig = {
  host: '3.39.47.126',
  port: 5432,
  user: 'postgres.hdazhucnjpfbgkhtoqnx',
  password: 'wZ6ST3YzeHhhdB0P',
  database: 'postgres',
  ssl: {
    servername: 'aws-1-ap-northeast-2.pooler.supabase.com',
    rejectUnauthorized: false
  }
};

async function cleanOrphanedNotices() {
  const client = new Client(seoulConfig);
  try {
    await client.connect();

    console.log("Deleting orphaned notices with event_id = 35 from Seoul DB...");
    const resNotices = await client.query("DELETE FROM public.channel_notices WHERE event_id = 35");
    console.log(`Deleted ${resNotices.rowCount} row(s) from channel_notices.`);

    console.log("Deleting orphaned notice_views from Seoul DB...");
    const resViews = await client.query("DELETE FROM public.notice_views WHERE notice_id NOT IN (SELECT id FROM public.channel_notices)");
    console.log(`Deleted ${resViews.rowCount} row(s) from notice_views.`);

  } catch (err) {
    console.error("Error cleaning notices:", err);
  } finally {
    await client.end();
  }
}

cleanOrphanedNotices();
