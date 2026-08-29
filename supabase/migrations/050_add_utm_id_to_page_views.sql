-- Adds utm_id capture for paid ad campaigns (LinkedIn ad set id, Facebook ad set id, etc).
-- utm_source/utm_medium/utm_campaign already exist; utm_id was never captured because
-- nothing needed it until paid campaigns with per-ad-set dynamic UTM tracking.
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS utm_id text;
