-- Migration 033: Make avatars bucket private + restrict SELECT to authenticated users
--
-- Previously the avatars bucket was public=true with an open SELECT policy,
-- meaning anyone could access any avatar URL directly and enumerate user IDs
-- via predictable filenames (/{user_id}/avatar.jpg).
--
-- After this migration:
--   - Bucket is private (direct public URLs return 403)
--   - Only authenticated users can download via direct API
--   - Signed URLs (generated server-side, 1-hour TTL) are used for display
--   - Upload/update/delete policies are unchanged (already owner-scoped)

-- Make bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'avatars';

-- Drop the old open SELECT policy
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- Authenticated users can read any avatar (needed for signed URL generation
-- and for future profile display features). Owner restriction is enforced at
-- the signed URL generation layer (service role, server-side).
CREATE POLICY "Avatars readable by authenticated users"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);
