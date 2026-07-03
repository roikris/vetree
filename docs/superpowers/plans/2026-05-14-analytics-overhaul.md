# Analytics Section Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four concrete problems in the analytics admin section: wrong page order, no direct entry from admin dashboard, worthless content-roadmap synthesis (random articles), and over-generic AI insights.

**Architecture:** Four independent edits to existing files — no new files, no new routes, no new DB tables. Each task is a targeted change that can be committed and verified on its own.

**Tech Stack:** Next.js App Router (RSC + client components), Supabase, Anthropic Claude (insights route), Recharts.

---

## Problem summary (for context)

| Problem | Root cause | Fix |
|---|---|---|
| Analytics data buried below AI panel | `AnalysisAgent` renders before charts in `page.tsx` | Swap order |
| `/admin` lands on generic overview | `app/admin/page.tsx` is static overview, no redirect | Redirect to `/admin/analytics` |
| Content Roadmap creates bad syntheses | Button passes `synthesize=true` → picks 15 random articles → empty output | Change button to search-only |
| Insights too generic | Prompt forces non-empty `content_roadmap`; no penalty for vague recommendations | Remove forced non-empty rule; tighten filter |

---

## File Map

| File | Change |
|---|---|
| `app/admin/analytics/page.tsx` | Move `AnalysisAgent` to bottom of page, below `UserRetention` |
| `app/admin/page.tsx` | Replace page body with server-side `redirect('/admin/analytics')` |
| `app/admin/analytics/AnalysisAgent.tsx` | Change Content Roadmap button: `synthesize=true` → search only, label "Search topic →" |
| `app/api/admin/analytics/insights/route.ts` | Fix `content_roadmap` prompt: remove "never return empty" pressure; require actual signal evidence |

---

## Task 1: Analytics data first — move AnalysisAgent below the fold

**Files:**
- Modify: `app/admin/analytics/page.tsx`

**Current order:**
1. Header
2. `<AnalysisAgent />` ← blocks data
3. `<AnalyticsClient ... />` ← actual metrics
4. `<UserRetention />`

**Target order:**
1. Header
2. `<AnalyticsClient ... />` ← metrics immediately visible
3. `<UserRetention />`
4. `<AnalysisAgent />` ← AI insights at bottom

- [ ] **Step 1: Edit `app/admin/analytics/page.tsx`**

Replace the `return (...)` block with the reordered version:

```tsx
return (
  <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
    {/* Header */}
    <div className="mb-8">
      <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
        Analytics
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Track user engagement and content performance
      </p>
    </div>

    {/* Main Content — metrics first */}
    <AnalyticsClient
      initialOverview={overview.data}
      initialTopPages={topPages.data || []}
      initialVisitorsOverTime={visitorsOverTime.data || []}
      initialTopArticles={topArticles.data || []}
      initialSessionDuration={sessionDuration.data}
      initialRecentSearches={recentSearches.data || []}
      initialDeviceBreakdown={deviceBreakdown.data}
      initialTopCountries={topCountries.data || []}
      initialSavedArticlesStats={savedArticlesStats.data}
      initialTrafficSources={trafficSources.data || []}
      initialSynthesisStats={synthesisStats.data || null}
    />

    {/* User Retention */}
    <div className="mt-8">
      <UserRetention />
    </div>

    {/* Analysis Agent — AI insights at bottom */}
    <div className="mt-8">
      <AnalysisAgent />
    </div>
  </div>
)
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/analytics/page.tsx
git commit -m "Move AnalysisAgent below metrics on analytics page"
```

---

## Task 2: Admin dashboard redirects to analytics

**Files:**
- Modify: `app/admin/page.tsx`

The entire overview page is replaced with a server-side redirect. The sidebar "Overview" link (`/admin`) will follow to `/admin/analytics` automatically. The sidebar nav still works — all other items are unaffected.

- [ ] **Step 1: Replace `app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function AdminOverviewPage() {
  redirect('/admin/analytics')
}
```

That's the entire file. The existing stats/reports/pipeline content is removed — it duplicated what's already visible in the individual sections.

- [ ] **Step 2: Build and verify**

```bash
npm run build
```
Expected: clean build. `/admin` now 307s to `/admin/analytics` at runtime.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "Redirect /admin to /admin/analytics as default entry point"
```

---

## Task 3: Fix Content Roadmap — search instead of synthesize

**Files:**
- Modify: `app/admin/analytics/AnalysisAgent.tsx`

**Root cause of the bug:** The button calls:
```tsx
router.push(`/?search=${encodeURIComponent(getSynthesisQuery(topic))}&synthesize=true`)
```
The `synthesize=true` flag triggers automatic synthesis on page load. The synthesis route fetches whatever articles exist for that query — often 15 unrelated articles — then produces an empty "no relevant data" synthesis. This wastes tokens and is misleading.

**Fix:** Remove `&synthesize=true`. The button becomes a search shortcut. The admin can review search results and manually trigger synthesis if there are enough relevant articles.

- [ ] **Step 1: Edit the button in `app/admin/analytics/AnalysisAgent.tsx`**

Find this block (around line 453–465):

```tsx
{latestAnalysis.content_roadmap.map((topic, index) => (
  <div key={index} className="flex items-center justify-between">
    <p className="text-sm text-zinc-700 dark:text-zinc-300">
      {topic}
    </p>
    <button
      onClick={() => router.push(`/?search=${encodeURIComponent(getSynthesisQuery(topic))}&synthesize=true`)}
      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
    >
      Create Synthesis →
    </button>
  </div>
))}
```

Replace with:

```tsx
{latestAnalysis.content_roadmap.map((topic, index) => (
  <div key={index} className="flex items-center justify-between">
    <p className="text-sm text-zinc-700 dark:text-zinc-300">
      {topic}
    </p>
    <button
      onClick={() => router.push(`/?search=${encodeURIComponent(getSynthesisQuery(topic))}`)}
      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
    >
      Search topic →
    </button>
  </div>
))}
```

Only change: remove `&synthesize=true` from the URL and rename the button label.

- [ ] **Step 2: Build and verify**

```bash
npm run build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add app/admin/analytics/AnalysisAgent.tsx
git commit -m "Fix content roadmap: search instead of auto-synthesize to avoid empty syntheses"
```

---

## Task 4: Tighten the insights prompt — content_roadmap must have evidence

**Files:**
- Modify: `app/api/admin/analytics/insights/route.ts`

**Root cause:** The `userPrompt` contains this instruction (line ~197):
```
CONTENT ROADMAP RULE: Always populate content_roadmap with 3-5 specific veterinary topics.
Source priority: (1) signals with type=content_opportunity and results=0 ...
Never return an empty content_roadmap array.
```

The "Never return an empty content_roadmap array" line forces Claude to invent topics when there are no real signals. This is what causes fabricated roadmap entries.

Additionally, the `systemPrompt` guard list (`Bad: "Create a landing page"`) is good but doesn't specifically call out the pattern that keeps appearing: vague, platform-agnostic recommendations that don't reference a specific file, feature, or user segment with a number.

**Two changes:**

**Change A** — Remove "Never return an empty content_roadmap array" and replace the content_roadmap instruction with a stricter evidence requirement.

**Change B** — Add one more "Bad" example to the system prompt that explicitly blocks the "fluid therapy protocols" pattern (where Claude fabricates a synthesis topic without evidence it exists in the DB).

- [ ] **Step 1: Edit `userPrompt` in `app/api/admin/analytics/insights/route.ts`**

Find (around line 196–198):

```
CONTENT ROADMAP RULE: Always populate content_roadmap with 3-5 specific veterinary topics.
Source priority: (1) signals with type=content_opportunity and results=0 (zero-result queries), (2) signals with type=content_opportunity and results=low (<10) — thin content areas, (3) if no content_opportunity signals exist, derive topics from top_searches in the snapshot that likely have sparse coverage. Never return an empty content_roadmap array.
```

Replace with:

```
CONTENT ROADMAP RULE: Populate content_roadmap ONLY from signals with type=content_opportunity (zero-result or thin-result searches). These are topics users actually searched for and found nothing. Do NOT invent topics. If no content_opportunity signals exist, return an empty array []. An empty content_roadmap is correct when there is no evidence of unmet demand.
```

- [ ] **Step 2: Edit `systemPrompt` in the same file — add Bad example**

Find the Bad examples section (around line 146–150):

```
Bad: "Add related content" (already have related articles)
Bad: "Improve mobile experience" (already mobile-optimized)
```

Add one more line after them:

```
Bad: Suggesting a content_roadmap topic not found in the signals data — fabricating topics wastes synthesis tokens and produces empty output.
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/analytics/insights/route.ts
git commit -m "Fix insights prompt: content_roadmap requires actual search signals, not invented topics"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Analytics data first on the page | Task 1 ✓ |
| Admin dashboard directs to analytics first | Task 2 ✓ |
| Insights too general / not aligned with what's built | Task 4 ✓ (tightened prompt) |
| Content roadmap synthesis picks random articles → worthless | Task 3 ✓ (remove auto-synthesize) + Task 4 ✓ (remove forced non-empty) |

**Placeholder scan:** No TBDs, no "implement later". All code shown in full.

**Type consistency:** No new types introduced. All existing types preserved.

**What this does NOT do (intentional scope limit):**
- Does not restructure or deprecate the Analysis Agent UI — the core insight cards, TODO list, and Full Metrics Report are kept as-is. They work correctly.
- Does not change how synthesis article selection works at the route level — that's a separate, larger problem. The fix here is to not auto-trigger synthesis from an unvalidated topic.
- Does not add A/B testing or new analytics signals.
