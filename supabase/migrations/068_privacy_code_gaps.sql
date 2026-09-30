-- Migration 068: privacy gaps found in the Israeli-privacy-law review (Codex, 2026-09-30)
--
-- 1. Account deletion could FAIL: topic_syntheses.user_id and synthesis_feedback.user_id reference
--    auth.users with no ON DELETE rule, so deleting the auth user of anyone with a cached synthesis
--    was refused (NO ACTION) — leaving a half-deleted account. Now ON DELETE SET NULL: the shared
--    synthesis cache stays useful but is no longer linked to the person. (/api/delete-account also
--    detaches and deletes explicitly.)
-- 2. analytics_signals.data_json held churned_user_ids (account identifiers) that were serialized
--    into the Anthropic insights prompt and on to Slack. The signals route now stores only the
--    count; existing rows are scrubbed here.
-- 3. Avatars were readable by ANY signed-in user (and /api/avatars signed any user's file). Reads
--    are now owner-only, like upload/update/delete; the endpoint requires the owner's session.
-- 4. delete_user_account() (service role only, migration 064) detaches syntheses too.

ALTER TABLE public.topic_syntheses DROP CONSTRAINT IF EXISTS topic_syntheses_user_id_fkey;
ALTER TABLE public.topic_syntheses
  ADD CONSTRAINT topic_syntheses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.synthesis_feedback DROP CONSTRAINT IF EXISTS synthesis_feedback_user_id_fkey;
ALTER TABLE public.synthesis_feedback
  ADD CONSTRAINT synthesis_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.analytics_signals
SET data_json = data_json - 'churned_user_ids'
WHERE data_json ? 'churned_user_ids';

DROP POLICY IF EXISTS "Avatars readable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;
CREATE POLICY "Users can read their own avatar" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void AS $$
BEGIN
  -- Analytics / logs
  DELETE FROM public.page_views         WHERE user_id = user_id_to_delete;
  DELETE FROM public.search_logs        WHERE user_id = user_id_to_delete;
  DELETE FROM public.analytics_events   WHERE user_id = user_id_to_delete;
  DELETE FROM public.digest_logs        WHERE user_id = user_id_to_delete;

  -- Shared synthesis cache: keep the content, drop the link to the person
  UPDATE public.topic_syntheses SET user_id = NULL WHERE user_id = user_id_to_delete;

  -- Preferences / consent
  DELETE FROM public.user_preferences   WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_consents      WHERE user_id = user_id_to_delete;

  -- Feedback
  DELETE FROM public.synthesis_feedback WHERE user_id = user_id_to_delete;

  -- Social / saved content
  DELETE FROM public.followed_tags      WHERE user_id = user_id_to_delete;
  DELETE FROM public.saved_articles     WHERE user_id = user_id_to_delete;

  -- Reports & roles
  DELETE FROM public.reports            WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_roles         WHERE user_id = user_id_to_delete;

  -- Auth record
  DELETE FROM auth.users                WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
