# Supabase Guide — Vetree

## Connection
```ts
// Client components
import { createClient } from '@/lib/supabase/client'
// Server components / API routes (respects RLS)
import { createClient } from '@/lib/supabase/server'
// Admin (bypasses RLS) — API routes only
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
```

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
.select('id, title, clinical_bottom_line, labels, source_journal, published_date, strength_of_evidence, authors, article_url, doi, pubmed_id')

// For individual article page only
.select('id, title, clinical_bottom_line, summary, labels, source_journal, published_date, strength_of_evidence, authors, article_url, doi, pubmed_id')
```

## Large Animal Exclusion — JS ONLY (Supabase syntax unreliable)
```ts
const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']
const filtered = articles.filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
```

## Exclude Admin from Analytics
```ts
.or('user_id.is.null,user_id.neq.90cb8294-b593-4144-a9f5-23ca52dd5e35')
```

## Tables

### `articles`
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | PubMed ID |
| title | text | |
| abstract | text | Must be ≥50 chars or skip enrichment |
| summary | text | AI-generated, fetch lazily |
| clinical_bottom_line | text | AI-generated — must exist to show publicly |
| labels | text[] | GIN indexed |
| source_journal | text | |
| published_date | date | |
| article_url | text | |
| doi | text | |
| authors | text | |
| pubmed_id | text | UNIQUE constraint |
| needs_enrichment | boolean | false = ready |
| enrichment_attempts | integer | capped at 3 |
| force_retry | boolean | admin override |
| quarantined | boolean | hidden from public |
| last_enrichment_error | text | error message |
| last_enrichment_at | timestamptz | |

### `user_roles`
| Column | Type |
|--------|------|
| user_id | uuid FK → auth.users |
| role | text ('admin'/'user') |

### `saved_articles`
| Column | Type |
|--------|------|
| user_id | uuid FK |
| article_id | text FK → articles |
| created_at | timestamptz |

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

### `search_logs`
| Column | Type |
|--------|------|
| query | text |
| results_count | integer |
| user_id | uuid nullable |
| ip_hash | text |
| created_at | timestamptz |

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
| model_used | text | |
| generation_time_ms | integer | |
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
| Column | Type |
|--------|------|
| date | date UNIQUE |
| dau | integer |
| wau | integer |
| mau | integer |
| total_searches | integer |
| zero_result_searches | integer |
| zero_result_rate | float |
| synthesis_runs | integer |
| synthesis_helpful | integer |
| articles_saved | integer |
| avg_session_duration_seconds | integer |
| median_session_duration_seconds | integer |
| top_searches | jsonb |
| traffic_sources | jsonb |

### `analytics_signals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| date | date | |
| type | text | 'search_gap'/'churn_risk'/'content_opportunity'/'growth_signal'/'retention_driver'/'ux_problem' |
| severity | float | 0.0–1.0 |
| description | text | |
| data_json | jsonb | |

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

## SQL Function Security (required)
```sql
ALTER FUNCTION public.function_name() SET search_path = public;
```

## Fuzzy Search RPC
```ts
// 3-tier search: FTS → ILIKE → trigram similarity
// Tier 3 uses search_articles_fuzzy RPC (pg_trgm extension required)
const { data } = await supabase.rpc('search_articles_fuzzy', {
  search_query: query,
  similarity_threshold: 0.3
})
```

## Storage
- Bucket: `avatars` (public)
- Path: `{user_id}/avatar.jpg`
- Stored in user metadata as `avatar_url`

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
