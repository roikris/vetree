# Supabase Guide — Vetree

## Connection
```ts
// Client components
import { createClient } from '@/lib/supabase/client'
// Server components / API routes (respects RLS, reads session from cookies)
import { createClient } from '@/lib/supabase/server'
// Admin (bypasses RLS) — API routes only, NEVER in client or server components
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
```

**Never import `@/lib/supabase/client` in server-side code.** It uses the anon key, so RLS applies
and reads return empty 200 instead of errors — silent data corruption. ESLint enforces this.

## Public Article Filter (always apply for user-facing queries)
```ts
.eq('needs_enrichment', false)
.not('summary', 'is', null)
.not('clinical_bottom_line', 'is', null)
.or('quarantined.is.null,quarantined.eq.false')
```

## Article List Select (never use select('*') for lists)
```ts
// For article cards — summary fetched lazily on expand
// Column name is publication_date — verified in information_schema; schema is source of truth
.select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence, authors, article_url, doi, pubmed_id')

// For individual article page only
.select('id, title, clinical_bottom_line, summary, labels, source_journal, publication_date, strength_of_evidence, authors, article_url, doi, pubmed_id')
```

## Large Animal Exclusion — JS ONLY (Supabase syntax unreliable)
```ts
const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']
const filtered = articles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
```

## Exclude Admin + TEST_USER_ID from Analytics
Always use the shared helper — never hand-roll the filter:
```ts
import { excludedUsersOrFilter, EXCLUDED_USER_IDS } from '@/lib/analytics-excluded-ids'
// In queries:
.or(excludedUsersOrFilter())
```
- `EXCLUDED_USER_IDS` = admin UUID + TEST_USER_ID (if env var is set and UUID-valid)
- For 2+ IDs the helper uses `and(neq.A,neq.B)` — flat OR would wrongly include excluded users
- The `analytics_daily_snapshot` table is pre-filtered (aggregate route excludes them)
- Raw table queries (page_views, search_logs, etc.) are NOT pre-filtered — add the helper manually

## Tables

Column names verified against information_schema and migrations. Schema is the source of truth.

### `articles`
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | PubMed ID |
| title | text | |
| summary | text | AI-generated, fetch lazily |
| clinical_bottom_line | text | AI-generated — must exist to show publicly |
| labels | text[] | GIN indexed |
| source_journal | text | |
| publication_date | date | NOT published_date |
| article_url | text | |
| doi | text | |
| authors | text | |
| pubmed_id | text | UNIQUE constraint |
| needs_enrichment | boolean | false = ready |
| enrichment_attempts | integer | capped at 3 |
| force_retry | boolean | admin override |
| quarantined | boolean | hidden from public |
| last_enrichment_error | text | |
| last_enrichment_at | timestamptz | |

### `user_roles`
| Column | Type |
|--------|------|
| user_id | uuid FK → auth.users |
| role | text ('admin'/'user') |

Use `.maybeSingle()` not `.single()` — non-admin users have no row, `.single()` returns 406.

### `saved_articles`
| Column | Type |
|--------|------|
| user_id | uuid FK |
| article_id | text FK → articles |
| saved_at | timestamptz | NOT created_at |

### `user_preferences`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid PK FK → auth.users | |
| digest_opt_out | boolean | DEFAULT false |
| digest_opted_out_at | timestamptz | set when opt-out |
| updated_at | timestamptz | |

Digest exclusion is here, NOT on a profiles table (no profiles table exists).

### `followed_tags`
| Column | Type |
|--------|------|
| user_id | uuid FK |
| tag | text |
| created_at | timestamptz |
UNIQUE(user_id, tag)

### `reports`
| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid FK |
| article_id | text |
| type | text ('article_issue'/'bug'/'other') |
| description | text |
| status | text ('open'/'in_progress'/'resolved') |
| admin_notes | text |

### `growth_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| day_number | integer | |
| scheduled_date | date | |
| platform | text | |
| language | text | 'he'/'en' |
| status | text | pending/done/skipped |
| content | text | nullable — set on approve |

### `growth_agent_memory`
| Column | Type |
|--------|------|
| article_id | text FK → articles |
| platform | text |
| language | text |
| outcome | text ('approved'/'skipped') |
| skip_reason | text |
| hook_line | text |
| posted_url | text | LinkedIn post URL (migration 039) |
| created_at | timestamptz |

### `growth_agent_preferences`
| Column | Type |
|--------|------|
| preferred_specialties | text[] |
| avoided_specialties | text[] |
| preferred_hook_styles | text[] |
| avoided_hook_styles | text[] |
| approved_count | integer |
| skipped_count | integer |

### `page_views`
| Column | Type | Notes |
|--------|------|-------|
| path | text | |
| ip_hash | text | SHA-256, never raw IP |
| user_id | uuid nullable | |
| session_id | text | |
| duration_seconds | integer | capped at 1800 (30 min) |
| country | text | from x-vercel-ip-country |
| device_type | text | mobile/desktop/tablet |
| utm_source | text | |
| utm_medium | text | |
| utm_campaign | text | |
| created_at | timestamptz | |

Note: `page_views` is also used for `/synthesis/run` tracking (path = '/synthesis/run').
Funnel events (save_intent_*) go to `analytics_events`, NOT page_views.

### `search_logs`
| Column | Type |
|--------|------|
| query | text |
| results_count | integer |
| user_id | uuid nullable |
| ip_hash | text |
| created_at | timestamptz |

### `analytics_events`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_name | text | save_intent_arrived / save_intent_auth_shown / save_intent_completed |
| article_id | text nullable FK → articles | ON DELETE SET NULL |
| user_id | uuid nullable | |
| created_at | timestamptz | |

Admin-only read policy. Public insert policy. Never write funnel events to page_views.

### `digest_logs`
| Column | Type |
|--------|------|
| user_id | uuid FK |
| sent_at | timestamptz |
| articles_count | integer |
| tags | text[] |

### `digest_runs`
| Column | Type |
|--------|------|
| id | uuid PK |
| run_at | timestamptz |
| triggered_by | text ('scheduled'/'manual') |
| sent_count | integer |
| status | text ('success'/'error') |

### `topic_syntheses`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| query_normalized | text | lowercase, stopwords removed |
| query_original | text | |
| synthesis_html | text | markdown rendered |
| articles | jsonb | array of {citation_id, id, title, journal, year} |
| article_ids | text[] | |
| article_count | integer | |
| study_type_breakdown | jsonb | |
| search_version | integer | >= 2 = ranked RPC search (older = legacy, ignored) |
| model_used | text | |
| generation_time_ms | integer | |
| hit_count | integer | increment on reuse |
| cache_hits | integer | increment on reuse |
| expires_at | timestamptz | 7 days from creation |
| user_id | uuid nullable | |
| created_at | timestamptz | |

### `synthesis_feedback`
| Column | Type |
|--------|------|
| id | uuid PK |
| query_normalized | text |
| feedback | text ('helpful'/'not_relevant') |
| feedback_note | text |
| user_id | uuid nullable |
| created_at | timestamptz |

### `articles_blacklist`
| Column | Type | Notes |
|--------|------|-------|
| pubmed_id | text PK | |
| reason | text | 'admin_deleted'/'auto_quarantined' |
| blacklisted_at | timestamptz | |

### `feature_flags`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| flag_name | text UNIQUE | e.g. 'topic_synthesis' |
| enabled | boolean | |
| updated_at | timestamptz | |
| updated_by | uuid FK | |

### `analytics_daily_snapshot`
Written by aggregate route; pre-filtered (admin + TEST_USER_ID excluded).

| Column | Type |
|--------|------|
| date | date UNIQUE |
| dau | integer |
| wau | integer |
| mau | integer |
| registered_mau | integer |
| total_searches | integer |
| zero_result_searches | integer |
| zero_result_rate | float |
| synthesis_runs | integer |
| synthesis_engaged | integer |
| synthesis_helpful | integer |
| synthesis_not_relevant | integer |
| articles_saved | integer |
| avg_session_duration_seconds | integer |
| median_session_duration_seconds | integer |
| top_searches | jsonb |
| top_saved_articles | jsonb |
| device_breakdown | jsonb |
| traffic_sources | jsonb |

### `analytics_signals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| date | date | |
| type | text | search_gap / churn_risk / content_opportunity / growth_signal / retention_driver / ux_problem / data_gap |
| severity | float | 0.0–1.0 |
| description | text | |
| data_json | jsonb | |

`data_gap` (severity 0.9) fires when total_searches == 0 in latest snapshot — logging sensor failure.

### `analytics_insights`
| Column | Type |
|--------|------|
| id | uuid PK |
| run_id | text |
| generated_at | timestamptz |
| insights_json | jsonb |
| top_3_actions | jsonb |
| content_roadmap | jsonb |
| churn_risks | jsonb |
| report_markdown | text |
| model_used | text |
| tokens_used | integer |

### `analytics_insight_feedback`
| Column | Type |
|--------|------|
| id | uuid PK |
| insight_id | uuid FK |
| insight_index | integer |
| action | text ('implemented'/'ignored'/'noted') |
| note | text |

### `analytics_opportunities`
| Column | Type |
|--------|------|
| id | uuid PK |
| topic | text |
| search_count | integer |
| zero_result_rate | float |
| opportunity_score | float |
| status | text ('pending'/'in_progress'/'done'/'dismissed') |

### `security_reports`
| Column | Type |
|--------|------|
| id | uuid PK |
| run_id | text |
| generated_at | timestamptz |
| triggered_by | text ('scheduled'/'manual') |
| severity | text ('critical'/'high'/'medium'/'low'/'clean') |
| findings_json | jsonb |
| fixes_json | jsonb |
| summary | text |

### `linkedin_post_metrics`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| post_url | text UNIQUE | idempotency key |
| post_date | date | |
| article_id | text FK → articles nullable | null if unmatched |
| impressions | integer nullable | |
| engagements | integer nullable | |
| match_method | text | activity_id / slug / date / ai / haiku / manual |
| raw_row | jsonb | original import row |
| uploaded_at | timestamptz | |
| metrics_updated_at | timestamptz | when impressions/engagements were last written (XLSX upload or manual edit) |

`match_method` constraint (live, fully reconciled via migrations 038→040→042→043→045):
`('activity_id', 'slug', 'date', 'ai', 'haiku', 'manual', 'no_article', 'cleared')`
- `'ai'` — written by current matcher (post-Sonnet migration); added in migration 042
- `'haiku'` — legacy value on pre-migration rows; still accepted
- `'no_article'` — reshares/group posts with no article; added in migration 043
- `'cleared'` — admin manually unassigned an erroneous article match (article_id set to null); added in migration 045. Distinct from `'no_article'`: a cleared row still needs assignment. Excluded from the automatic rematch pass — only resolvable via the manual picker or explicit "no article".

### `linkedin_daily_metrics`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| metric_date | date UNIQUE | |
| impressions | integer nullable | |
| engagements | integer nullable | |
| new_followers | integer nullable | |
| total_followers | integer nullable | only on LinkedIn snapshot dates |
| uploaded_at | timestamptz | |

## RLS Patterns
```sql
-- Public read
CREATE POLICY "Public read" ON t FOR SELECT USING (true);

-- User owns row
CREATE POLICY "User owns" ON t FOR ALL USING (auth.uid() = user_id);

-- Admin only
CREATE POLICY "Admins only" ON t FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Public insert (analytics)
CREATE POLICY "Anyone can insert" ON t FOR INSERT WITH CHECK (true);
```

## Required Grants (Supabase enforces from Oct 30, 2026)
Every new table needs explicit GRANTs or gets 42501 errors. Add after RLS policies:
```sql
GRANT SELECT ON public.table_name TO anon;                              -- if public read
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_name TO authenticated; -- adjust as needed
GRANT ALL ON public.table_name TO service_role;
```

## SQL Function Security (required)
```sql
ALTER FUNCTION public.function_name() SET search_path = public;
```

## Fuzzy Search RPC (main feed)
3-tier fallback: FTS → ILIKE → trigram similarity
```ts
// Tier 3 uses search_articles_fuzzy RPC (pg_trgm extension required)
const { data } = await supabase.rpc('search_articles_fuzzy', {
  search_query: query,
  similarity_threshold: 0.3
})
```

## Synthesis Search RPC (synthesis only — different from feed search)
Single RPC call, not the 3-tier fallback:
```ts
const { data } = await supabase.rpc('search_articles_synthesis', {
  search_query: queryNormalized,
  candidate_limit: 50,
  final_limit: 15
})
```

## Storage
- Bucket: `avatars` (private — signed URLs via /api/avatars/[userId], 1-hour TTL, service role)
- Path: `{user_id}/avatar.jpg`

## GIN Index (for labels filtering)
```sql
CREATE INDEX IF NOT EXISTS idx_articles_labels_gin ON articles USING GIN (labels);
-- Use in Supabase: .overlaps('labels', tagsArray)
```

## Filter Caching
```ts
// Journal and evidence level lists are cached 1 hour via unstable_cache
// Do NOT re-fetch these on every page navigation
import { unstable_cache } from 'next/cache'
```
