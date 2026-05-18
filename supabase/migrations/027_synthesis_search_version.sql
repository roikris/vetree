-- Migration 027: Add search_version to topic_syntheses
-- Allows cache invalidation when search algorithm changes.
-- Existing rows default to version 1 (old/broken search).
-- New syntheses will be saved with version 2 (ranked RPC search).
-- Cache reads filter for search_version >= 2, skipping stale entries.

ALTER TABLE topic_syntheses
  ADD COLUMN IF NOT EXISTS search_version integer DEFAULT 1;
