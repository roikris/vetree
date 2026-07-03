# Analytics Insights Data Quality Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three data quality bugs in the Analysis Agent that cause it to miss anonymous search data, never detect churn, and report inflated user counts.

**Architecture:** Two edits to `insights/route.ts` (query bugs), one migration + aggregate update for registered MAU tracking. No new routes, no new UI.

**Tech Stack:** Next.js API routes, Supabase PostgreSQL, TypeScript.

---

## Problem Summary

| Bug | File | Root Cause | Impact |
|---|---|---|---|
| Anonymous searches excluded | `insights/route.ts` lines 114, 125 | `.neq('user_id', adminId)` also drops NULL rows (CLAUDE.md rule #5) | Most zero-result/thin-result searches missing from agent data |
| Churn detection always empty | `insights/route.ts` lines 145–156 | Queries use `viewed_at` but column is `created_at` | Churn candidates always 0, churn section always "None detected" |
| MAU inflated (visitors vs users) | `aggregate/route.ts` | `mau` = distinct `ip_hash` (bots + anonymous + registered) | Stickiness (DAU/MAU) calculation meaningless |

---

## File Map

| File | Change |
|---|---|
| `app/api/admin/analytics/insights/route.ts` | Fix `.neq` → `.or(is.null,neq)` on search_logs queries; fix `viewed_at` → `created_at` on page_views queries |
| `app/api/admin/analytics/aggregate/route.ts` | Add `registeredMau` computation and store in snapshot |
| `supabase/migrations/025_add_registered_mau.sql` | Add `registered_mau` column to `analytics_daily_snapshot` |

---

## Task 1: Fix anonymous searches excluded from insights

**Files:**
- Modify: `app/api/admin/analytics/insights/route.ts` (lines ~110–128)

**Root cause:** `.neq('user_id', adminId)` on `search_logs` excludes both `adminId` rows AND rows where `user_id IS NULL`. Anonymous searches (the majority of user searches from non-logged-in vets) have `user_id = null`, so they're silently dropped from the `zeroResultQueries` and `thinResultQueries` arrays. The `specificDataSection` Claude receives is mostly empty even when there is real search demand.

- [ ] **Step 1: Edit `app/api/admin/analytics/insights/route.ts`**

Find (around lines 110–128):

```ts
// Zero-result searches (exact queries users searched with no results)
const { data: zeroResultQueries } = await supabase
  .from('search_logs')
  .select('query, results_count, created_at')
  .eq('results_count', 0)
  .neq('user_id', adminId)
  .gte('created_at', sevenDaysAgoISO)
  .order('created_at', { ascending: false })
  .limit(20)

// Thin-result searches (1-4 results — sparse coverage)
const { data: thinResultQueries } = await supabase
  .from('search_logs')
  .select('query, results_count, created_at')
  .gt('results_count', 0)
  .lte('results_count', 4)
  .neq('user_id', adminId)
  .gte('created_at', sevenDaysAgoISO)
  .order('created_at', { ascending: false })
  .limit(20)
```

Replace with:

```ts
// Zero-result searches (exact queries users searched with no results)
const { data: zeroResultQueries } = await supabase
  .from('search_logs')
  .select('query, results_count, created_at')
  .eq('results_count', 0)
  .or(`user_id.is.null,user_id.neq.${adminId}`)
  .gte('created_at', sevenDaysAgoISO)
  .order('created_at', { ascending: false })
  .limit(20)

// Thin-result searches (1-4 results — sparse coverage)
const { data: thinResultQueries } = await supabase
  .from('search_logs')
  .select('query, results_count, created_at')
  .gt('results_count', 0)
  .lte('results_count', 4)
  .or(`user_id.is.null,user_id.neq.${adminId}`)
  .gte('created_at', sevenDaysAgoISO)
  .order('created_at', { ascending: false })
  .limit(20)
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/analytics/insights/route.ts
git commit -m "Fix: include anonymous searches in insights data (neq excluded null user_id)"
```

---

## Task 2: Fix churn detection — wrong column name on page_views

**Files:**
- Modify: `app/api/admin/analytics/insights/route.ts` (lines ~141–156)

**Root cause:** The churn detection queries filter `page_views` using `.gte('viewed_at', ...)` and `.lt('viewed_at', ...)`. The `page_views` table has no `viewed_at` column — the column is `created_at`. Supabase silently returns empty results when filtering on a non-existent column (no error thrown). This means `recentActiveUsers` and `recentReturnedUsers` are always empty arrays, so `churnCandidateIds` is always `[]`, and the agent always reports "None — good retention this week" regardless of actual user behavior.

- [ ] **Step 1: Edit `app/api/admin/analytics/insights/route.ts`**

Find (around lines 141–156):

```ts
const { data: recentActiveUsers } = await supabase
  .from('page_views')
  .select('user_id, viewed_at')
  .not('user_id', 'is', null)
  .neq('user_id', adminId)
  .gte('viewed_at', twentyEightDaysAgoISO)
  .lt('viewed_at', sevenDaysAgoISO)
  .order('viewed_at', { ascending: false })
  .limit(200)

const { data: recentReturnedUsers } = await supabase
  .from('page_views')
  .select('user_id')
  .not('user_id', 'is', null)
  .neq('user_id', adminId)
  .gte('viewed_at', sevenDaysAgoISO)
  .limit(500)
```

Replace with:

```ts
const { data: recentActiveUsers } = await supabase
  .from('page_views')
  .select('user_id, created_at')
  .not('user_id', 'is', null)
  .neq('user_id', adminId)
  .gte('created_at', twentyEightDaysAgoISO)
  .lt('created_at', sevenDaysAgoISO)
  .order('created_at', { ascending: false })
  .limit(200)

const { data: recentReturnedUsers } = await supabase
  .from('page_views')
  .select('user_id')
  .not('user_id', 'is', null)
  .neq('user_id', adminId)
  .gte('created_at', sevenDaysAgoISO)
  .limit(500)
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/analytics/insights/route.ts
git commit -m "Fix: churn detection uses created_at not viewed_at on page_views"
```

---

## Task 3: Add registered_mau to aggregate snapshot

**Files:**
- Create: `supabase/migrations/025_add_registered_mau.sql`
- Modify: `app/api/admin/analytics/aggregate/route.ts`

**Root cause:** `mau` in `analytics_daily_snapshot` counts distinct `ip_hash` across all page views — this includes bots, crawlers, anonymous visitors, and every social media link preview. The real MAU of 372 reported in the insights briefing for a platform with ~15 registered users makes DAU/MAU stickiness (reported as 4.8%) meaningless. A separate `registered_mau` counting only distinct authenticated users gives the agent a meaningful denominator.

The insights route already fetches the full snapshot and sends it to Claude, so adding this column makes the data available automatically without any further changes to the prompt.

- [ ] **Step 1: Create `supabase/migrations/025_add_registered_mau.sql`**

```sql
-- Add registered_mau to analytics_daily_snapshot
-- Tracks distinct authenticated (non-anonymous, non-admin) users active in the last 30 days.
-- Separate from mau which counts all IP hashes including bots and anonymous visitors.
ALTER TABLE analytics_daily_snapshot
  ADD COLUMN IF NOT EXISTS registered_mau integer DEFAULT 0;

GRANT SELECT ON public.analytics_daily_snapshot TO anon;
GRANT SELECT, INSERT, UPDATE ON public.analytics_daily_snapshot TO authenticated;
GRANT ALL ON public.analytics_daily_snapshot TO service_role;
```

Apply this via Supabase dashboard → SQL editor, or Supabase CLI (`supabase db push`).

- [ ] **Step 2: Edit `app/api/admin/analytics/aggregate/route.ts`**

After the existing MAU block (after line 52 — `const mau = new Set(...).size`), add a new block:

```ts
// Registered MAU — distinct authenticated users (non-admin, non-null user_id) in last 30 days
// This is the real user count; mau above includes all visitors including anonymous/bots
const { data: registeredMauData } = await supabase
  .from('page_views')
  .select('user_id')
  .not('user_id', 'is', null)
  .neq('user_id', adminId)
  .gte('created_at', thirtyDaysAgo)
const registeredMau = new Set(registeredMauData?.map(r => r.user_id) ?? []).size
```

Then in the `.upsert({...})` object, add `registered_mau` alongside the existing `mau` field:

Find:
```ts
mau: mau,
```

Replace with:
```ts
mau: mau,
registered_mau: registeredMau,
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/025_add_registered_mau.sql app/api/admin/analytics/aggregate/route.ts
git commit -m "Add registered_mau to aggregate snapshot — separate from visitor-based mau"
```

---

## Self-Review

**Spec coverage:**
| Bug | Task |
|---|---|
| Anonymous searches excluded from agent data | Task 1 ✓ |
| Churn candidates always 0 | Task 2 ✓ |
| MAU stickiness misleading | Task 3 ✓ |

**Placeholder scan:** No TBDs, no "implement later". All code shown in full.

**Type consistency:** No new types. `registeredMau: number` matches existing `mau: number` in the upsert. All column names match `page_views` schema (`created_at`, not `viewed_at`).

**What this does NOT do (intentional scope limit):**
- Does not update the insights system prompt to explain the `registered_mau` distinction — Claude will see both `mau` and `registered_mau` in the snapshot JSON and can interpret them correctly.
- Does not backfill historical `registered_mau` values — only future aggregate runs populate the column.
- Does not fix the `recentSaves` query which also lacks admin exclusion — minor issue deferred.
