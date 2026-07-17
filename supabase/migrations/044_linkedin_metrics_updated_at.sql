-- Add metrics_updated_at to linkedin_post_metrics.
-- Tracks when impressions/engagements were last written (XLSX upload or manual inline edit).
-- Default now() for new rows; backfilled from uploaded_at for existing rows.
ALTER TABLE linkedin_post_metrics
  ADD COLUMN IF NOT EXISTS metrics_updated_at timestamptz DEFAULT now();

UPDATE linkedin_post_metrics
  SET metrics_updated_at = uploaded_at
  WHERE metrics_updated_at IS NULL;
