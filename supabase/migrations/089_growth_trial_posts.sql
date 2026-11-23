-- Migration 089: the December 2026 posting trial (growth-005, Roi 2026-11-23)
--
-- For all of December Roi posts from Growth OS → 🧪 December Trial (lib/growth/trial.ts). Every post marked posted
-- there is recorded by record_trial_post() in ONE transaction: the usual growth_agent_memory 'approved' row (which
-- vetree.app/il, LinkedIn matching and the candidate exclusions read) plus a growth_trial_posts row holding the text
-- Roi actually copied and the day's pre-assigned variant. The function serialises each Israel day (advisory lock) and
-- refuses a second article on a day, so vetree.app/il can't move. During the trial /api/growth/feedback refuses
-- 'approved' (the Daily Posts tab can't post), so this function is December's only approval writer.
--
-- trial_variant() repeats lib/growth/trial.ts TRIAL_SCHEDULE (tests/unit/trial.test.ts keeps them equal).
-- LinkedIn per-post outcomes are entered by Roi at a known post age (record_trial_linkedin_metric): exports carry no
-- per-post comment count and no measurement window.
--
-- Service role only: RLS on, no policies; the admin routes use the service role. No personal data (Roi's own posts).
-- Replay: a new empty table + functions; applies on an empty database.

CREATE TABLE public.growth_trial_posts (
  approval_id uuid PRIMARY KEY REFERENCES public.growth_agent_memory(id) ON DELETE CASCADE,
  article_id text NOT NULL REFERENCES public.articles(id),
  platform text NOT NULL CHECK (platform IN ('facebook_il', 'whatsapp', 'telegram', 'linkedin', 'facebook_intl')),
  trial_date date NOT NULL CHECK (trial_date BETWEEN DATE '2026-12-01' AND DATE '2026-12-31'),
  variant text CHECK (variant IS NULL OR variant IN ('in_post', 'first_comment', 'short', 'current')),
  utm_campaign text,
  post_text text NOT NULL CHECK (length(post_text) BETWEEN 1 AND 10000),
  comment_text text CHECK (comment_text IS NULL OR length(comment_text) <= 2000),
  char_count integer CHECK (char_count IS NULL OR char_count >= 0),
  ends_with_question boolean,
  -- LinkedIn only: audience comments (Roi's own link comment and replies excluded) and the impressions LinkedIn shows,
  -- each with when it was entered and the post's age then (they are not fixed-age measures)
  li_comments integer CHECK (li_comments IS NULL OR li_comments >= 0),
  li_comments_recorded_at timestamptz,
  li_comments_age_hours numeric(8, 1),
  li_impressions integer CHECK (li_impressions IS NULL OR li_impressions >= 0),
  li_impressions_recorded_at timestamptz,
  li_impressions_age_hours numeric(8, 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX growth_trial_posts_date_idx ON public.growth_trial_posts (trial_date);

ALTER TABLE public.growth_trial_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_trial_posts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.growth_trial_posts TO service_role;

-- The pre-assigned variant of a platform's post on a December date (NULL: no variant / not a trial day)
CREATE FUNCTION public.trial_variant(p_date date, p_platform text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT CASE
    WHEN p_platform = 'linkedin' THEN s.linkedin
    WHEN p_platform IN ('whatsapp', 'telegram') THEN s.whatsapp
    ELSE NULL END
  FROM (VALUES
    (DATE '2026-12-01', 'in_post', 'short'),
    (DATE '2026-12-02', 'in_post', NULL),
    (DATE '2026-12-03', 'first_comment', 'current'),
    (DATE '2026-12-04', 'in_post', NULL),
    (DATE '2026-12-05', 'first_comment', NULL),
    (DATE '2026-12-06', 'first_comment', 'current'),
    (DATE '2026-12-07', 'first_comment', 'short'),
    (DATE '2026-12-08', 'first_comment', 'current'),
    (DATE '2026-12-09', 'first_comment', NULL),
    (DATE '2026-12-10', 'in_post', 'short'),
    (DATE '2026-12-11', 'in_post', NULL),
    (DATE '2026-12-12', 'in_post', NULL),
    (DATE '2026-12-13', 'in_post', 'short'),
    (DATE '2026-12-14', 'first_comment', 'short'),
    (DATE '2026-12-15', 'first_comment', 'current'),
    (DATE '2026-12-16', 'in_post', NULL),
    (DATE '2026-12-17', 'in_post', 'current'),
    (DATE '2026-12-18', 'first_comment', NULL),
    (DATE '2026-12-19', 'in_post', NULL),
    (DATE '2026-12-20', 'in_post', 'current'),
    (DATE '2026-12-21', 'first_comment', 'short'),
    (DATE '2026-12-22', 'in_post', 'short'),
    (DATE '2026-12-23', 'first_comment', NULL),
    (DATE '2026-12-24', 'in_post', 'current'),
    (DATE '2026-12-25', 'first_comment', NULL),
    (DATE '2026-12-26', 'first_comment', NULL),
    (DATE '2026-12-27', 'first_comment', 'short'),
    (DATE '2026-12-28', 'first_comment', 'current'),
    (DATE '2026-12-29', 'in_post', 'short'),
    (DATE '2026-12-30', 'first_comment', NULL),
    (DATE '2026-12-31', 'in_post', 'current')
  ) AS s(day, linkedin, whatsapp)
  WHERE s.day = p_date
$$;

-- Records one trial post: the approval row + the trial row, in one transaction. Errors start with 'conflict:' (the
-- route answers 409) or 'invalid:' (400). Returns { approval_id, already_recorded, trial_date, variant, utm_campaign }.
CREATE FUNCTION public.record_trial_post(
  p_article_id text, p_platform text, p_language text, p_hook_line text,
  p_post_text text, p_comment_text text, p_char_count integer, p_ends_with_question boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_other text;
  v_approval uuid;
  v_variant text;
  v_campaign text;
  v_trial public.growth_trial_posts%ROWTYPE;
BEGIN
  IF p_article_id IS NULL OR p_platform IS NULL OR p_language IS NULL OR p_post_text IS NULL THEN
    RAISE EXCEPTION 'invalid: missing argument';
  END IF;
  IF p_platform NOT IN ('facebook_il', 'whatsapp', 'telegram', 'linkedin', 'facebook_intl') THEN
    RAISE EXCEPTION 'invalid: not a trial platform';
  END IF;
  IF v_date < DATE '2026-12-01' OR v_date > DATE '2026-12-31' THEN
    RAISE EXCEPTION 'conflict: the trial runs 2026-12-01..2026-12-31 (Israel dates)';
  END IF;
  -- WhatsApp + Telegram only on Israel Sun / Mon / Tue / Thu (extract dow: 0 = Sunday)
  IF p_platform IN ('whatsapp', 'telegram') AND extract(dow FROM v_date) NOT IN (0, 1, 2, 4) THEN
    RAISE EXCEPTION 'conflict: not a WhatsApp day';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('growth-day:' || v_date::text, 89));
  v_start := v_date::timestamp AT TIME ZONE 'Asia/Jerusalem';
  v_end := (v_date + 1)::timestamp AT TIME ZONE 'Asia/Jerusalem';

  -- one article per Israel day, whichever tab wrote the approval
  SELECT m.article_id INTO v_other
  FROM public.growth_agent_memory m
  WHERE m.outcome = 'approved' AND m.article_id IS NOT NULL AND m.article_id <> p_article_id
    AND m.created_at >= v_start AND m.created_at < v_end
  LIMIT 1;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'conflict: another article is already posted today (%)', v_other;
  END IF;

  SELECT m.id INTO v_approval
  FROM public.growth_agent_memory m
  WHERE m.outcome = 'approved' AND m.article_id = p_article_id AND m.platform = p_platform
    AND m.created_at >= v_start AND m.created_at < v_end
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_approval IS NOT NULL THEN
    SELECT * INTO v_trial FROM public.growth_trial_posts t WHERE t.approval_id = v_approval;
    IF NOT FOUND THEN
      -- never attach trial text and an assignment to a post made elsewhere
      RAISE EXCEPTION 'conflict: this platform was posted outside the trial tab today';
    END IF;
    RETURN jsonb_build_object('approval_id', v_approval, 'already_recorded', true, 'trial_date', v_trial.trial_date,
                              'variant', v_trial.variant, 'utm_campaign', v_trial.utm_campaign);
  END IF;

  v_variant := public.trial_variant(v_date, p_platform);
  v_campaign := CASE
    WHEN p_platform = 'facebook_intl' THEN 'intl-trial-' || to_char(v_date, 'YYYYMMDD')
    WHEN p_platform IN ('linkedin', 'whatsapp', 'telegram') THEN 'trial-' || to_char(v_date, 'YYYYMMDD')
    ELSE NULL END;

  INSERT INTO public.growth_agent_memory (article_id, platform, language, outcome, hook_line)
  VALUES (p_article_id, p_platform, p_language, 'approved', left(p_hook_line, 500))
  RETURNING id INTO v_approval;

  INSERT INTO public.growth_trial_posts
    (approval_id, article_id, platform, trial_date, variant, utm_campaign, post_text, comment_text, char_count,
     ends_with_question)
  VALUES (v_approval, p_article_id, p_platform, v_date, v_variant, v_campaign, p_post_text, p_comment_text,
          p_char_count, p_ends_with_question);

  RETURN jsonb_build_object('approval_id', v_approval, 'already_recorded', false, 'trial_date', v_date,
                            'variant', v_variant, 'utm_campaign', v_campaign);
END;
$$;

-- Roi's per-post LinkedIn numbers (p_kind 'comments' | 'impressions'), editable any time (January included). Each
-- kind keeps its own entry time and post age; entering one never touches the other.
CREATE FUNCTION public.record_trial_linkedin_metric(p_approval_id uuid, p_kind text, p_value integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_age numeric(8, 1);
BEGIN
  IF p_approval_id IS NULL OR p_kind NOT IN ('comments', 'impressions') OR p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'invalid: approval id, kind (comments | impressions) and a value >= 0 are required';
  END IF;
  SELECT round((extract(epoch FROM now() - m.created_at) / 3600)::numeric, 1) INTO v_age
  FROM public.growth_trial_posts t JOIN public.growth_agent_memory m ON m.id = t.approval_id
  WHERE t.approval_id = p_approval_id AND t.platform = 'linkedin';
  IF v_age IS NULL THEN
    RAISE EXCEPTION 'invalid: not a LinkedIn trial post';
  END IF;
  IF p_kind = 'comments' THEN
    UPDATE public.growth_trial_posts
      SET li_comments = p_value, li_comments_recorded_at = now(), li_comments_age_hours = v_age
      WHERE approval_id = p_approval_id;
  ELSE
    UPDATE public.growth_trial_posts
      SET li_impressions = p_value, li_impressions_recorded_at = now(), li_impressions_age_hours = v_age
      WHERE approval_id = p_approval_id;
  END IF;
  RETURN jsonb_build_object('approval_id', p_approval_id, 'kind', p_kind, 'value', p_value, 'age_hours', v_age);
END;
$$;

REVOKE ALL ON FUNCTION public.trial_variant(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_trial_post(text, text, text, text, text, text, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_trial_linkedin_metric(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_variant(date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trial_post(text, text, text, text, text, text, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trial_linkedin_metric(uuid, text, integer) TO service_role;
