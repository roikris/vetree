-- feed-002: public.saved_this_week() on fixture rows, in replay's rebuilt database only — never production.
-- One transaction, rolled back. Any wrong result raises, and replay fails (exit 1).
-- Window [2026-03-01, 2026-03-08). Expected order: save count desc, then newer created_at, then id.
BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid FROM generate_series(1, 40) g;

-- fx-v1 … fx-v25 visible; created_at rises with the number (fx-v25 is the newest)
INSERT INTO public.articles (id, title, needs_enrichment, summary, clinical_bottom_line, quarantined, created_at)
SELECT 'fx-v' || g, 't', false, 's', 'b', NULL, timestamptz '2026-01-01 00:00+00' + g * interval '1 hour'
FROM generate_series(1, 25) g;
-- hidden: quarantined, waiting for enrichment, no summary
INSERT INTO public.articles (id, title, needs_enrichment, summary, clinical_bottom_line, quarantined, created_at) VALUES
  ('fx-q', 't', false, 's', 'b', true,  '2026-02-01 00:00+00'),
  ('fx-e', 't', true,  's', 'b', false, '2026-02-01 00:00+00'),
  ('fx-n', 't', false, NULL, 'b', false, '2026-02-01 00:00+00');

CREATE TEMP TABLE fx_saves(article_id text, u int, at timestamptz) ON COMMIT DROP;
INSERT INTO fx_saves VALUES
  -- fx-v1: 5
  ('fx-v1', 1, '2026-03-02'), ('fx-v1', 2, '2026-03-02'), ('fx-v1', 3, '2026-03-02'), ('fx-v1', 4, '2026-03-02'), ('fx-v1', 5, '2026-03-02'),
  -- fx-v2: 3 + 2 by excluded users (39, 40)
  ('fx-v2', 1, '2026-03-03'), ('fx-v2', 2, '2026-03-03'), ('fx-v2', 3, '2026-03-03'), ('fx-v2', 39, '2026-03-03'), ('fx-v2', 40, '2026-03-03'),
  -- fx-v3: 2 + one NULL user (kept) = 3; ties with fx-v2 and is newer
  ('fx-v3', 1, '2026-03-04'), ('fx-v3', 2, '2026-03-04'), ('fx-v3', NULL, '2026-03-04'),
  -- fx-v4: at p_since (in), mid (in), at p_until (out), before p_since (out) = 2
  ('fx-v4', 1, '2026-03-01 00:00+00'), ('fx-v4', 2, '2026-03-05'), ('fx-v4', 3, '2026-03-08 00:00+00'), ('fx-v4', 4, '2026-02-28');
-- fx-v5 … fx-v25: one save each — 21 ties at 1, more than the limit leaves room for
INSERT INTO fx_saves SELECT 'fx-v' || g, 1, timestamptz '2026-03-06' FROM generate_series(5, 25) g;
-- hidden articles: 10 saves each, never counted
INSERT INTO fx_saves SELECT a, g, timestamptz '2026-03-06' FROM unnest(ARRAY['fx-q', 'fx-e', 'fx-n']) a, generate_series(1, 10) g;

INSERT INTO public.saved_articles (user_id, article_id, saved_at)
SELECT CASE WHEN u IS NULL THEN NULL ELSE ('00000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid END, article_id, at
FROM fx_saves;

CREATE TEMP TABLE fx_args(excluded uuid[]) ON COMMIT DROP;
INSERT INTO fx_args VALUES (ARRAY['00000000-0000-4000-8000-000000000039', NULL, '00000000-0000-4000-8000-000000000040']::uuid[]);
GRANT SELECT ON fx_args TO service_role;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  ex uuid[] := (SELECT excluded FROM fx_args);
  got text;
  want text;
  -- run(limit, excluded) → 'id:count,…' in the function's order
  q constant text := $q$SELECT string_agg(article_id || ':' || save_count, ',' ORDER BY ord)
                        FROM public.saved_this_week('2026-03-01 00:00+00', '2026-03-08 00:00+00', $1, $2)
                             WITH ORDINALITY AS x(article_id, save_count, ord)$q$;
BEGIN
  -- limit 20: ties at 3 newest first, then the 16 newest of the 21 one-save articles; hidden never appear
  SELECT string_agg(s, ',') INTO want FROM (
    SELECT unnest(ARRAY['fx-v1:5', 'fx-v3:3', 'fx-v2:3', 'fx-v4:2']) s
    UNION ALL SELECT * FROM (SELECT 'fx-v' || g || ':1' FROM generate_series(25, 10, -1) g) t) w;
  EXECUTE q INTO got USING ex, 20;
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'saved_this_week fixture (limit 20): got %, want %', got, want; END IF;

  EXECUTE q INTO got USING ex, NULL::int;   -- NULL → 20
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'saved_this_week fixture (limit NULL): got %', got; END IF;

  EXECUTE q INTO got USING ex, 0;           -- clamped to 1
  IF got IS DISTINCT FROM 'fx-v1:5' THEN RAISE EXCEPTION 'saved_this_week fixture (limit 0): got %', got; END IF;

  EXECUTE 'SELECT count(*)::text FROM public.saved_this_week(''2026-03-01 00:00+00'', ''2026-03-08 00:00+00'', $1, 999)'
    INTO got USING ex;                      -- clamped to 50: all 25 visible
  IF got IS DISTINCT FROM '25' THEN RAISE EXCEPTION 'saved_this_week fixture (limit 999): got % rows', got; END IF;

  EXECUTE q INTO got USING NULL::uuid[], 2; -- nobody excluded: fx-v2 has 5, ties fx-v1 and is newer
  IF got IS DISTINCT FROM 'fx-v2:5,fx-v1:5' THEN RAISE EXCEPTION 'saved_this_week fixture (no exclusions): got %', got; END IF;
END
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.saved_this_week(timestamptz, timestamptz, uuid[], integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.saved_this_week(timestamptz, timestamptz, uuid[], integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'saved_this_week: anon / authenticated can EXECUTE — must be service role only';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.saved_this_week(timestamptz, timestamptz, uuid[], integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'saved_this_week: service_role cannot EXECUTE';
  END IF;
END
$$;

ROLLBACK;
