-- Create storage bucket for team photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to team photos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-photos');

-- Allow public uploads for team registration (anyone can upload)
DROP POLICY IF EXISTS "Public can upload team photos" ON storage.objects;
CREATE POLICY "Public can upload team photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'team-photos');

-- Allow authenticated users to update team photos
DROP POLICY IF EXISTS "Authenticated users can update team photos" ON storage.objects;
CREATE POLICY "Authenticated users can update team photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'team-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete team photos
DROP POLICY IF EXISTS "Authenticated users can delete team photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete team photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'team-photos' 
  AND auth.role() = 'authenticated'
);
