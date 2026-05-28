-- Migration 029: Explicit table grants for all 25 application tables
--
-- Supabase is removing implicit public schema grants on 2026-10-30.
-- Without explicit grants, queries will fail with error 42501 (permission denied).
-- This migration adds explicit grants matching each table's intended access pattern.
--
-- Access tiers:
--   postgres / service_role  — full DML (service role bypasses RLS but still needs object grants)
--   authenticated            — what their RLS policies permit; grant the right verbs per table
--   anon                     — only publicly-accessible tables + INSERT-only tracking tables
--
-- RLS policies already in place remain unchanged — grants are the outer gate,
-- RLS is the inner gate. Being liberal with grants and strict with RLS is correct.
--
-- No sequence grants needed: all tables use uuid DEFAULT gen_random_uuid() PKs.
--
-- Run in Supabase SQL Editor.

-- Schema usage (safe to re-run, GRANT is idempotent in PostgreSQL)
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon, service_role;

-- ================================================================
-- PUBLICLY READABLE TABLES
-- ================================================================

-- articles: public read, enrichment pipeline writes via service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO postgres, service_role;
GRANT SELECT ON public.articles TO authenticated, anon;

-- topic_syntheses: AI synthesis results, publicly readable (synthesis pages accessible to guests)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_syntheses TO postgres, service_role;
GRANT SELECT ON public.topic_syntheses TO authenticated, anon;

-- feature_flags: admin writes, app reads for feature gating (may gate public-facing features)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO postgres, service_role;
GRANT SELECT ON public.feature_flags TO authenticated, anon;

-- ================================================================
-- TRACKING TABLES  (INSERT open to all, SELECT admin-only via RLS)
-- ================================================================

-- page_views: anyone records a page view, only admins can read via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_views TO postgres, service_role;
GRANT INSERT ON public.page_views TO authenticated, anon;

-- search_logs: anyone records a search, only admins can read via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_logs TO postgres, service_role;
GRANT INSERT ON public.search_logs TO authenticated, anon;

-- ================================================================
-- USER-OWNED TABLES  (authenticated users manage their own rows via RLS)
-- ================================================================

-- saved_articles: users save/unsave articles (SELECT + INSERT + DELETE own rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_articles TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;

-- followed_tags: users manage their tag subscriptions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followed_tags TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.followed_tags TO authenticated;

-- user_preferences: users read + update their own preferences
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;

-- user_consents: users insert consent at signup, admins read all
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_consents TO postgres, service_role;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;

-- synthesis_feedback: authenticated users submit thumbs-up/down on syntheses
GRANT SELECT, INSERT, UPDATE, DELETE ON public.synthesis_feedback TO postgres, service_role;
GRANT SELECT, INSERT ON public.synthesis_feedback TO authenticated;

-- reports: authenticated users file content/bug reports, admins manage
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO postgres, service_role;
GRANT SELECT, INSERT ON public.reports TO authenticated;

-- ================================================================
-- ROLE TABLE
-- ================================================================

-- user_roles: users SELECT their own role (to check admin status), admins manage via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO postgres, service_role;
GRANT SELECT ON public.user_roles TO authenticated;

-- ================================================================
-- ADMIN / SERVICE-ROLE-ONLY TABLES
-- Written by background agents (service_role). Admin UI queries through
-- authenticated session — RLS policies require admin role and block others.
-- Granting SELECT/INSERT/UPDATE to authenticated is safe: RLS is the real gate.
-- ================================================================

-- analytics_daily_snapshot: written by analysis agent, read by admin dashboard
-- (partial grants already added in migration 025 — re-granting is idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_daily_snapshot TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_daily_snapshot TO authenticated;

-- analytics_insight_feedback: admin feedback on AI-generated insights
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insight_feedback TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_insight_feedback TO authenticated;

-- analytics_insights: Claude-generated weekly insights, admin reads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_insights TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_insights TO authenticated;

-- analytics_opportunities: content opportunities detected by analysis agent
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_opportunities TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_opportunities TO authenticated;

-- analytics_signals: aggregated weekly signals, input to insights generation
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_signals TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.analytics_signals TO authenticated;

-- articles_blacklist: admin list of permanently excluded article IDs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles_blacklist TO postgres, service_role;
GRANT SELECT ON public.articles_blacklist TO authenticated;

-- digest_logs: per-user delivery log written by digest pipeline
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_logs TO postgres, service_role;
GRANT SELECT ON public.digest_logs TO authenticated;

-- digest_runs: digest run metadata written by pipeline
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_runs TO postgres, service_role;
GRANT SELECT ON public.digest_runs TO authenticated;

-- growth_agent_memory: campaign content history, admin only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_memory TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.growth_agent_memory TO authenticated;

-- growth_agent_preferences: learned content preferences, admin only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_preferences TO postgres, service_role;
GRANT SELECT, UPDATE ON public.growth_agent_preferences TO authenticated;

-- growth_tasks: 90-day campaign task schedule, admin only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_tasks TO postgres, service_role;
GRANT SELECT ON public.growth_tasks TO authenticated;

-- security_reports: written by security scan agent, read by admin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_reports TO postgres, service_role;
GRANT SELECT ON public.security_reports TO authenticated;

-- sync_skipped_articles: PubMed sync skip list, admin pipeline management
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_skipped_articles TO postgres, service_role;
GRANT SELECT ON public.sync_skipped_articles TO authenticated;
