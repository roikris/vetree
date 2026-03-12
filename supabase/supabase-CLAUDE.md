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
| abstract | text | |
| summary | text | AI-generated |
| clinical_bottom_line | text | AI-generated — must exist to show publicly |
| labels | text[] | GIN indexed |
| source_journal | text | |
| published_date | date | |
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
| type | text ('article'/'bug') |
| message | text |

### `growth_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| day_number | integer | |
| scheduled_date | date | |
| platform | text | |
| language | text | 'he'/'en' |
| status | text | pending/done/skipped |

### `growth_agent_memory`
| Column | Type |
|--------|------|
| article_id | text FK → articles |
| platform | text |
| language | text |
| outcome | text ('approved'/'skipped') |
| skip_reason | text |
| hook_line | text |

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
| duration_seconds | integer | |
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

### `digest_logs`
| Column | Type |
|--------|------|
| user_id | uuid FK |
| sent_at | timestamptz |
| articles_count | integer |
| tags | text[] |

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

## Storage
- Bucket: `avatars` (public)
- Path: `{user_id}/avatar.jpg`
- Stored in user metadata as `avatar_url`

## GIN Index (for labels filtering)
```sql
CREATE INDEX IF NOT EXISTS idx_articles_labels_gin ON articles USING GIN (labels);
-- Use in Supabase: .overlaps('labels', tagsArray)
```
