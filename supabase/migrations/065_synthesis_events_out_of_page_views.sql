-- Migration 065: synthesis experiment events out of page_views (CLAUDE.md rule 12)
--
-- PROBLEM (found 2026-09-29)
--   Synthesis events were stored as fake page_views rows ('/synthesis/run', '/synthesis/engaged').
--   They have no ip_hash/country/device, and page_views feeds every traffic chart, so they inflated
--   page views, top pages, the "Unknown" country and "unknown" device buckets (and, via a JS Set
--   counting null as one visitor, uniques). Before PR #83 the generate route also recorded runs for
--   CI smoke traffic on previews (which share this database) and for local Playwright runs.
--
-- WHAT THIS MIGRATION DOES (additive; the running code neither reads nor writes the new objects)
--   1. analytics_events gains bot_name, traffic_class ('suspected_test' | NULL) and
--      source_page_view_id (unique) — real columns, so readers filter them directly.
--   2. analytics_maintenance_log records each successful move (the cleanup boundary used by the
--      signals route and the analytics page annotation). Service role only.
--   3. move_synthesis_page_views(): moves every '/synthesis/%' row into analytics_events (full
--      original row kept in detail.original, original id in source_page_view_id), then deletes
--      exactly the moved rows — one transaction, idempotent (ON CONFLICT DO NOTHING), re-runnable
--      for late legacy rows. Service role only. NOT invoked here: it runs after the new code is
--      deployed, so no legacy writer can add rows after the move.
--
-- CLASSIFICATION — 'suspected_test' only with evidence, recorded in detail.classification.reason:
--   anonymous rows only (user_id IS NULL), and one of
--     'ua'                  user agent HeadlessChrome / VetreeQABot
--     'local_burst'         2026-09-28 05:15–05:55 UTC local Playwright runs against the prod DB
--     'ci_window:<run id>'  inside a GitHub Actions smoke run (QA Smoke Suite / PR Smoke Suite),
--                           [created_at − 1 min, updated_at + 2 min]; 274 runs listed below
--   Everything else stays unclassified (NULL) and is counted. Rows remain in analytics_events, so
--   the classification can be reviewed or reversed (UPDATE traffic_class) without data loss.

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS bot_name text,
  ADD COLUMN IF NOT EXISTS traffic_class text,
  ADD COLUMN IF NOT EXISTS source_page_view_id uuid;

DO $$ BEGIN
  ALTER TABLE public.analytics_events
    ADD CONSTRAINT analytics_events_traffic_class_check
    CHECK (traffic_class IS NULL OR traffic_class = 'suspected_test');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_source_page_view_id_key
  ON public.analytics_events (source_page_view_id);
CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at_idx
  ON public.analytics_events (event_name, created_at);

CREATE TABLE IF NOT EXISTS public.analytics_maintenance_log (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  details jsonb
);
ALTER TABLE public.analytics_maintenance_log ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON public.analytics_maintenance_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.analytics_maintenance_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.analytics_maintenance_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.move_synthesis_page_views()
RETURNS TABLE (moved integer, deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_moved integer;
  v_deleted integer;
BEGIN
  WITH ci (run_id, s, e) AS (
    VALUES
      (28700525377, timestamptz '2026-07-04T08:27:59Z' - interval '1 minute', timestamptz '2026-07-04T08:29:09Z' + interval '2 minutes'),
      (28735176608, timestamptz '2026-07-05T08:44:22Z' - interval '1 minute', timestamptz '2026-07-05T08:45:27Z' + interval '2 minutes'),
      (28783609984, timestamptz '2026-07-06T10:02:54Z' - interval '1 minute', timestamptz '2026-07-06T10:04:15Z' + interval '2 minutes'),
      (28856066663, timestamptz '2026-07-07T09:29:59Z' - interval '1 minute', timestamptz '2026-07-07T09:31:05Z' + interval '2 minutes'),
      (28927911914, timestamptz '2026-07-08T08:13:50Z' - interval '1 minute', timestamptz '2026-07-08T08:15:14Z' + interval '2 minutes'),
      (29008207494, timestamptz '2026-07-09T09:26:44Z' - interval '1 minute', timestamptz '2026-07-09T09:28:10Z' + interval '2 minutes'),
      (29082866107, timestamptz '2026-07-10T09:23:08Z' - interval '1 minute', timestamptz '2026-07-10T09:24:34Z' + interval '2 minutes'),
      (29145001470, timestamptz '2026-07-11T07:44:30Z' - interval '1 minute', timestamptz '2026-07-11T07:45:32Z' + interval '2 minutes'),
      (29181606493, timestamptz '2026-07-12T05:44:15Z' - interval '1 minute', timestamptz '2026-07-12T05:50:45Z' + interval '2 minutes'),
      (29181650612, timestamptz '2026-07-12T05:45:57Z' - interval '1 minute', timestamptz '2026-07-12T05:50:36Z' + interval '2 minutes'),
      (29185288045, timestamptz '2026-07-12T08:05:50Z' - interval '1 minute', timestamptz '2026-07-12T08:10:18Z' + interval '2 minutes'),
      (29185981687, timestamptz '2026-07-12T08:31:29Z' - interval '1 minute', timestamptz '2026-07-12T08:38:09Z' + interval '2 minutes'),
      (29186166410, timestamptz '2026-07-12T08:38:31Z' - interval '1 minute', timestamptz '2026-07-12T08:44:11Z' + interval '2 minutes'),
      (29186326199, timestamptz '2026-07-12T08:44:35Z' - interval '1 minute', timestamptz '2026-07-12T08:49:16Z' + interval '2 minutes'),
      (29187701682, timestamptz '2026-07-12T09:34:37Z' - interval '1 minute', timestamptz '2026-07-12T09:38:42Z' + interval '2 minutes'),
      (29188365034, timestamptz '2026-07-12T09:58:55Z' - interval '1 minute', timestamptz '2026-07-12T10:02:55Z' + interval '2 minutes'),
      (29189081797, timestamptz '2026-07-12T10:24:54Z' - interval '1 minute', timestamptz '2026-07-12T10:28:44Z' + interval '2 minutes'),
      (29189873903, timestamptz '2026-07-12T10:53:08Z' - interval '1 minute', timestamptz '2026-07-12T10:57:20Z' + interval '2 minutes'),
      (29204571313, timestamptz '2026-07-12T18:48:18Z' - interval '1 minute', timestamptz '2026-07-12T18:52:34Z' + interval '2 minutes'),
      (29205825766, timestamptz '2026-07-12T19:27:27Z' - interval '1 minute', timestamptz '2026-07-12T19:31:38Z' + interval '2 minutes'),
      (29237187686, timestamptz '2026-07-13T08:56:04Z' - interval '1 minute', timestamptz '2026-07-13T08:58:15Z' + interval '2 minutes'),
      (29255683101, timestamptz '2026-07-13T13:54:34Z' - interval '1 minute', timestamptz '2026-07-13T13:57:57Z' + interval '2 minutes'),
      (29257596694, timestamptz '2026-07-13T14:21:31Z' - interval '1 minute', timestamptz '2026-07-13T14:31:51Z' + interval '2 minutes'),
      (29260130116, timestamptz '2026-07-13T14:57:00Z' - interval '1 minute', timestamptz '2026-07-13T14:57:48Z' + interval '2 minutes'),
      (29261142613, timestamptz '2026-07-13T15:10:58Z' - interval '1 minute', timestamptz '2026-07-13T15:14:56Z' + interval '2 minutes'),
      (29268064041, timestamptz '2026-07-13T16:50:42Z' - interval '1 minute', timestamptz '2026-07-13T17:01:05Z' + interval '2 minutes'),
      (29268637118, timestamptz '2026-07-13T16:59:18Z' - interval '1 minute', timestamptz '2026-07-13T17:03:08Z' + interval '2 minutes'),
      (29270156433, timestamptz '2026-07-13T17:22:17Z' - interval '1 minute', timestamptz '2026-07-13T17:31:38Z' + interval '2 minutes'),
      (29270931338, timestamptz '2026-07-13T17:33:55Z' - interval '1 minute', timestamptz '2026-07-13T17:42:11Z' + interval '2 minutes'),
      (29276327095, timestamptz '2026-07-13T18:54:01Z' - interval '1 minute', timestamptz '2026-07-13T18:56:52Z' + interval '2 minutes'),
      (29277002366, timestamptz '2026-07-13T19:03:59Z' - interval '1 minute', timestamptz '2026-07-13T19:06:46Z' + interval '2 minutes'),
      (29277588867, timestamptz '2026-07-13T19:12:53Z' - interval '1 minute', timestamptz '2026-07-13T19:15:25Z' + interval '2 minutes'),
      (29278110635, timestamptz '2026-07-13T19:20:58Z' - interval '1 minute', timestamptz '2026-07-13T19:24:17Z' + interval '2 minutes'),
      (29278434372, timestamptz '2026-07-13T19:26:01Z' - interval '1 minute', timestamptz '2026-07-13T19:28:02Z' + interval '2 minutes'),
      (29278583638, timestamptz '2026-07-13T19:28:25Z' - interval '1 minute', timestamptz '2026-07-13T19:32:15Z' + interval '2 minutes'),
      (29315966212, timestamptz '2026-07-14T07:51:19Z' - interval '1 minute', timestamptz '2026-07-14T07:53:20Z' + interval '2 minutes'),
      (29332274912, timestamptz '2026-07-14T12:23:00Z' - interval '1 minute', timestamptz '2026-07-14T13:17:43Z' + interval '2 minutes'),
      (29334770034, timestamptz '2026-07-14T13:01:15Z' - interval '1 minute', timestamptz '2026-07-14T13:05:17Z' + interval '2 minutes'),
      (29345125378, timestamptz '2026-07-14T15:23:36Z' - interval '1 minute', timestamptz '2026-07-14T15:34:05Z' + interval '2 minutes'),
      (29345361639, timestamptz '2026-07-14T15:26:50Z' - interval '1 minute', timestamptz '2026-07-14T15:28:44Z' + interval '2 minutes'),
      (29352500831, timestamptz '2026-07-14T17:08:06Z' - interval '1 minute', timestamptz '2026-07-14T17:10:28Z' + interval '2 minutes'),
      (29352737635, timestamptz '2026-07-14T17:11:35Z' - interval '1 minute', timestamptz '2026-07-14T17:14:01Z' + interval '2 minutes'),
      (29352924273, timestamptz '2026-07-14T17:14:16Z' - interval '1 minute', timestamptz '2026-07-14T17:17:43Z' + interval '2 minutes'),
      (29353195418, timestamptz '2026-07-14T17:18:10Z' - interval '1 minute', timestamptz '2026-07-14T17:21:25Z' + interval '2 minutes'),
      (29353264285, timestamptz '2026-07-14T17:19:12Z' - interval '1 minute', timestamptz '2026-07-14T17:22:57Z' + interval '2 minutes'),
      (29354904784, timestamptz '2026-07-14T17:42:47Z' - interval '1 minute', timestamptz '2026-07-14T17:45:00Z' + interval '2 minutes'),
      (29355074663, timestamptz '2026-07-14T17:45:13Z' - interval '1 minute', timestamptz '2026-07-14T17:48:49Z' + interval '2 minutes'),
      (29356246942, timestamptz '2026-07-14T18:02:31Z' - interval '1 minute', timestamptz '2026-07-14T18:04:58Z' + interval '2 minutes'),
      (29356720775, timestamptz '2026-07-14T18:09:35Z' - interval '1 minute', timestamptz '2026-07-14T18:13:07Z' + interval '2 minutes'),
      (29359749729, timestamptz '2026-07-14T18:54:28Z' - interval '1 minute', timestamptz '2026-07-14T18:57:12Z' + interval '2 minutes'),
      (29360119801, timestamptz '2026-07-14T19:00:06Z' - interval '1 minute', timestamptz '2026-07-14T19:02:52Z' + interval '2 minutes'),
      (29360333226, timestamptz '2026-07-14T19:03:15Z' - interval '1 minute', timestamptz '2026-07-14T19:06:59Z' + interval '2 minutes'),
      (29398968604, timestamptz '2026-07-15T07:55:19Z' - interval '1 minute', timestamptz '2026-07-15T07:56:43Z' + interval '2 minutes'),
      (29414267248, timestamptz '2026-07-15T12:10:56Z' - interval '1 minute', timestamptz '2026-07-15T12:12:28Z' + interval '2 minutes'),
      (29414390522, timestamptz '2026-07-15T12:12:59Z' - interval '1 minute', timestamptz '2026-07-15T12:16:25Z' + interval '2 minutes'),
      (29414411375, timestamptz '2026-07-15T12:13:18Z' - interval '1 minute', timestamptz '2026-07-15T12:16:45Z' + interval '2 minutes'),
      (29441422653, timestamptz '2026-07-15T18:39:21Z' - interval '1 minute', timestamptz '2026-07-15T18:41:08Z' + interval '2 minutes'),
      (29442577812, timestamptz '2026-07-15T18:56:30Z' - interval '1 minute', timestamptz '2026-07-15T18:59:19Z' + interval '2 minutes'),
      (29442781786, timestamptz '2026-07-15T18:59:32Z' - interval '1 minute', timestamptz '2026-07-15T19:03:04Z' + interval '2 minutes'),
      (29443479404, timestamptz '2026-07-15T19:10:07Z' - interval '1 minute', timestamptz '2026-07-15T19:13:30Z' + interval '2 minutes'),
      (29481917270, timestamptz '2026-07-16T08:00:55Z' - interval '1 minute', timestamptz '2026-07-16T08:02:21Z' + interval '2 minutes'),
      (29564790258, timestamptz '2026-07-17T07:57:59Z' - interval '1 minute', timestamptz '2026-07-17T07:59:30Z' + interval '2 minutes'),
      (29567725709, timestamptz '2026-07-17T08:48:55Z' - interval '1 minute', timestamptz '2026-07-17T08:51:00Z' + interval '2 minutes'),
      (29567946660, timestamptz '2026-07-17T08:52:37Z' - interval '1 minute', timestamptz '2026-07-17T08:56:02Z' + interval '2 minutes'),
      (29567991110, timestamptz '2026-07-17T08:53:22Z' - interval '1 minute', timestamptz '2026-07-17T08:56:37Z' + interval '2 minutes'),
      (29570635156, timestamptz '2026-07-17T09:37:32Z' - interval '1 minute', timestamptz '2026-07-17T09:40:01Z' + interval '2 minutes'),
      (29570961906, timestamptz '2026-07-17T09:43:03Z' - interval '1 minute', timestamptz '2026-07-17T09:46:51Z' + interval '2 minutes'),
      (29574064554, timestamptz '2026-07-17T10:37:03Z' - interval '1 minute', timestamptz '2026-07-17T10:38:41Z' + interval '2 minutes'),
      (29580276481, timestamptz '2026-07-17T12:27:13Z' - interval '1 minute', timestamptz '2026-07-17T12:31:01Z' + interval '2 minutes'),
      (29582797490, timestamptz '2026-07-17T13:08:05Z' - interval '1 minute', timestamptz '2026-07-17T13:10:37Z' + interval '2 minutes'),
      (29582973575, timestamptz '2026-07-17T13:10:54Z' - interval '1 minute', timestamptz '2026-07-17T13:14:26Z' + interval '2 minutes'),
      (29609291643, timestamptz '2026-07-17T19:54:55Z' - interval '1 minute', timestamptz '2026-07-17T19:58:11Z' + interval '2 minutes'),
      (29609534262, timestamptz '2026-07-17T19:59:04Z' - interval '1 minute', timestamptz '2026-07-17T20:03:03Z' + interval '2 minutes'),
      (29609565358, timestamptz '2026-07-17T19:59:35Z' - interval '1 minute', timestamptz '2026-07-17T20:02:52Z' + interval '2 minutes'),
      (29609920686, timestamptz '2026-07-17T20:05:14Z' - interval '1 minute', timestamptz '2026-07-17T20:08:42Z' + interval '2 minutes'),
      (29633805631, timestamptz '2026-07-18T06:20:02Z' - interval '1 minute', timestamptz '2026-07-18T06:22:28Z' + interval '2 minutes'),
      (29633992060, timestamptz '2026-07-18T06:26:18Z' - interval '1 minute', timestamptz '2026-07-18T06:30:00Z' + interval '2 minutes'),
      (29634572296, timestamptz '2026-07-18T06:46:32Z' - interval '1 minute', timestamptz '2026-07-18T06:48:35Z' + interval '2 minutes'),
      (29634767773, timestamptz '2026-07-18T06:52:59Z' - interval '1 minute', timestamptz '2026-07-18T06:55:45Z' + interval '2 minutes'),
      (29636086822, timestamptz '2026-07-18T07:38:29Z' - interval '1 minute', timestamptz '2026-07-18T07:39:49Z' + interval '2 minutes'),
      (29636957862, timestamptz '2026-07-18T08:08:38Z' - interval '1 minute', timestamptz '2026-07-18T08:12:00Z' + interval '2 minutes'),
      (29679200984, timestamptz '2026-07-19T08:04:52Z' - interval '1 minute', timestamptz '2026-07-19T08:06:34Z' + interval '2 minutes'),
      (29724967201, timestamptz '2026-07-20T07:33:08Z' - interval '1 minute', timestamptz '2026-07-20T07:35:14Z' + interval '2 minutes'),
      (29725402805, timestamptz '2026-07-20T07:41:23Z' - interval '1 minute', timestamptz '2026-07-20T07:44:53Z' + interval '2 minutes'),
      (29728990328, timestamptz '2026-07-20T08:46:08Z' - interval '1 minute', timestamptz '2026-07-20T08:48:02Z' + interval '2 minutes'),
      (29813455754, timestamptz '2026-07-21T08:13:33Z' - interval '1 minute', timestamptz '2026-07-21T08:15:12Z' + interval '2 minutes'),
      (29903199510, timestamptz '2026-07-22T08:14:13Z' - interval '1 minute', timestamptz '2026-07-22T08:15:37Z' + interval '2 minutes'),
      (29990789476, timestamptz '2026-07-23T08:18:13Z' - interval '1 minute', timestamptz '2026-07-23T08:19:56Z' + interval '2 minutes'),
      (30078145719, timestamptz '2026-07-24T08:13:03Z' - interval '1 minute', timestamptz '2026-07-24T08:14:29Z' + interval '2 minutes'),
      (30150182511, timestamptz '2026-07-25T07:55:30Z' - interval '1 minute', timestamptz '2026-07-25T07:56:57Z' + interval '2 minutes'),
      (30194237636, timestamptz '2026-07-26T08:13:44Z' - interval '1 minute', timestamptz '2026-07-26T08:15:14Z' + interval '2 minutes'),
      (30212270004, timestamptz '2026-07-26T17:17:39Z' - interval '1 minute', timestamptz '2026-07-26T17:19:03Z' + interval '2 minutes'),
      (30212356068, timestamptz '2026-07-26T17:20:10Z' - interval '1 minute', timestamptz '2026-07-26T17:22:41Z' + interval '2 minutes'),
      (30212541913, timestamptz '2026-07-26T17:25:25Z' - interval '1 minute', timestamptz '2026-07-26T17:28:54Z' + interval '2 minutes'),
      (30214465531, timestamptz '2026-07-26T18:19:15Z' - interval '1 minute', timestamptz '2026-07-26T18:21:13Z' + interval '2 minutes'),
      (30218216162, timestamptz '2026-07-26T20:04:48Z' - interval '1 minute', timestamptz '2026-07-26T20:08:09Z' + interval '2 minutes'),
      (30218752318, timestamptz '2026-07-26T20:20:13Z' - interval '1 minute', timestamptz '2026-07-26T20:22:35Z' + interval '2 minutes'),
      (30254726853, timestamptz '2026-07-27T09:37:11Z' - interval '1 minute', timestamptz '2026-07-27T09:38:31Z' + interval '2 minutes'),
      (30284977607, timestamptz '2026-07-27T16:29:58Z' - interval '1 minute', timestamptz '2026-07-27T16:33:17Z' + interval '2 minutes'),
      (30342082654, timestamptz '2026-07-28T08:21:49Z' - interval '1 minute', timestamptz '2026-07-28T08:23:15Z' + interval '2 minutes'),
      (30389452940, timestamptz '2026-07-28T18:52:53Z' - interval '1 minute', timestamptz '2026-07-28T18:54:48Z' + interval '2 minutes'),
      (30390237251, timestamptz '2026-07-28T19:03:08Z' - interval '1 minute', timestamptz '2026-07-28T19:06:31Z' + interval '2 minutes'),
      (30435600700, timestamptz '2026-07-29T08:27:46Z' - interval '1 minute', timestamptz '2026-07-29T08:29:13Z' + interval '2 minutes'),
      (30455226343, timestamptz '2026-07-29T13:16:05Z' - interval '1 minute', timestamptz '2026-07-29T13:18:33Z' + interval '2 minutes'),
      (30456879293, timestamptz '2026-07-29T13:37:40Z' - interval '1 minute', timestamptz '2026-07-29T13:41:01Z' + interval '2 minutes'),
      (30525742985, timestamptz '2026-07-30T08:11:57Z' - interval '1 minute', timestamptz '2026-07-30T08:13:34Z' + interval '2 minutes'),
      (30617058070, timestamptz '2026-07-31T08:39:08Z' - interval '1 minute', timestamptz '2026-07-31T08:40:43Z' + interval '2 minutes'),
      (30633209812, timestamptz '2026-07-31T13:07:27Z' - interval '1 minute', timestamptz '2026-07-31T13:09:21Z' + interval '2 minutes'),
      (30635406661, timestamptz '2026-07-31T13:40:28Z' - interval '1 minute', timestamptz '2026-07-31T13:43:54Z' + interval '2 minutes'),
      (30637176227, timestamptz '2026-07-31T14:06:00Z' - interval '1 minute', timestamptz '2026-07-31T14:08:21Z' + interval '2 minutes'),
      (30637363511, timestamptz '2026-07-31T14:08:43Z' - interval '1 minute', timestamptz '2026-07-31T14:12:18Z' + interval '2 minutes'),
      (30652382354, timestamptz '2026-07-31T17:44:58Z' - interval '1 minute', timestamptz '2026-07-31T17:46:51Z' + interval '2 minutes'),
      (30656336128, timestamptz '2026-07-31T18:44:07Z' - interval '1 minute', timestamptz '2026-07-31T18:47:54Z' + interval '2 minutes'),
      (30688995597, timestamptz '2026-08-01T07:04:35Z' - interval '1 minute', timestamptz '2026-08-01T07:06:44Z' + interval '2 minutes'),
      (30691176622, timestamptz '2026-08-01T08:08:55Z' - interval '1 minute', timestamptz '2026-08-01T08:10:28Z' + interval '2 minutes'),
      (30693207965, timestamptz '2026-08-01T09:10:03Z' - interval '1 minute', timestamptz '2026-08-01T09:13:34Z' + interval '2 minutes'),
      (30700036917, timestamptz '2026-08-01T12:36:22Z' - interval '1 minute', timestamptz '2026-08-01T12:38:24Z' + interval '2 minutes'),
      (30702547140, timestamptz '2026-08-01T13:50:45Z' - interval '1 minute', timestamptz '2026-08-01T13:54:18Z' + interval '2 minutes'),
      (30710485370, timestamptz '2026-08-01T17:30:42Z' - interval '1 minute', timestamptz '2026-08-01T17:32:49Z' + interval '2 minutes'),
      (30712837907, timestamptz '2026-08-01T18:34:38Z' - interval '1 minute', timestamptz '2026-08-01T18:38:03Z' + interval '2 minutes'),
      (30739251946, timestamptz '2026-08-02T08:10:20Z' - interval '1 minute', timestamptz '2026-08-02T08:12:02Z' + interval '2 minutes'),
      (30801665169, timestamptz '2026-08-03T09:30:05Z' - interval '1 minute', timestamptz '2026-08-03T09:31:44Z' + interval '2 minutes'),
      (30833605769, timestamptz '2026-08-03T16:45:22Z' - interval '1 minute', timestamptz '2026-08-03T16:47:20Z' + interval '2 minutes'),
      (30834239028, timestamptz '2026-08-03T16:53:43Z' - interval '1 minute', timestamptz '2026-08-03T16:57:16Z' + interval '2 minutes'),
      (30891948479, timestamptz '2026-08-04T08:26:18Z' - interval '1 minute', timestamptz '2026-08-04T08:27:53Z' + interval '2 minutes'),
      (30988890216, timestamptz '2026-08-05T08:24:29Z' - interval '1 minute', timestamptz '2026-08-05T08:26:15Z' + interval '2 minutes'),
      (31084612377, timestamptz '2026-08-06T08:22:15Z' - interval '1 minute', timestamptz '2026-08-06T08:24:04Z' + interval '2 minutes'),
      (31156192000, timestamptz '2026-08-07T07:03:35Z' - interval '1 minute', timestamptz '2026-08-07T07:05:07Z' + interval '2 minutes'),
      (31244391746, timestamptz '2026-08-08T06:38:54Z' - interval '1 minute', timestamptz '2026-08-08T06:40:24Z' + interval '2 minutes'),
      (31299489122, timestamptz '2026-08-09T06:42:41Z' - interval '1 minute', timestamptz '2026-08-09T06:44:09Z' + interval '2 minutes'),
      (31365250777, timestamptz '2026-08-10T07:17:15Z' - interval '1 minute', timestamptz '2026-08-10T07:18:47Z' + interval '2 minutes'),
      (31466846603, timestamptz '2026-08-11T06:54:37Z' - interval '1 minute', timestamptz '2026-08-11T06:56:10Z' + interval '2 minutes'),
      (31573118367, timestamptz '2026-08-12T07:13:56Z' - interval '1 minute', timestamptz '2026-08-12T07:15:20Z' + interval '2 minutes'),
      (31677089188, timestamptz '2026-08-13T07:16:25Z' - interval '1 minute', timestamptz '2026-08-13T07:17:56Z' + interval '2 minutes'),
      (31779145662, timestamptz '2026-08-14T07:14:04Z' - interval '1 minute', timestamptz '2026-08-14T07:15:37Z' + interval '2 minutes'),
      (31869381133, timestamptz '2026-08-15T06:24:52Z' - interval '1 minute', timestamptz '2026-08-15T06:26:35Z' + interval '2 minutes'),
      (31893689341, timestamptz '2026-08-15T15:46:58Z' - interval '1 minute', timestamptz '2026-08-15T15:49:13Z' + interval '2 minutes'),
      (31894112737, timestamptz '2026-08-15T15:56:06Z' - interval '1 minute', timestamptz '2026-08-15T15:58:41Z' + interval '2 minutes'),
      (31894566687, timestamptz '2026-08-15T16:05:52Z' - interval '1 minute', timestamptz '2026-08-15T16:09:25Z' + interval '2 minutes'),
      (31931490580, timestamptz '2026-08-16T06:28:06Z' - interval '1 minute', timestamptz '2026-08-16T06:29:37Z' + interval '2 minutes'),
      (31966714939, timestamptz '2026-08-16T19:09:01Z' - interval '1 minute', timestamptz '2026-08-16T19:11:22Z' + interval '2 minutes'),
      (31967470180, timestamptz '2026-08-16T19:24:16Z' - interval '1 minute', timestamptz '2026-08-16T19:28:01Z' + interval '2 minutes'),
      (31968038779, timestamptz '2026-08-16T19:35:31Z' - interval '1 minute', timestamptz '2026-08-16T19:37:51Z' + interval '2 minutes'),
      (31968190395, timestamptz '2026-08-16T19:38:38Z' - interval '1 minute', timestamptz '2026-08-16T19:42:04Z' + interval '2 minutes'),
      (31969022304, timestamptz '2026-08-16T19:55:31Z' - interval '1 minute', timestamptz '2026-08-16T19:57:44Z' + interval '2 minutes'),
      (31969136790, timestamptz '2026-08-16T19:57:56Z' - interval '1 minute', timestamptz '2026-08-16T20:01:23Z' + interval '2 minutes'),
      (32002486770, timestamptz '2026-08-17T06:38:43Z' - interval '1 minute', timestamptz '2026-08-17T06:40:22Z' + interval '2 minutes'),
      (32034805026, timestamptz '2026-08-17T13:22:59Z' - interval '1 minute', timestamptz '2026-08-17T13:25:22Z' + interval '2 minutes'),
      (32041840212, timestamptz '2026-08-17T15:17:03Z' - interval '1 minute', timestamptz '2026-08-17T15:19:14Z' + interval '2 minutes'),
      (32047668707, timestamptz '2026-08-17T16:52:27Z' - interval '1 minute', timestamptz '2026-08-17T16:55:54Z' + interval '2 minutes'),
      (32047911244, timestamptz '2026-08-17T16:55:24Z' - interval '1 minute', timestamptz '2026-08-17T16:58:52Z' + interval '2 minutes'),
      (32050046325, timestamptz '2026-08-17T17:22:42Z' - interval '1 minute', timestamptz '2026-08-17T17:24:25Z' + interval '2 minutes'),
      (32059857642, timestamptz '2026-08-17T19:21:06Z' - interval '1 minute', timestamptz '2026-08-17T19:24:46Z' + interval '2 minutes'),
      (32107211188, timestamptz '2026-08-18T06:30:27Z' - interval '1 minute', timestamptz '2026-08-18T06:32:10Z' + interval '2 minutes'),
      (32223757049, timestamptz '2026-08-19T06:31:14Z' - interval '1 minute', timestamptz '2026-08-19T06:46:35Z' + interval '2 minutes'),
      (32228208239, timestamptz '2026-08-19T07:31:13Z' - interval '1 minute', timestamptz '2026-08-19T07:33:40Z' + interval '2 minutes'),
      (32340091156, timestamptz '2026-08-20T06:33:27Z' - interval '1 minute', timestamptz '2026-08-20T06:35:05Z' + interval '2 minutes'),
      (32454881077, timestamptz '2026-08-21T06:33:35Z' - interval '1 minute', timestamptz '2026-08-21T06:35:02Z' + interval '2 minutes'),
      (32557007896, timestamptz '2026-08-22T06:27:15Z' - interval '1 minute', timestamptz '2026-08-22T06:28:40Z' + interval '2 minutes'),
      (32623021267, timestamptz '2026-08-23T06:28:33Z' - interval '1 minute', timestamptz '2026-08-23T06:30:05Z' + interval '2 minutes'),
      (32657187208, timestamptz '2026-08-23T18:10:25Z' - interval '1 minute', timestamptz '2026-08-23T18:12:14Z' + interval '2 minutes'),
      (32658182200, timestamptz '2026-08-23T18:29:11Z' - interval '1 minute', timestamptz '2026-08-23T18:32:29Z' + interval '2 minutes'),
      (32698359365, timestamptz '2026-08-24T06:41:35Z' - interval '1 minute', timestamptz '2026-08-24T06:43:14Z' + interval '2 minutes'),
      (32755327785, timestamptz '2026-08-24T17:12:57Z' - interval '1 minute', timestamptz '2026-08-24T17:15:06Z' + interval '2 minutes'),
      (32758419369, timestamptz '2026-08-24T17:45:06Z' - interval '1 minute', timestamptz '2026-08-24T17:48:32Z' + interval '2 minutes'),
      (32817567846, timestamptz '2026-08-25T06:34:31Z' - interval '1 minute', timestamptz '2026-08-25T06:35:54Z' + interval '2 minutes'),
      (32938833857, timestamptz '2026-08-26T06:35:46Z' - interval '1 minute', timestamptz '2026-08-26T06:37:29Z' + interval '2 minutes'),
      (33040247647, timestamptz '2026-08-27T04:43:04Z' - interval '1 minute', timestamptz '2026-08-27T04:45:23Z' + interval '2 minutes'),
      (33040401091, timestamptz '2026-08-27T04:46:00Z' - interval '1 minute', timestamptz '2026-08-27T04:49:27Z' + interval '2 minutes'),
      (33097127548, timestamptz '2026-08-27T17:11:31Z' - interval '1 minute', timestamptz '2026-08-27T17:13:11Z' + interval '2 minutes'),
      (33197143824, timestamptz '2026-08-28T17:58:21Z' - interval '1 minute', timestamptz '2026-08-28T18:00:03Z' + interval '2 minutes'),
      (33246723067, timestamptz '2026-08-29T09:58:41Z' - interval '1 minute', timestamptz '2026-08-29T10:01:04Z' + interval '2 minutes'),
      (33251612514, timestamptz '2026-08-29T12:04:42Z' - interval '1 minute', timestamptz '2026-08-29T12:08:03Z' + interval '2 minutes'),
      (33253776032, timestamptz '2026-08-29T12:57:11Z' - interval '1 minute', timestamptz '2026-08-29T12:58:43Z' + interval '2 minutes'),
      (33253927626, timestamptz '2026-08-29T13:00:52Z' - interval '1 minute', timestamptz '2026-08-29T13:04:36Z' + interval '2 minutes'),
      (33307822683, timestamptz '2026-08-30T11:00:18Z' - interval '1 minute', timestamptz '2026-08-30T11:01:50Z' + interval '2 minutes'),
      (33391390799, timestamptz '2026-08-31T12:21:59Z' - interval '1 minute', timestamptz '2026-08-31T12:23:24Z' + interval '2 minutes'),
      (33499784017, timestamptz '2026-09-01T10:54:37Z' - interval '1 minute', timestamptz '2026-09-01T10:56:05Z' + interval '2 minutes'),
      (33619015797, timestamptz '2026-09-02T10:21:08Z' - interval '1 minute', timestamptz '2026-09-02T10:22:36Z' + interval '2 minutes'),
      (33744632231, timestamptz '2026-09-03T10:30:08Z' - interval '1 minute', timestamptz '2026-09-03T10:31:30Z' + interval '2 minutes'),
      (33862646590, timestamptz '2026-09-04T10:19:07Z' - interval '1 minute', timestamptz '2026-09-04T10:26:25Z' + interval '2 minutes'),
      (33958884261, timestamptz '2026-09-05T09:46:28Z' - interval '1 minute', timestamptz '2026-09-05T09:48:00Z' + interval '2 minutes'),
      (34026320935, timestamptz '2026-09-06T10:02:45Z' - interval '1 minute', timestamptz '2026-09-06T10:04:14Z' + interval '2 minutes'),
      (34115720535, timestamptz '2026-09-07T11:15:46Z' - interval '1 minute', timestamptz '2026-09-07T11:17:24Z' + interval '2 minutes'),
      (34215217776, timestamptz '2026-09-08T10:23:46Z' - interval '1 minute', timestamptz '2026-09-08T10:25:12Z' + interval '2 minutes'),
      (34225690685, timestamptz '2026-09-08T12:22:14Z' - interval '1 minute', timestamptz '2026-09-08T12:24:32Z' + interval '2 minutes'),
      (34225987178, timestamptz '2026-09-08T12:25:25Z' - interval '1 minute', timestamptz '2026-09-08T12:29:10Z' + interval '2 minutes'),
      (34340832347, timestamptz '2026-09-09T10:33:15Z' - interval '1 minute', timestamptz '2026-09-09T10:34:41Z' + interval '2 minutes'),
      (34438559554, timestamptz '2026-09-10T04:47:46Z' - interval '1 minute', timestamptz '2026-09-10T05:01:27Z' + interval '2 minutes'),
      (34465676512, timestamptz '2026-09-10T10:22:01Z' - interval '1 minute', timestamptz '2026-09-10T10:24:01Z' + interval '2 minutes'),
      (34479731226, timestamptz '2026-09-10T12:57:52Z' - interval '1 minute', timestamptz '2026-09-10T13:01:32Z' + interval '2 minutes'),
      (34588939058, timestamptz '2026-09-11T10:23:01Z' - interval '1 minute', timestamptz '2026-09-11T10:24:26Z' + interval '2 minutes'),
      (34687022098, timestamptz '2026-09-12T09:53:44Z' - interval '1 minute', timestamptz '2026-09-12T09:55:15Z' + interval '2 minutes'),
      (34753016644, timestamptz '2026-09-13T10:53:28Z' - interval '1 minute', timestamptz '2026-09-13T10:55:05Z' + interval '2 minutes'),
      (34771058710, timestamptz '2026-09-13T17:15:48Z' - interval '1 minute', timestamptz '2026-09-13T17:18:02Z' + interval '2 minutes'),
      (34771345754, timestamptz '2026-09-13T17:21:30Z' - interval '1 minute', timestamptz '2026-09-13T17:24:51Z' + interval '2 minutes'),
      (34838125118, timestamptz '2026-09-14T11:25:24Z' - interval '1 minute', timestamptz '2026-09-14T11:26:42Z' + interval '2 minutes'),
      (34959893624, timestamptz '2026-09-15T10:48:12Z' - interval '1 minute', timestamptz '2026-09-15T10:49:33Z' + interval '2 minutes'),
      (35085966984, timestamptz '2026-09-16T10:37:19Z' - interval '1 minute', timestamptz '2026-09-16T10:38:49Z' + interval '2 minutes'),
      (35212245397, timestamptz '2026-09-17T10:46:38Z' - interval '1 minute', timestamptz '2026-09-17T10:48:12Z' + interval '2 minutes'),
      (35334308486, timestamptz '2026-09-18T10:21:51Z' - interval '1 minute', timestamptz '2026-09-18T10:23:27Z' + interval '2 minutes'),
      (35436450265, timestamptz '2026-09-19T10:05:30Z' - interval '1 minute', timestamptz '2026-09-19T10:07:02Z' + interval '2 minutes'),
      (35504961749, timestamptz '2026-09-20T10:24:03Z' - interval '1 minute', timestamptz '2026-09-20T10:25:29Z' + interval '2 minutes'),
      (35595264233, timestamptz '2026-09-21T11:39:55Z' - interval '1 minute', timestamptz '2026-09-21T11:41:37Z' + interval '2 minutes'),
      (35597145977, timestamptz '2026-09-21T12:01:19Z' - interval '1 minute', timestamptz '2026-09-21T12:03:56Z' + interval '2 minutes'),
      (35597445336, timestamptz '2026-09-21T12:04:35Z' - interval '1 minute', timestamptz '2026-09-21T12:08:02Z' + interval '2 minutes'),
      (35598592920, timestamptz '2026-09-21T12:16:27Z' - interval '1 minute', timestamptz '2026-09-21T12:19:23Z' + interval '2 minutes'),
      (35598900492, timestamptz '2026-09-21T12:19:43Z' - interval '1 minute', timestamptz '2026-09-21T12:23:19Z' + interval '2 minutes'),
      (35717578692, timestamptz '2026-09-22T10:43:47Z' - interval '1 minute', timestamptz '2026-09-22T10:45:50Z' + interval '2 minutes'),
      (35722642090, timestamptz '2026-09-22T11:39:11Z' - interval '1 minute', timestamptz '2026-09-22T11:41:48Z' + interval '2 minutes'),
      (35723456960, timestamptz '2026-09-22T11:47:47Z' - interval '1 minute', timestamptz '2026-09-22T11:51:11Z' + interval '2 minutes'),
      (35849603195, timestamptz '2026-09-23T10:34:46Z' - interval '1 minute', timestamptz '2026-09-23T10:36:10Z' + interval '2 minutes'),
      (35888747575, timestamptz '2026-09-23T16:26:22Z' - interval '1 minute', timestamptz '2026-09-23T16:28:45Z' + interval '2 minutes'),
      (35901817496, timestamptz '2026-09-23T18:20:50Z' - interval '1 minute', timestamptz '2026-09-23T18:24:24Z' + interval '2 minutes'),
      (35914207074, timestamptz '2026-09-23T20:10:50Z' - interval '1 minute', timestamptz '2026-09-23T20:13:09Z' + interval '2 minutes'),
      (35951046193, timestamptz '2026-09-24T03:20:34Z' - interval '1 minute', timestamptz '2026-09-24T03:24:01Z' + interval '2 minutes'),
      (35976935147, timestamptz '2026-09-24T08:43:39Z' - interval '1 minute', timestamptz '2026-09-24T08:46:10Z' + interval '2 minutes'),
      (35977290170, timestamptz '2026-09-24T08:47:14Z' - interval '1 minute', timestamptz '2026-09-24T08:50:50Z' + interval '2 minutes'),
      (35978501980, timestamptz '2026-09-24T08:59:27Z' - interval '1 minute', timestamptz '2026-09-24T09:02:02Z' + interval '2 minutes'),
      (35979456326, timestamptz '2026-09-24T09:08:48Z' - interval '1 minute', timestamptz '2026-09-24T09:12:16Z' + interval '2 minutes'),
      (35982152699, timestamptz '2026-09-24T09:35:24Z' - interval '1 minute', timestamptz '2026-09-24T09:38:12Z' + interval '2 minutes'),
      (35989855262, timestamptz '2026-09-24T10:53:37Z' - interval '1 minute', timestamptz '2026-09-24T10:55:10Z' + interval '2 minutes'),
      (35999950676, timestamptz '2026-09-24T12:34:52Z' - interval '1 minute', timestamptz '2026-09-24T12:37:52Z' + interval '2 minutes'),
      (36000338244, timestamptz '2026-09-24T12:38:31Z' - interval '1 minute', timestamptz '2026-09-24T12:42:24Z' + interval '2 minutes'),
      (36000347650, timestamptz '2026-09-24T12:38:37Z' - interval '1 minute', timestamptz '2026-09-24T12:42:04Z' + interval '2 minutes'),
      (36017489013, timestamptz '2026-09-24T15:04:44Z' - interval '1 minute', timestamptz '2026-09-24T15:07:39Z' + interval '2 minutes'),
      (36039908561, timestamptz '2026-09-24T18:14:59Z' - interval '1 minute', timestamptz '2026-09-24T18:18:44Z' + interval '2 minutes'),
      (36043305925, timestamptz '2026-09-24T18:44:13Z' - interval '1 minute', timestamptz '2026-09-24T18:47:59Z' + interval '2 minutes'),
      (36044149477, timestamptz '2026-09-24T18:51:31Z' - interval '1 minute', timestamptz '2026-09-24T18:54:48Z' + interval '2 minutes'),
      (36095641737, timestamptz '2026-09-25T04:44:12Z' - interval '1 minute', timestamptz '2026-09-25T04:47:47Z' + interval '2 minutes'),
      (36126494115, timestamptz '2026-09-25T10:54:22Z' - interval '1 minute', timestamptz '2026-09-25T10:57:32Z' + interval '2 minutes'),
      (36126626164, timestamptz '2026-09-25T10:55:51Z' - interval '1 minute', timestamptz '2026-09-25T10:57:50Z' + interval '2 minutes'),
      (36128456371, timestamptz '2026-09-25T11:16:07Z' - interval '1 minute', timestamptz '2026-09-25T11:19:51Z' + interval '2 minutes'),
      (36132016309, timestamptz '2026-09-25T11:55:08Z' - interval '1 minute', timestamptz '2026-09-25T11:57:54Z' + interval '2 minutes'),
      (36132694811, timestamptz '2026-09-25T12:02:37Z' - interval '1 minute', timestamptz '2026-09-25T12:06:18Z' + interval '2 minutes'),
      (36139742038, timestamptz '2026-09-25T13:14:47Z' - interval '1 minute', timestamptz '2026-09-25T13:17:59Z' + interval '2 minutes'),
      (36188075010, timestamptz '2026-09-25T20:49:43Z' - interval '1 minute', timestamptz '2026-09-25T20:53:24Z' + interval '2 minutes'),
      (36191070388, timestamptz '2026-09-25T21:21:10Z' - interval '1 minute', timestamptz '2026-09-25T21:24:19Z' + interval '2 minutes'),
      (36192459382, timestamptz '2026-09-25T21:36:28Z' - interval '1 minute', timestamptz '2026-09-25T21:40:37Z' + interval '2 minutes'),
      (36225741808, timestamptz '2026-09-26T07:05:58Z' - interval '1 minute', timestamptz '2026-09-26T07:10:09Z' + interval '2 minutes'),
      (36226067660, timestamptz '2026-09-26T07:12:23Z' - interval '1 minute', timestamptz '2026-09-26T07:16:03Z' + interval '2 minutes'),
      (36228214732, timestamptz '2026-09-26T07:54:50Z' - interval '1 minute', timestamptz '2026-09-26T07:58:47Z' + interval '2 minutes'),
      (36235250126, timestamptz '2026-09-26T10:15:39Z' - interval '1 minute', timestamptz '2026-09-26T10:18:32Z' + interval '2 minutes'),
      (36235547471, timestamptz '2026-09-26T10:21:35Z' - interval '1 minute', timestamptz '2026-09-26T10:25:32Z' + interval '2 minutes'),
      (36236289421, timestamptz '2026-09-26T10:36:14Z' - interval '1 minute', timestamptz '2026-09-26T10:38:01Z' + interval '2 minutes'),
      (36247056634, timestamptz '2026-09-26T14:00:49Z' - interval '1 minute', timestamptz '2026-09-26T14:04:20Z' + interval '2 minutes'),
      (36248405146, timestamptz '2026-09-26T14:24:37Z' - interval '1 minute', timestamptz '2026-09-26T14:28:20Z' + interval '2 minutes'),
      (36249081706, timestamptz '2026-09-26T14:36:28Z' - interval '1 minute', timestamptz '2026-09-26T14:39:12Z' + interval '2 minutes'),
      (36250253549, timestamptz '2026-09-26T14:57:18Z' - interval '1 minute', timestamptz '2026-09-26T15:02:01Z' + interval '2 minutes'),
      (36263905539, timestamptz '2026-09-26T18:49:33Z' - interval '1 minute', timestamptz '2026-09-26T18:52:38Z' + interval '2 minutes'),
      (36267357490, timestamptz '2026-09-26T19:49:08Z' - interval '1 minute', timestamptz '2026-09-26T19:52:53Z' + interval '2 minutes'),
      (36314812728, timestamptz '2026-09-27T11:09:17Z' - interval '1 minute', timestamptz '2026-09-27T11:11:21Z' + interval '2 minutes'),
      (36325219425, timestamptz '2026-09-27T14:14:55Z' - interval '1 minute', timestamptz '2026-09-27T14:18:07Z' + interval '2 minutes'),
      (36334283971, timestamptz '2026-09-27T16:43:24Z' - interval '1 minute', timestamptz '2026-09-27T16:47:25Z' + interval '2 minutes'),
      (36335642179, timestamptz '2026-09-27T17:05:38Z' - interval '1 minute', timestamptz '2026-09-27T17:09:11Z' + interval '2 minutes'),
      (36335952488, timestamptz '2026-09-27T17:10:35Z' - interval '1 minute', timestamptz '2026-09-27T17:14:18Z' + interval '2 minutes'),
      (36337668785, timestamptz '2026-09-27T17:38:06Z' - interval '1 minute', timestamptz '2026-09-27T17:41:05Z' + interval '2 minutes'),
      (36344556040, timestamptz '2026-09-27T19:29:54Z' - interval '1 minute', timestamptz '2026-09-27T19:33:54Z' + interval '2 minutes'),
      (36384347646, timestamptz '2026-09-28T06:00:11Z' - interval '1 minute', timestamptz '2026-09-28T06:03:31Z' + interval '2 minutes'),
      (36385405894, timestamptz '2026-09-28T06:13:38Z' - interval '1 minute', timestamptz '2026-09-28T06:17:26Z' + interval '2 minutes'),
      (36389543215, timestamptz '2026-09-28T07:02:59Z' - interval '1 minute', timestamptz '2026-09-28T07:06:08Z' + interval '2 minutes'),
      (36392545595, timestamptz '2026-09-28T07:36:12Z' - interval '1 minute', timestamptz '2026-09-28T07:40:02Z' + interval '2 minutes'),
      (36397281526, timestamptz '2026-09-28T08:25:33Z' - interval '1 minute', timestamptz '2026-09-28T08:28:25Z' + interval '2 minutes'),
      (36402440912, timestamptz '2026-09-28T09:16:30Z' - interval '1 minute', timestamptz '2026-09-28T09:19:41Z' + interval '2 minutes'),
      (36407725332, timestamptz '2026-09-28T10:06:58Z' - interval '1 minute', timestamptz '2026-09-28T10:11:08Z' + interval '2 minutes'),
      (36408388815, timestamptz '2026-09-28T10:13:18Z' - interval '1 minute', timestamptz '2026-09-28T10:16:38Z' + interval '2 minutes'),
      (36408796348, timestamptz '2026-09-28T10:17:08Z' - interval '1 minute', timestamptz '2026-09-28T10:21:17Z' + interval '2 minutes'),
      (36422754638, timestamptz '2026-09-28T12:35:01Z' - interval '1 minute', timestamptz '2026-09-28T12:37:05Z' + interval '2 minutes'),
      (36450107110, timestamptz '2026-09-28T16:18:46Z' - interval '1 minute', timestamptz '2026-09-28T16:22:12Z' + interval '2 minutes'),
      (36455710785, timestamptz '2026-09-28T17:05:51Z' - interval '1 minute', timestamptz '2026-09-28T17:09:54Z' + interval '2 minutes'),
      (36458448951, timestamptz '2026-09-28T17:29:11Z' - interval '1 minute', timestamptz '2026-09-28T17:33:19Z' + interval '2 minutes'),
      (36459164821, timestamptz '2026-09-28T17:35:09Z' - interval '1 minute', timestamptz '2026-09-28T17:39:22Z' + interval '2 minutes'),
      (36465688967, timestamptz '2026-09-28T18:30:39Z' - interval '1 minute', timestamptz '2026-09-28T18:34:41Z' + interval '2 minutes'),
      (36470127310, timestamptz '2026-09-28T19:08:18Z' - interval '1 minute', timestamptz '2026-09-28T19:12:50Z' + interval '2 minutes')
  ),
  src AS (
    SELECT p.*,
      CASE
        WHEN p.user_id IS NOT NULL THEN NULL
        WHEN p.user_agent ILIKE '%HeadlessChrome%' OR p.user_agent ILIKE '%VetreeQABot%' THEN 'ua'
        WHEN p.created_at >= timestamptz '2026-09-28 05:15:00+00'
         AND p.created_at <  timestamptz '2026-09-28 05:55:00+00' THEN 'local_burst'
        ELSE (SELECT 'ci_window:' || ci.run_id FROM ci
              WHERE p.created_at BETWEEN ci.s AND ci.e ORDER BY ci.s LIMIT 1)
      END AS test_reason
    FROM public.page_views p
    WHERE p.path LIKE '/synthesis/%'
  )
  INSERT INTO public.analytics_events
    (event_name, user_id, created_at, bot_name, traffic_class, source_page_view_id, detail)
  SELECT
    'synthesis_' || substring(src.path FROM '^/synthesis/(.+)$'),
    CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = src.user_id) THEN src.user_id END,
    src.created_at,
    src.bot_name,
    CASE WHEN src.test_reason IS NOT NULL THEN 'suspected_test' END,
    src.id,
    jsonb_build_object(
      'source', 'page_views',
      'original', to_jsonb(src) - 'test_reason',
      'classification', jsonb_build_object('version', '065', 'reason', src.test_reason)
    )
  FROM src
  ON CONFLICT (source_page_view_id) DO NOTHING;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.page_views p
  WHERE p.path LIKE '/synthesis/%'
    AND EXISTS (SELECT 1 FROM public.analytics_events a WHERE a.source_page_view_id = p.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO public.analytics_maintenance_log (action, details)
  VALUES ('synthesis_events_moved', jsonb_build_object('moved', v_moved, 'deleted', v_deleted));

  RETURN QUERY SELECT v_moved, v_deleted;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.move_synthesis_page_views() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.move_synthesis_page_views() TO service_role;

NOTIFY pgrst, 'reload schema';
