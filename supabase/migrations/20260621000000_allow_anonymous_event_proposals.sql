-- Drop old event_proposals insert policy
DROP POLICY IF EXISTS "Enable insert for authenticated users on event_proposals" ON public.event_proposals;

-- Create new event_proposals insert policy allowing both authenticated and anonymous users
CREATE POLICY "Enable insert for all users on event_proposals" ON public.event_proposals
  FOR INSERT WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL) OR 
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

-- Drop old channel_proposals insert policy
DROP POLICY IF EXISTS "Enable insert for authenticated users on channel_proposals" ON public.channel_proposals;

-- Create new channel_proposals insert policy allowing both authenticated and anonymous users
CREATE POLICY "Enable insert for all users on channel_proposals" ON public.channel_proposals
  FOR INSERT WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL) OR 
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );
