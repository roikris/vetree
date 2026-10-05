# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-10-05 — Session 20261005-1625-claude-ea54 (backlog session 001 paused by Roi)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `5ae7d29` (PR #110 harness rules, merged by Roi 2026-10-05) — last verified: `init.sh check`
  GREEN on the PR head b899862 (identical tree)
- **Standard startup:** `docs/harness/init.sh` (state, then check) — see README for exit codes
- **Standard verification:** `docs/harness/init.sh check [--item <id>]`; build reads production
  Supabase (read-only); never Playwright as a baseline
- **Highest-priority unfinished item:** none — backlog empty; **Session 001 (backlog with Roi) started, paused by Roi
  before decisions** — resume it: candidates in §2
- **Current blocker:** none — rollout steps 0–9 done; the harness is live on main
- **Open PRs awaiting Roi:** none

## 2. Open Issues & Known Risks
- **Lint is red on main:** 178 errors / 75 warnings, never run in CI. Handled by the lint ratchet
  (`docs/harness/lint-baseline.json`); only new errors fail.
- **Possible real bugs among the lint errors:** `lib/hooks/useFollowedTags.ts:16` (variable used
  before declared), `components/onboarding/Onboarding.tsx:288` (component created during render),
  `app/page.tsx:91` (impure function during render).
- **Lint scope:** it lints `docs/design_handoff_vetree_redesign/**` and
  `.github/workflows/scripts/**`.
- **Build warnings (non-failing):** Sentry wants `onRouterTransitionStart` exported from
  `instrumentation-client.ts`; Next 16 deprecates `middleware` → `proxy`; Turbopack traces the whole
  project for `app/api/admin/security/scan/route.ts:757` (reads source files at runtime).
- **npm install scripts not approved** on Roi's machine (npm 11.19: esbuild, @sentry/cli,
  unrs-resolver, protobufjs, fsevents, @google/genai) — no effect on tsc / lint / build today;
  approving any is Roi's call.
- **AI model revisit ~2026-11-01:** Sonnet 4.6 for every call; Sonnet 5.5 was reverted (~1.46x
  tokens). One line in `lib/ai/model.ts` + the three scripts.

### Backlog candidates for Session 001 (not items yet — Roi decides; presented 2026-10-05, paused)
- **A (fix)** Feed header "new this week" count (`app/page.tsx:91`): no quarantine/summary filter (counts hidden
  articles), no upper bound (future-dated preprints count forever), uses `publication_date` not `created_at`.
- **B (investigation, deadline 2026-10-30)** Supabase explicit-GRANT enforcement (supabase/CLAUDE.md): only 22 of 72
  migrations contain a GRANT — check whether existing tables are affected. Suggested priority 1.
- **C** the three "possible bugs" in lint look benign (hoisting; Onboarding arrow remounts each render;
  `Date.now()` in a server component) → fold into D.
- **D (chore)** lint cleanup: narrow scope, shrink the baseline.
- **E (chore)** build warnings — `middleware` → `proxy` is the one that matters.
- **F (docs)** tick DESIGN.md step 9 in the next rules PR.
- **G** AI model revisit ~2026-11-01 — park with the date.
Suggested order: B, A, E (proxy), D, F; G parked. Roi's own product priorities come first.

## 3. Hard-Won Lessons (only recorded here)
- **Navigation after an unsave must wait for the API response:**
  `Promise.all([page.waitForResponse(...), click()])` (pattern in e2e/smoke.spec.ts:468).
- **Password reset:** `signOut({ scope: 'local' })` before `exchangeCodeForSession` — global scope
  revokes every device (app/reset-password/page.tsx:53).
- **`NEXT_PUBLIC_SITE_URL` is not set in Vercel** (re-checked 2026-10-04) → always
  `|| 'https://vetree.app'` as the fallback (app/actions/profile.ts:19,
  app/api/admin/trigger-digest/route.ts:31).
- **Every GitHub workflow needs `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`** (all 14 have it,
  2026-10-04).
- **Don't resurrect fix-malformed-titles** (retired in PR #18): 0 rows ever matched, 3 runs all
  failed, it never fixed anything.

### Lessons that live in the CLAUDE.md files (pointers — read them there)
Broken-sensor rule and pre-filtered snapshot → CLAUDE.md OPS NOTES · article views unreliable →
app/api/CLAUDE.md:324 · `excludedUsersOrFilter()` → CLAUDE.md rule 10 · save = plain fetch →
rule 12 · auth testing incognito only → OPS NOTES · todaysTask = pure JS → Campaign Calendar ·
large-animal filter JS only → rule 4 · `.neq()` drops NULLs → rule 5 · clients inside handlers →
rule 2 · no `select('*')`, lazy summary → rule 8 · `publication_date`, `saved_at` →
supabase/CLAUDE.md:69, 95 · analysis-agent jobs + schedules → GitHub Actions table · `vercel env
pull` can be stale → OPS NOTES · filter caching 3600 s → Filter Caching · match_method constraint
history → rule 15 · `metrics_updated_at` → supabase/CLAUDE.md · `data_gap` signal →
app/api/CLAUDE.md:325–326.

## 4. Incident notes
- **2026-07-15 — Growth OS memory near-empty.** Three compounding bugs: `hook_line` never saved,
  a premature `clearSavedPost`, and a stale `onPaste` closure. Fixed in PR #19 (with `no_article`,
  migration 043). Lesson: several small capture bugs can zero a dataset without any error.
- **2026-07-17 — wrong article from a manual pick, then an over-correction.** The generate-post
  route silently fell back to a random article when the forced one carried large-animal labels
  (pubmed-42444511, UVC keratitis: Small Animal + Equine + Large Animal). PRs #21–#22 added
  echo-assertions and one locked article for Generate All; PR #23 made a forced large-animal pick
  return 422 instead — which blocked deliberate mixed-species picks; PR #24 settled it: exclusion
  filters apply to **automatic** selection only, an explicit `article_id` is used verbatim (rule in
  app/api/CLAUDE.md:243). Lesson: fixing a silent fallback by refusing can over-correct; ask what
  the explicit choice should mean. (This week paid for CLAUDE.md rule 14.)

## 5. Platform at a Glance
Services, IDs, emails, admin tabs and schedules are in CLAUDE.md (Repo & Services, Stack,
GitHub Actions table) — all six cron schedules re-checked against the workflow files on 2026-10-04.

## 6. History (PRs #7–#109)
One line per PR or tight batch; the number is the key to the detail (`gh pr view <n>`). ✓ = how it
works today was spot-checked in the code on 2026-10-05.

### AI model
- #7 all AI calls → Sonnet 4.6 (Haiku retired).
- #95 → Sonnet 5.5; #96 raised output budgets (syntheses were failing in production);
  #99 back to Sonnet 4.6: 5.5 used ~1.46x tokens for the same work. ✓ `lib/ai/model.ts` =
  `claude-sonnet-4-6`; owner revisits ~2026-11-01.

### Search & discovery
- #16 search logging restored (SearchControls), `data_gap` signal for a dead logger.
- #58 search reaches large-animal research instead of hard-excluding it; #63 species control
  (small animal default, large animal one tap away); #73 searches start across all species.
- #61 fuzzy-search expression indexes; #62 fuzzy search no longer full-scans articles.
- #74 progressive search — Best match (default) | Newest, sprout loader ✓ (`lib/search/progressive.ts`,
  `search_articles_batch`); #76 dropped `search_articles_ranked` + its dead path ✓ (migration 061);
  #78 refined loader animation.
- #75 smoke tests no longer logged as real searches; #77 second search no longer waits 10–15 s
  signed in; #90 zero-result searches no longer wait 3–10 s.
- #65, #72 mobile layout no longer widens the page (search, article app bar); pinch-zoom back.
- #103 landing search box, personalize-later card, no second hero, library without dead tabs.

### Content pipeline (PubMed ingest + enrichment)
- #41 ingest American Journal of Veterinary Research ✓; #42 MedlineDate fallback stops dropping
  insert batches; #44 no raw xml2js objects as titles; #51 daily sync uses entry date (EDAT);
  #68 exact online date instead of Jan-1 placeholders.
- #43 guard missing text block in Claude response; #45 defensive context framing + prompt_version.
- #66 keep the source abstract, never re-summarize an AI summary; #67 discard records without an
  abstract + scheduled purge; #71 purge run recorded (2026-09-26); #69 original abstract on
  article pages; #70 AI Photos prompt uses the abstract.
- #106 a third enrichment failure hides the article; red run when all fail; retry only failed ones.
- #18 retired fix-malformed-titles (0 rows ever matched, 3 runs all failed).

### Growth OS & LinkedIn
- #19 three memory-capture bugs (see Incident notes); "Copy & mark posted"; `no_article` (043).
- #20 LinkedIn metrics table: inline edit, Eng%, 10-column sort, `metrics_updated_at` (044).
- #21–#24 manual article selection chain (see Incident notes): echo-assertions, one locked article
  for Generate All, explicit `article_id` verbatim, filters only for automatic picks.
- #25 clear erroneous post-metric assignments (`cleared`, 045); #31 XLSX upsert no longer nulls
  assignments; #46 colon-delimited LinkedIn activity-ID URLs; #53, #54 posted-URL reminder
  persists, no resurrection, no paste double-write.
- #35 ingestion-clock (`created_at`) ranking for Growth OS pick and For You feed.
- #97 one shared, policy-correct article ranking; #98 Claude relevance scoring (practice / talk /
  WOW) + a wildcard per set; #101 a model switch no longer invalidates scores.
- #50 paid campaign tracking (LinkedIn Insight Tag, Facebook Pixel, utm_id) — made opt-in by #94.

### Weekly digest & email
- #33 rank digest candidates by ingestion time, never re-send; #34, #39 dry-run skip reasons
  (reported, then rendered in admin); #36 grow digest consent in-product only.
- #105 escape every value in the digest email; public stats count real confirmed users.

### Accounts, signup & saving
- #11, #14, #15 password reset: PKCE exchange, redirect fallback, local-scope sign-out first.
- #12 small fixes (useAdmin `.maybeSingle()`, `/auth/signin` → `/login`).
- #13 smoke unsave race (`Promise.all`); #26 every SaveIntentHandler branch observable;
  #80 every guest Save button enters the save / sign-in flow.
- #37 signup wizard layout + funnel instrumentation; #38 post-login redirect race closed;
  #91 one-step signup, consent in the interface language with a Hebrew toggle.

### Privacy & consent (Israeli privacy law review)
- #81 consent only recordable by the verified owner; #92 records which language's wording was seen.
- #93 code gaps from the privacy-law review closed; #94 opt-in consent for ad pixels ✓
  (`components/consent/TrackingConsent.tsx`), new Privacy Policy + Terms (EN/HE), 12-month retention.
- #82 service worker caches only public static files; old private cache purged.
- #104 server Sentry actually on; emails scrubbed from all reports; no emails in logs.

### Security
- #10 scan CHECK 19 fix; xlsx → 0.20.3 (SheetJS CDN tarball).
- #28 Next.js CVEs + conservative audit fixes; #29 scan understands acknowledged advisories;
  #30 postcss + brace-expansion parked (rule 16, Roi's sign-off).
- #57 admin auth on three service-role routes that had none.
- #84 `delete_user_account` locked down (anon could delete any account).
- #100 Next 16.3.8 (critical next/og RCE), high advisories cleared, avatar email check, precise PII scan.

### Analytics & sensors
- #8 service-role analytics reads + MAU sanity guard; #9 analytics hardening (UUID validation,
  2-ID OR semantics, per-query error detection); #27 Analysis Agent standing constraint +
  strict output contract.
- #56 bot/crawler traffic tagged in page_views; #83 synthesis auto-run restored, experiment run 2
  with trustworthy sensors; #85 synthesis events out of page_views (065), only production records.
- #107 guides match the code; activation metrics; retention route fixed.

### Performance, reliability & SEO
- #40 narrower middleware matcher (no auth round-trip for anonymous requests); #47, #48 Supabase
  `getUser()` timeouts fail open (middleware, article page); #49 no prefetch on admin sidebar.
- #52 block CPU-heavy SEO/AI crawlers; #102 block Meta's AI crawler, cut Vercel CPU from test runs.
- #64 sitemap lists all ~25k articles (paginated + sharded) ✓; #108 sitemap build retries longer.
- #79 evidence badges name the real study design; landing page states verified facts.
- #109 Vetree leaf in the browser tab; installed-app icons centred (2026-10-04).

### QA, CI & process
- #7 PR smoke workflow + qa-triage fixes; #32 green-message skip counts by reason.
- #87, #88, #89 smoke: run once where device doesn't matter, post-deploy tests the pushed release,
  essentials daily + full suite weekly; #108 draft gate reads the PR's current state.
- #86 CLAUDE.md: Codex review loop + merge-on-owner's-word rules; branch protection status.
- #17 docs synced to verified state; #59, #60 schema reconciled (RLS eligibility migration, pre-
  migration objects backfilled, stale loose SQL deleted); #55 `.evolver` removed ✓.

## 7. Recent Sessions
(Newest first — only the latest 5 are kept here (D11); every entry, older ones included, is in
`session-log.md`, which is never trimmed.)

### Session 20261005-1625-claude-ea54 · 2026-10-05 · Claude Code · backlog session 001 (paused by Roi)
- Goal / Completed: started the backlog session with Roi (no product code). Baseline `init.sh check --quick`
  GREEN (quick — build not run) on main @ 5ae7d29. No open PRs or issues; nothing to reconcile.
  Presented candidates A–G (see primer §2, "Backlog candidates"); Roi paused before deciding.
- Start state: main @ 5ae7d29, clean; state @ 829f0cf, lock free.
- Verification: n/a (no item) · Review: n/a (state only) · Commits / PR: state only.
- Pending Roi approvals: his own product priorities; which candidates become items + order;
  per item, whether prod DB writes / paid calls are allowed.
- Known risks / unresolved: candidate B has a deadline (Supabase explicit GRANTs, 2026-10-30).
- Next best step: resume backlog session 001 with Roi — ask his priorities first, then candidates
  (suggested order B, A, E-proxy, D, F; G parked).

### Session 20261005-1621-claude-4de2 · 2026-10-05 · Claude Code · rollout step 9 (merge)
- Goal / Completed: Roi approved the merge; #110 marked ready (smoke skipped, docs-only; run
  success on b899862), squash-merged as 5ae7d29. Local checkout on main @ 5ae7d29.
- Note: DESIGN.md's step-9 row still says "Merge: on Roi's word" — tick it in the next rules PR.
- Next best step: Session 001 — build the backlog with Roi (init.sh check --quick; no product code).

### Session 20261005-1545-claude-0ccc · 2026-10-05 · Claude Code · rollout step 9
- Goal / Completed: rules branch pushed; draft PR #110 opened on Roi's OK. Checks: scope pass
  (docs-only), smoke skipped (run success), Vercel preview ready. Codex review of the full rules
  diff: 6 rounds, 6 blocking fixed, BLOCKING: none (DESIGN.md step 9).
- Pending Roi approvals: merge of #110.
- Next best step: after Roi merges #110 — Session 001: build the backlog with Roi.

### Session 20261005-1525-claude-07f1 · 2026-10-05 · Claude Code · harness-dryrun-006
- Goal / Completed: proper re-run of the efd10fe clean-tree test, with a guard that the WIP commit
  exists: (a) clean WIP → exit 10 EXPECTED-WIP, build not run, never GREEN; (b) same WIP + an
  uncommitted edit → exit 2 STOP. Tree verified clean afterwards; branch + item removed.
- Also: corrected the entry of 20261005-1522-claude-bc31, whose test was invalid (see the correction in session-log).
- Next best step: short Codex look at efd10fe, then Roi's OK for push + draft PR.

### Session 20261005-1522-claude-bc31 · 2026-10-05 · Claude Code · harness-dryrun-006 — INVALID TEST (corrected)
- CORRECTION (by 20261005-1525-claude-07f1): this session's test never ran in WIP mode. The edit went to a file that
  does not exist (lib/utils.ts was created untracked), so no WIP commit was made, wip_sha stayed
  empty, and both runs were ordinary checks (exit 0 GREEN). The results first written here
  ("10" and "2") were false. The stray file was removed; the test was re-run properly by 20261005-1525-claude-07f1.
