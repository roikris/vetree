-- Migration 063: restore topic_syntheses.search_version (schema drift)
--
-- PROBLEM (found 2026-09-28 while reviewing synthesis cost controls)
--   Migration 027 added search_version, and schema_migrations records its ALTER as executed — but
--   the column no longer exists in production (removed outside the migrations, most likely via the
--   dashboard; CLAUDE.md rule 15). The synthesis route has written search_version: 2 and filtered
--   .gte('search_version', 2) since 2026-05-18 (commit 1c13e6f), so since then:
--     - every cache INSERT failed (42703), logged only to the server console;
--     - every cache READ errored and fell through to a fresh Claude generation.
--   topic_syntheses holds 22 rows, the newest from 2026-05-17; ~335 generations since were never
--   cached — every synthesis, even a repeated topic, was a new Claude call.
--
-- FIX: re-add the column exactly as 027 defined it. Existing rows get 1 (pre-ranked-search, which
-- the route deliberately ignores); new syntheses are written with 2 and served from cache for 7 days.
--
-- ROLLBACK: none needed — the column is what the running code expects.

ALTER TABLE public.topic_syntheses
  ADD COLUMN IF NOT EXISTS search_version integer DEFAULT 1;
