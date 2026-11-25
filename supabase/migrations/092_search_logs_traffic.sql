-- analytics-003 (Roi 2026-11-25, "yes" to options 1 + 2): search_logs gets the page_views traffic labels + where a
-- search came from.
--
-- Why: a read-only pull of production (2026-11-25) found 44 of the 78 searches recorded since 2026-09-01 were the
-- landing page's four "Try —" suggestion chips, all signed out, a different IP every time, no article opened —
-- crawlers that run JavaScript and follow the chip links. search_logs had no label, so every reader (Admin →
-- Analytics, the daily snapshot, the analysis agent's signals and insights) counted them as people searching.
--
-- bot_name / traffic_class: written by /api/analytics/search exactly as /api/analytics/track writes them for
-- page_views (lib/bot-detection.ts, lib/analytics/datacenter.ts; same CHECK as 084). Older rows stay NULL: the raw
-- IP was never stored, so they cannot be classified.
-- via: 'chip' = the search came from a suggestion chip's link (lib/search/chips.ts). Readers never count chip
-- searches as demand (lib/analytics/searchFilters.ts).
--
-- Additive only; service_role already has SELECT, INSERT on the table — no grant change.

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS bot_name text,
  ADD COLUMN IF NOT EXISTS traffic_class text
    CONSTRAINT search_logs_traffic_class_check CHECK (
      traffic_class IS NULL
      OR traffic_class IN ('suspected_fleet', 'suspected_datacenter')
      OR traffic_class ~ '^datacenter:[a-z0-9_-]{1,40}$'
    ),
  ADD COLUMN IF NOT EXISTS via text
    CONSTRAINT search_logs_via_check CHECK (via IS NULL OR via = 'chip');

COMMENT ON COLUMN public.search_logs.bot_name IS 'Confirmed crawler (user agent), as page_views.bot_name; NULL = not a known crawler or before 092';
COMMENT ON COLUMN public.search_logs.traffic_class IS 'Hosting-network estimate, as page_views.traffic_class; NULL = none or before 092';
COMMENT ON COLUMN public.search_logs.via IS 'chip = started from a landing-page suggestion chip (not typed); before 092 inferred from the exact chip text of signed-out searches';

-- One-off backfill (an inference): signed-out searches with exactly a chip's text, recorded before this migration.
-- Frozen list = the chips as they were on 2026-11-25; never edit it to follow later landing-page copy. A person who
-- typed one of these exact strings while signed out is tagged too — indistinguishable afterwards, and rare.
-- On an empty database (replay) it updates nothing.
UPDATE public.search_logs
   SET via = 'chip'
 WHERE via IS NULL
   AND user_id IS NULL
   AND query IN ('canine diabetes management', 'feline hypertension', 'TPLO outcomes', 'lymphoma chemotherapy')
   AND created_at < timestamptz '2026-11-25T19:31:00Z';
