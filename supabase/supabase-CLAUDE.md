# Supabase Guide — Vetree

## Connection
```ts
// Public client (anon key) — respects RLS
import { createClient } from '@/lib/supabase/client'        // client component
import { createClient } from '@/lib/supabase/server'        // server component / route

// Admin client (service role) — bypasses RLS, for admin routes only
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

## Database Schema

### `articles`
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | PubMed ID format |
| title | text | |
| abstract | text | |
| summary | text | AI-generated, null until enriched |
| clinical_bottom_line | text | AI-generated, null until enriched |
| labels | text[] | e.g. ["Cardiology","Small Animal"] |
| source_journal | text | |
| published_date | date | |
| needs_enrichment | boolean | false = ready to show publicly |
| enrichment_attempts | integer | capped at 3 |
| force_retry | boolean | admin override for re-enrichment |
| created_at | timestamptz | |

**Public filter (always apply for user-facing queries):**
```ts
.eq('needs_enrichment', false)
.not('summary', 'is', null)
.not('clinical_bottom_line', 'is', null)
```

**Large animal exclusion (content agent):**
```ts
// Use JS filter after fetch — Supabase array syntax unreliable
const LARGE_ANIMAL = ['Equine', 'equine', 'Large Animal', 'large animal', 'Livestock', 'livestock', 'Poultry', 'poultry', 'Food Animal', 'food animal']
const filtered = articles.filter(a => !a.labels?.some(l => LARGE_ANIMAL.includes(l)))
```

### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid FK → auth.users | |
| role | text | 'admin' or 'user' |

### `saved_articles`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid FK | |
| article_id | text FK → articles | |
| created_at | timestamptz | |

### `reports`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| article_id | text | |
| type | text | 'article' or 'bug' |
| message | text | |
| created_at | timestamptz | |

### `growth_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| day_number | integer | |
| scheduled_date | date | |
| platform | text | twitter/facebook_il/whatsapp/etc |
| language | text | 'he' or 'en' |
| content | text | |
| article_id | text | |
| status | text | pending/done/skipped |

### `growth_agent_memory`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| article_id | text FK → articles | |
| platform | text | |
| language | text | |
| outcome | text | 'approved' or 'skipped' |
| skip_reason | text | |
| hook_line | text | |

### `growth_agent_preferences`
| Column | Type | Notes |
|--------|------|-------|
| preferred_specialties | text[] | learned over time |
| avoided_specialties | text[] | |
| preferred_hook_styles | text[] | |
| avoided_hook_styles | text[] | |
| approved_count | integer | |
| skipped_count | integer | |

### `page_views`
| Column | Type | Notes |
|--------|------|-------|
| path | text | |
| ip_hash | text | SHA-256 hashed, never raw IP |
| user_id | uuid nullable | |
| session_id | text | |
| duration_seconds | integer | |
| created_at | timestamptz | |

### `search_logs`
| Column | Type | Notes |
|--------|------|-------|
| query | text | |
| results_count | integer | |
| user_id | uuid nullable | |
| ip_hash | text | |

## RLS Patterns

### Public read, no write
```sql
CREATE POLICY "Public read" ON table_name FOR SELECT USING (true);
```

### User owns row
```sql
CREATE POLICY "User owns" ON table_name FOR ALL USING (auth.uid() = user_id);
```

### Admin only
```sql
CREATE POLICY "Admins only" ON table_name FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
```

### Public insert (analytics)
```sql
CREATE POLICY "Anyone can insert" ON table_name FOR INSERT WITH CHECK (true);
```

## SQL Function Security (Required)
All custom functions must have search_path set:
```sql
ALTER FUNCTION public.function_name() SET search_path = public;
```

## Storage
- Bucket: `avatars` (public)
- Path pattern: `{user_id}/avatar.jpg`
- Stored in user metadata as `avatar_url`
