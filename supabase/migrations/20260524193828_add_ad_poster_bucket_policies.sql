-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad_poster', 'ad_poster', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS on storage.objects just in case
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Allow public insert to ad_poster" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from ad_poster" ON storage.objects;

-- Create policies for anonymous access to ad_poster
CREATE POLICY "Allow public insert to ad_poster" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ad_poster');

CREATE POLICY "Allow public select from ad_poster" ON storage.objects
FOR SELECT USING (bucket_id = 'ad_poster');
