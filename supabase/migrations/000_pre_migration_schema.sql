-- Migration 000: the tables that existed before the migration workflow (2026-10-12, infra-003)
--
-- pg_trgm and fifteen public tables were first created in the Supabase dashboard. Nine of them are created by no migration
-- (saved_articles, feature_flags, followed_tags, topic_syntheses, synthesis_feedback, digest_logs, digest_runs,
-- security_reports, sync_skipped_articles) and six only by 054, after earlier migrations already alter them
-- (articles_blacklist and the five analytics tables). So a database rebuilt from supabase/migrations/ stopped at 004.
-- This file creates all fifteen, first, in production's shape — generated from production's catalog
-- (harness_schema_report(), migration 080; supabase/schema.json). Every later migration that touches them is
-- idempotent (ADD COLUMN / CREATE INDEX IF NOT EXISTS, DROP … IF EXISTS, 054's guarded backfill), so they still
-- apply unchanged on top.
--
-- NEVER RUN ON PRODUCTION: production already has these tables. It is recorded there as applied without running
-- (`supabase migration repair --status applied 000`, on Roi's yes). Every statement is guarded anyway (IF NOT
-- EXISTS), so a run against production would change nothing.
-- Not here, on purpose: grants (081), policies and RLS (later migrations), and saved_articles' foreign key to
-- articles, which 001 creates after this file (added by 082).

-- pg_trgm: also from the dashboard era — 026 uses similarity() long before 054 creates the extension. Production has
-- it in public (its members are extension-owned, so the schema audit leaves them out).
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

CREATE TABLE IF NOT EXISTS public."saved_articles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "article_id" text,
  "saved_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "saved_articles_pkey" PRIMARY KEY (id),
  CONSTRAINT "saved_articles_user_id_article_id_key" UNIQUE (user_id, article_id),
  CONSTRAINT "saved_articles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."feature_flags" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "flag_name" text NOT NULL,
  "enabled" boolean DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now(),
  "updated_by" uuid,
  CONSTRAINT "feature_flags_flag_name_key" UNIQUE (flag_name),
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY (id),
  CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public."followed_tags" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "tag" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "followed_tags_pkey" PRIMARY KEY (id),
  CONSTRAINT "followed_tags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "followed_tags_user_id_tag_key" UNIQUE (user_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_followed_tags_user_id ON public.followed_tags USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."topic_syntheses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "query_normalized" text NOT NULL,
  "query_original" text,
  "synthesis_html" text NOT NULL,
  "article_ids" text[] NOT NULL,
  "article_count" integer,
  "study_type_breakdown" jsonb,
  "model_used" text,
  "generation_time_ms" integer,
  "cache_hits" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval),
  "hit_count" integer DEFAULT 0,
  "articles" jsonb,
  "user_id" uuid,
  "search_version" integer DEFAULT 1,
  CONSTRAINT "topic_syntheses_pkey" PRIMARY KEY (id),
  CONSTRAINT "topic_syntheses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_topic_syntheses_expires ON public.topic_syntheses USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_topic_syntheses_query ON public.topic_syntheses USING btree (query_normalized);
CREATE INDEX IF NOT EXISTS idx_topic_syntheses_user_id ON public.topic_syntheses USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."synthesis_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "query_normalized" text,
  "feedback" text,
  "feedback_note" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid,
  CONSTRAINT "synthesis_feedback_feedback_check" CHECK ((feedback = ANY (ARRAY['helpful'::text, 'not_relevant'::text]))),
  CONSTRAINT "synthesis_feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "synthesis_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_synthesis_feedback_query ON public.synthesis_feedback USING btree (query_normalized);
CREATE INDEX IF NOT EXISTS idx_synthesis_feedback_user_id ON public.synthesis_feedback USING btree (user_id);

CREATE TABLE IF NOT EXISTS public."digest_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "sent_at" timestamp with time zone DEFAULT now(),
  "articles_count" integer,
  "tags" text[],
  CONSTRAINT "digest_logs_pkey" PRIMARY KEY (id),
  CONSTRAINT "digest_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_digest_logs_sent_at ON public.digest_logs USING btree (sent_at DESC);

CREATE TABLE IF NOT EXISTS public."digest_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "triggered_by" text NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "total_users" integer DEFAULT 0 NOT NULL,
  "run_time_ms" integer NOT NULL,
  "status" text NOT NULL,
  "error_message" text,
  CONSTRAINT "digest_runs_pkey" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_digest_runs_created_at ON public.digest_runs USING btree (created_at DESC);

CREATE TABLE IF NOT EXISTS public."security_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_id" text NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now(),
  "triggered_by" text DEFAULT 'scheduled'::text,
  "severity" text,
  "findings_json" jsonb DEFAULT '[]'::jsonb,
  "fixes_json" jsonb DEFAULT '[]'::jsonb,
  "summary" text,
  "status" text DEFAULT 'active'::text,
  CONSTRAINT "security_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "security_reports_severity_check" CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'clean'::text])))
);

CREATE TABLE IF NOT EXISTS public."sync_skipped_articles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sync_run_at" timestamp with time zone DEFAULT now(),
  "pubmed_id" text,
  "title" text,
  "article_url" text,
  "reason" text,
  "journal" text,
  CONSTRAINT "sync_skipped_articles_pkey" PRIMARY KEY (id),
  CONSTRAINT "sync_skipped_articles_reason_check" CHECK ((reason = ANY (ARRAY['blacklisted'::text, 'no_abstract'::text, 'already_exists'::text, 'other'::text])))
);
CREATE INDEX IF NOT EXISTS idx_sync_skipped_run_at ON public.sync_skipped_articles USING btree (sync_run_at);

CREATE TABLE IF NOT EXISTS public."articles_blacklist" (
  "pubmed_id" text NOT NULL,
  "reason" text,
  "blacklisted_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "articles_blacklist_pkey" PRIMARY KEY (pubmed_id)
);

CREATE TABLE IF NOT EXISTS public."analytics_daily_snapshot" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "dau" integer DEFAULT 0,
  "wau" integer DEFAULT 0,
  "mau" integer DEFAULT 0,
  "new_sessions" integer DEFAULT 0,
  "total_searches" integer DEFAULT 0,
  "zero_result_searches" integer DEFAULT 0,
  "zero_result_rate" double precision DEFAULT 0,
  "synthesis_runs" integer DEFAULT 0,
  "synthesis_helpful" integer DEFAULT 0,
  "synthesis_not_relevant" integer DEFAULT 0,
  "articles_saved" integer DEFAULT 0,
  "avg_session_duration_seconds" integer DEFAULT 0,
  "top_searches" jsonb DEFAULT '[]'::jsonb,
  "top_saved_articles" jsonb DEFAULT '[]'::jsonb,
  "device_breakdown" jsonb DEFAULT '{}'::jsonb,
  "traffic_sources" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "median_session_duration_seconds" integer DEFAULT 0,
  "registered_mau" integer DEFAULT 0,
  "synthesis_engaged" integer DEFAULT 0,
  CONSTRAINT "analytics_daily_snapshot_date_key" UNIQUE (date),
  CONSTRAINT "analytics_daily_snapshot_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."analytics_signals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "type" text NOT NULL,
  "severity" double precision NOT NULL,
  "description" text NOT NULL,
  "data_json" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "analytics_signals_pkey" PRIMARY KEY (id),
  CONSTRAINT "analytics_signals_severity_check" CHECK (((severity >= (0)::double precision) AND (severity <= (1)::double precision))),
  CONSTRAINT "analytics_signals_type_check" CHECK ((type = ANY (ARRAY['search_gap'::text, 'churn_risk'::text, 'content_opportunity'::text, 'growth_signal'::text, 'retention_driver'::text, 'ux_problem'::text])))
);
CREATE INDEX IF NOT EXISTS idx_signals_date ON public.analytics_signals USING btree (date);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON public.analytics_signals USING btree (severity DESC);

CREATE TABLE IF NOT EXISTS public."analytics_insights" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_id" text NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now(),
  "insights_json" jsonb NOT NULL,
  "top_3_actions" jsonb DEFAULT '[]'::jsonb,
  "content_roadmap" jsonb DEFAULT '[]'::jsonb,
  "churn_risks" jsonb DEFAULT '[]'::jsonb,
  "model_used" text,
  "tokens_used" integer,
  "status" text DEFAULT 'active'::text,
  "report_markdown" text,
  CONSTRAINT "analytics_insights_pkey" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_insights_generated ON public.analytics_insights USING btree (generated_at DESC);

CREATE TABLE IF NOT EXISTS public."analytics_insight_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "insight_id" uuid,
  "insight_index" integer,
  "action" text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "analytics_insight_feedback_action_check" CHECK ((action = ANY (ARRAY['implemented'::text, 'ignored'::text, 'noted'::text]))),
  CONSTRAINT "analytics_insight_feedback_insight_id_fkey" FOREIGN KEY (insight_id) REFERENCES public.analytics_insights(id),
  CONSTRAINT "analytics_insight_feedback_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."analytics_opportunities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "topic" text NOT NULL,
  "search_count" integer DEFAULT 0,
  "zero_result_rate" double precision DEFAULT 0,
  "save_count" integer DEFAULT 0,
  "opportunity_score" double precision DEFAULT 0,
  "suggested_at" timestamp with time zone DEFAULT now(),
  "status" text DEFAULT 'pending'::text,
  CONSTRAINT "analytics_opportunities_pkey" PRIMARY KEY (id),
  CONSTRAINT "analytics_opportunities_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'done'::text, 'dismissed'::text])))
);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON public.analytics_opportunities USING btree (opportunity_score DESC);
