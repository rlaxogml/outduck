-- Create favorite channels query function with pre-calculated active event counts
CREATE OR REPLACE FUNCTION public.get_favorite_channels_with_counts(p_user_id UUID)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  type TEXT,
  image_url TEXT,
  team_id BIGINT,
  is_team BOOLEAN,
  favorite_created_at TIMESTAMPTZ,
  active_event_count INT
) 
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  now_timestamp TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
  WITH user_favs AS (
    SELECT 
      f.channel_id,
      f.created_at AS fav_created_at,
      c.name AS c_name,
      c.type AS c_type,
      c.image_url AS c_image_url,
      c.team_id AS c_team_id,
      c.is_team AS c_is_team
    FROM public.favorites f
    JOIN public.channels c ON f.channel_id = c.id
    WHERE f.user_id = p_user_id
  ),
  team_members AS (
    SELECT m.id AS member_id, m.team_id
    FROM public.channels m
    WHERE m.team_id IN (SELECT uf.channel_id FROM user_favs uf WHERE uf.c_is_team = true)
      AND m.is_team = false
  ),
  channel_relations AS (
    SELECT uf.channel_id AS fav_id, uf.channel_id AS related_id
    FROM user_favs uf
    
    UNION
    
    SELECT uf.channel_id AS fav_id, tm.member_id AS related_id
    FROM user_favs uf
    JOIN team_members tm ON uf.channel_id = tm.team_id
    WHERE uf.c_is_team = true
    
    UNION
    
    SELECT uf.channel_id AS fav_id, uf.c_team_id AS related_id
    FROM user_favs uf
    WHERE uf.c_team_id IS NOT NULL AND uf.c_is_team = false
  ),
  active_events AS (
    SELECT DISTINCT ec.channel_id, ec.event_id
    FROM public.event_channels ec
    LEFT JOIN public.offline_events off ON off.event_id = ec.event_id
    LEFT JOIN public.online_events onl ON onl.event_id = ec.event_id
    WHERE 
      (off.id IS NOT NULL AND (off.end_date >= today_date OR off.end_date IS NULL))
      OR
      (onl.id IS NOT NULL AND (onl.end_at >= now_timestamp OR onl.end_at IS NULL))
  ),
  counts AS (
    SELECT cr.fav_id, COUNT(DISTINCT ae.event_id)::INT AS cnt
    FROM channel_relations cr
    LEFT JOIN active_events ae ON cr.related_id = ae.channel_id
    GROUP BY cr.fav_id
  )
  SELECT 
    uf.channel_id::BIGINT AS id,
    uf.c_name::TEXT AS name,
    uf.c_type::TEXT AS type,
    uf.c_image_url::TEXT AS image_url,
    uf.c_team_id::BIGINT AS team_id,
    uf.c_is_team::BOOLEAN AS is_team,
    uf.fav_created_at::TIMESTAMPTZ AS favorite_created_at,
    COALESCE(co.cnt, 0)::INT AS active_event_count
  FROM user_favs uf
  LEFT JOIN counts co ON uf.channel_id = co.fav_id
  ORDER BY uf.fav_created_at DESC;
END;
$$ LANGUAGE plpgsql;
