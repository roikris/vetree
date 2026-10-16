# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-10-16 — Session 20261016-1053-claude-c3de (sec-001 merged; perf-001 CPU monitoring still open)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `819cd4e` (#138 scan advisories cleared — source-map-js 1.2.2, braces acknowledged — and the scan reads its
  history again, sec-001, 2026-10-16; #137 homepage "Articles saved this week" — every reader's saves, migration 083, anon SELECT on
  saved_articles revoked, feed-002, 2026-10-16; #136 proxy runs only with the Supabase session cookie, perf-001, 2026-10-14; #135 admin Pipeline rebuilt as the Slack messages expanded, Article Health removed, 2026-10-14; #134 daily reminder counts run 2 + excludes the test account, weekly AI report hidden, Overview removed, 2026-10-14; #133 Growth OS daily posts panel, one article → every platform, 2026-10-13; #132 unit tests in init.sh check + PR smoke, 2026-10-13; #131 Facebook IL closing lines: typeable address + WhatsApp Community, 2026-10-13; #129 + #130 Facebook IL link-free posts, vetree.app/il, "save it" hint, 2026-10-13; #127 schema audit + #128 replay safety, migrations 080–082 + 000 recorded, 2026-10-12; #126 unlock log guard, 2026-10-12; PRs #120–#125 least privilege + policy audit, migrations 075–079 applied, 2026-10-11; #119 lint cleanup, 2026-10-10; #118 build warnings / middleware → proxy, 2026-10-10; #117 init.sh lock / unlock, 2026-10-10; #116 "new this week" count, 2026-10-10; #115 shorter digest footer, 2026-10-09; #114 Search Console fixes, 2026-10-07; before it #113 access-control audit,
  migration 074 applied) — last verified: production /api/version = 819cd4e, home 200; manual security scan clean (0 findings, 1 acknowledged); PR #138 smoke + replay new / old PASS
- **Standard startup:** `docs/harness/init.sh` (state, then check) — see README for exit codes. Take / release
  the lock only with `init.sh lock <item> --agent …` / `init.sh unlock "<message>"` (D12), never by hand
- **Standard verification:** `docs/harness/init.sh check [--item <id>]` (now incl. `npm run test:unit`, hard RED); build
  reads production Supabase (read-only); never Playwright as a baseline
- **Vercel CPU (perf-001, 2026-10-14):** Hobby Fluid Active CPU was 4h 50m / 4h (30 days). #136: the proxy runs only
  with `sb-<ref>-auth-token` or its `.0` chunk. Watch the usage chart 2026-10-15..17 (proxy row down, < ~8 min/day);
  if not enough → option B (article ISR). PR rule: drafts until done, ready once, never re-run a passing suite.
  Functions Storage was 8.93 / 10 GB → Roi set deployment retention: pre-production 1 week, production / canceled /
  errored 30 days (2026-10-15); re-read it with the CPU chart.
- **Highest-priority unfinished item:** perf-001 monitoring (read the usage chart 2026-10-16..17); otherwise none ready — scripts-001 needs Roi's decision; ai-001 parked
  (~2026-11-01); making the weekly AI report usable is a later item. Ask Roi.
- **Admin panel (admin-002, Roi 2026-10-14):** /admin lands on Analytics; the weekly AI report is hidden (its Friday job
  still runs); /admin/pipeline = the Slack messages expanded (GET /api/admin/pipeline/status) — no Article Health, no
  job-health verdicts (run totals aren't stored). The experiment day comes from `lib/synthesis/experiment.ts` (run 2:
  2026-09-29 → 12-27); growth-daily-reminder.js copies its constants (tests/unit/experiment.test.ts keeps them equal).
- **The daily posting flow (Roi, 2026-10-13):** every day ONE article is posted to EVERY platform from Growth OS → Daily
  Posts (CLAUDE.md "Growth OS daily posts"). Each tab's Copy & mark posted records its real platform; one approved row per
  article + platform + Israel day. Rows before 2026-10-13 carry the deprecated rotation's platform label.
- **Current blocker:** none
- **Homepage "Articles saved this week" (feed-002, 2026-10-16):** `lib/queries/savedThisWeek.ts` counts every reader's
  saves of the 7 days before the UTC hour via `public.saved_this_week()` (083, service role only, article ids + counts
  only), admin + test account excluded, cached per hour; hidden below 3 articles. anon has no SELECT on saved_articles.
- **Open PRs awaiting Roi:** none · Roi: the 2026-10-15 Slack reminder should read Day 16/90 with no "not excluded"
  note · first daily posting with the new panel, then (his
  yes) a read-only check of today's approved rows + vetree.app/il · Thursday's scan (2026-10-15, first after 079 + 083): only the 2 dependency advisories, fixed in sec-001; manual re-run clean · the 4 dropped indexes stay dropped (Roi
  2026-10-13)

## 2. Open Issues & Known Risks
- **Lint is red on main:** 117 errors (103 no-explicit-any, 13 set-state-in-effect, 1 immutability) / 68 warnings,
  never run in CI. Handled by the lint ratchet (`docs/harness/lint-baseline.json`, per file + rule); only new errors
  fail. Scope narrowed in lint-001 (design prototype ignored; require() allowed in CommonJS scripts).
- **Security scan (sec-001, 2026-10-16):** security_reports' timestamp is `generated_at` (no created_at). Until #138 the
  scan's history read failed silently — every finding "(new)", nothing "resolved"; the next scheduled run (Thu
  2026-10-22) is the first with real history. braces GHSA-vfj7-8cjw-p6xm is parked at high until a patched release.
- **Build warnings:** none since build-001 (2026-10-10). The security scan reads source files at runtime: a new
  check that reads another file must be added to `outputFileTracingIncludes` in next.config.ts (else it passes
  silently on Vercel). Its npm audit step may get no result on Vercel (unproven; acknowledged_count 0 in prod).
- **npm install scripts not approved** on Roi's machine (npm 11.19: esbuild, @sentry/cli,
  unrs-resolver, protobufjs, fsevents, @google/genai) — no effect on tsc / lint / build today;
  approving any is Roi's call.
- **Access-control audit (2026-10-07):** `init.sh check`, every PR and daily compare production's actual
  privileges with `supabase/access.json`. A new table / view / sequence needs explicit grants (REVOKE ALL from all
  four first) AND an `access.json` entry — supabase/CLAUDE.md "Required Grants". Supabase's 2026-10-30 change only
  affects NEW objects. GitHub's merge API returned 500 on #113 (Roi merged via the web UI).
- **Least privilege + policy audit (2026-10-11, infra-002):** anon / authenticated hold only what their policies allow
  (079); every analytics / tracking write uses the service role; `rls-audit` compares production's RLS with
  `supabase/rls.json` exactly (init.sh check, PR smoke, daily). A migration touching a policy, RLS or a table updates
  `rls.json` (and grants `access.json`) in the same PR — and a new policy needs its grant, a new grant its policy.
- **Replay safety (2026-10-12, infra-003):** every PR's `replay` job rebuilds the database from `supabase/migrations/`
  on the pinned Supabase image (new + old default privileges) and must match access.json, rls.json and schema.json — the
  required `smoke` check fails otherwise; also daily (Slack). A migration must apply on an EMPTY database in order;
  never edit 000; a dashboard change fails the daily schema audit until a guarded forward migration records it.
  Gaps: storage, auth's shape. Codex runs on Roi's ChatGPT plan and can hit its usage limit — wait for the reset.
- **Claude refusals → Codex fallback (2026-10-07):** refused articles are hidden as `ai_refused`; the Slack
  enrichment report shows "waiting for the Codex fallback: N" → Roi runs `npm run enrich:refused` on his Mac.
- **AI model revisit ~2026-11-01:** Sonnet 4.6 for every call; Sonnet 5.5 was reverted (~1.46x
  tokens). One line in `lib/ai/model.ts` + the three scripts.

### Backlog candidates from Session 001 — now items (2026-10-06): B→infra-001, A→feed-001,
E→build-001, D+C→lint-001, G→ai-001 (parked), F done in #111
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

### Session 20261016-1053-claude-c3de · 2026-10-16 · Claude Code · sec-001 (closed)
- Goal / Completed: Roi: "the security scan ran and found issues". Run 38812980120 (2026-10-15 21:51 UTC): high, 1
  finding — Roi pasted the Slack text: 2 unacknowledged dependency advisories, braces GHSA-vfj7-8cjw-p6xm (no patched
  version; via Sentry's webpack plugin → chokidar and eslint-config-next → fast-glob) and source-map-js GHSA-68fv-2mgg-jv7q
  (patched 1.2.2; postcss / tailwind) — both build / lint tooling. No database check fired (first scan after 079 + 083).
  My one-row read of security_reports (Roi's yes) failed: no created_at column — which showed the scan's own
  previous-runs query had failed silently on every run. Roi's yes to 1–3 → #138: targeted `npm update source-map-js`
  (lockfile, one package; `npm audit fix` would have bumped eslint-config-next, zod, react-hooks), braces acknowledged at
  high (rule 16, his sign-off), previous runs ordered by generated_at with a failed read stated in summary + Slack, Slack
  labels "also in N of the last N runs" / "Resolved or acknowledged" (ACKNOWLEDGED ids kept out).
- Start state: main 0d3d6ed, clean; lock taken as backlog, sec-001 added and claimed.
- Verification: local replay of CHECK 14's grouping vs `npm audit --json`: before 2 new, after 0 new + 1 acknowledged;
  init.sh check GREEN on both heads; PR suite once after ready (smoke, replay new / old, scope, Vercel pass);
  squash-merged at b8109e4 as 819cd4e; production /api/version = 819cd4e, home 200; manual scan (Roi's yes, run
  38899535854): clean, 0 findings, acknowledged 1. Not checked by me: the Slack text of that run.
- Review: Codex · tier 2 (security) · code 1 round 34.0k · BLOCKING: none (NB applied in b8109e4, not re-reviewed:
  "Resolved" would list an acknowledged finding; recurrence counted runs, labelled weeks).
- Commits / PR: 673008a, b8109e4 → #138 merged 819cd4e on Roi's word ("mergeand yes").
- Pending Roi approvals: none. Roi: glance at the manual scan's Slack message (expect "Resolved or acknowledged:
  dependency_vulnerabilities"); Vercel usage chart (CPU + Functions Storage) 2026-10-16..17; daily posting.
- Known risks / unresolved: auto mode blocked a grep of supabase/schema.json as a "production read" — I stopped and
  asked Roi (he pasted the Slack text); a manual scan is a paid Claude call per finding; the scan's history read and
  Slack wording are unverified until the next run with findings.
- Lesson: a query that ignores its error turns a typo'd column into "no history" for months — every `{ data }` read
  needs its `error`. Prefer a targeted package update to `npm audit fix`, which drags in unrelated bumps.
- Next best step: perf-001 — read the usage chart 2026-10-16..17; if still over, option B. scripts-001 needs Roi;
  ai-001 ~2026-11-01.

### Session 20261015-0745-claude-f044 · 2026-10-15 → 2026-10-16 · Claude Code · feed-002 (closed)
- Goal / Completed: the homepage "Trending This Week 🔥" read saved_articles with the visitor's own client, so RLS gave
  guests nothing and signed-in readers only their own saves. Roi chose 1A + renamed it "Articles saved this week"
  (every reader's saves, the same list for everyone) and 2 yes (admin + test account excluded). #137: migration 083
  `public.saved_this_week(since, until, excluded, limit)` — SQL counting in one snapshot, ties broken before the LIMIT
  (count, newer created_at, id), public-article filter, limit clamped 1–50, EXECUTE for service_role only; and REVOKE
  SELECT on saved_articles FROM anon (079 kept it only for Trending). `lib/queries/savedThisWeek(Core).ts`: plain server
  module (not 'use server' — an action would be browser-callable with the service role), 20 candidates → large-animal-
  only dropped → 5 shown, hidden below 3, unstable_cache keyed by the UTC hour, a failed fill throws (nothing cached),
  3 s deadline. SavedThisWeek.tsx ("N saves"); app/actions/trending.ts and the unused getArticleSaveCount removed;
  access.json / schema.json (9 keys from the replay report, the anon ACL key gone) / supabase/CLAUDE.md updated.
  Also (perf-001): Roi set Vercel deployment retention (pre-production 1 week) after Functions Storage hit 8.93 / 10 GB.
- Start state: main 181c207, clean; lock taken for feed-002.
- Verification: unit 80/80 (8 new, fake clients); replay fixture docs/harness/test/replay/saved-this-week.sql (exclusions,
  NULL user kept, window edges, ties, NULL / 0 / -5 / 999 limits, privileges) + anon / authenticated calls refused —
  replay new + old PASS; init.sh check GREEN on fda5366 after the push (acl 33, rls 32 / 40, schema 4,301 facts — no
  snapshot change needed); 083 dry run listed only 083, pushed on Roi's yes; PR suite once after ready (smoke, replay,
  scope, Vercel pass); squash-merged at fda5366 as 0d3d6ed; production /api/version = 0d3d6ed, home 200 shows the
  section signed out (4 articles, 1 save each). Not checked by me: the signed-in view on production.
- Review: Codex · tier 2 (Supabase migration + service role) · plan 3 rounds 66.3k / 41.4k / 32.6k · code 1 round 54.7k
  ≈ 195k · BLOCKING: none (fixed in the plan: offset paging inconsistent across reads, tie-break after the cut,
  TEST_USER_ID throwing at module load → SQL function; replay compares schema.json exactly → keys from the replay report
  before the push; NB applied in fda5366, not re-reviewed). One Codex run lost to the ChatGPT usage limit, then
  "workspace routing discovery failed"; re-run on Roi's "try now".
- Commits / PR: 853cec3, 3365c99, fda5366 → #137 merged 0d3d6ed on Roi's word ("merge"). Migration 083 pushed.
- Pending Roi approvals: none. Roi: Vercel usage chart (CPU + Functions Storage) 2026-10-16..17; daily posting;
  Thursday's security scan (first after 079 + 083).
- Known risks / unresolved: the section reads the service role from a server module — anything importing
  savedThisWeek.ts must stay server-only (next/headers import breaks a client build); counts are low today (1 save each),
  so the list can be hidden on a quiet week; `supabase migration list --linked` hung once (use `< /dev/null`, background).
- Lesson: a 'use server' file's every export is a public endpoint — service-role reads belong in a plain server module.
  An exact schema snapshot means a migration's expected keys come from a rebuild, before production has them.
- Next best step: perf-001 — read the usage chart 2026-10-16..17 (proxy row down, < ~8 min/day; Functions Storage after
  the retention change); if still over, option B. scripts-001 needs Roi; ai-001 ~2026-11-01.

### Session 20261014-1443-claude-dbb9 · 2026-10-14 · Claude Code · perf-001 (merged; monitoring open)
- Goal / Completed: Roi saw Vercel meters trending up. Read-only usage scan (his browser): Fluid Active CPU 4h 50m / 4h
  (Hobby, 30 days) — proxy ("middleware") 2h 6m (43.6%), functions 2h 43m; daily ~5 → 9–13 min. Causes: the proxy ran
  on every page request (a billed Node invocation even with no session cookie); /article/[id] and / are 0% cached
  (cookies() / force-dynamic); preview smoke traffic ~2x production's. Roi chose C now (memory rule: PRs stay drafts
  until done, ready once, no repeat suites) and A next: #136 — proxy matcher runs only with the Supabase session cookie
  `sb-<ref>-auth-token` or its `.0` chunk (Next matches cookie keys literally, static config); tests/unit/proxy.test.ts;
  CLAUDE.md Auth & Roles note. Also: merged #135 (admin-002 handoff in the previous entry); Roi ran
  `npm run enrich:refused` himself (from ~/dev/vetree; "saved 3").
- Start state: main edf2009, clean; lock taken for perf-001 (init.sh generated the session id dbb9).
- Verification: built functions-config-manifest carries both `has` entries; proxy tests 4/4, failing on the old matcher
  and with `.0` removed; init.sh check GREEN on faf0a9b and a749e08; PR smoke (signed-in tests incl.) + replay new / old
  + Vercel pass on a749e08 (one suite run after ready); squash-merged at a749e08 as 181c207; production /api/version =
  181c207, home 200, /login 200. Not verified yet: the CPU drop (Vercel usage chart, 2026-10-15..17).
- Review: Codex · tier 2 (auth path) · plan 1 round 72.9k · code 1 round 59.5k ≈ 132k · BLOCKING: none (folded into the
  plan: match the chunked cookie, an early return saves nothing, ISR needs a failure + invalidation policy; NB applied:
  tests build their cookie keys independently of the config).
- Commits / PR: faf0a9b, a749e08 → #136 merged 181c207 on Roi's word ("merge").
- Pending Roi approvals: none. Roi: check the Vercel usage chart (or ask me) 2026-10-15..17 — proxy row down, daily
  < ~8 min; tomorrow's Slack reminder (Day 16/90, no "not excluded" note); daily posting; Thursday's security scan; 37
  unseen Vercel notifications (look for a usage notice).
- Known risks / unresolved: the project ref is hard-coded in proxy.ts (the unit test guards it); a cookie name change in
  @supabase/ssr would silently skip the proxy (signed-in smoke would catch session loss); Hobby observability keeps only
  12 h, so per-route monthly totals aren't available.
- Lesson: an early return inside middleware is not free — the invocation is the cost; filter in the matcher. Separate
  preview from production traffic before blaming a route.
- Next best step: read the usage chart 2026-10-15..17; if still over, option B (article ISR with an anonymous loader,
  client-side guest wall, throw on transient errors, revalidate on delete), then OG image cost; home page last.

### Session 20261014-0538-claude-a04e · 2026-10-14 · Claude Code · admin-002 (closed; admin-001 closed as removed)
- Goal / Completed: Roi asked to rethink the admin panel ("article health is part of an older version … reconsider if
  it's even needed"). A read-only usage pass (Roi's yes) showed 21,056 articles, 3 hidden (all ai_refused), and the
  Article Health "never attempted" 4,579 / "partial" 16,131 almost all published — re-queueing them would re-enrich
  ~20.7k live articles. Roi's decisions: /admin lands on Analytics (Overview removed); all Analytics numbers kept, the
  weekly AI report hidden (the Friday job still runs); Reports, Users, Security, Growth OS, Campaign unchanged; Pipeline
  = "an extension of the slack messages"; option A (no new table). PR 1 (#134): the daily Slack reminder's "Day 117/90"
  came from run-1 dates hard-coded in growth-daily-reminder.js — it now uses run 2 (2026-09-29 → 12-27, baseline
  05-21..06-19) via shared helpers in lib/synthesis/experiment.ts and excludes the test account (found from
  TEST_USER_EMAIL, since Vercel won't reveal TEST_USER_ID — Roi chose B); the weekly report's campaign line uses the same
  helpers, no rotation line; Overview, FeatureFlags and getAdminStats removed. PR 2 (#135): /admin/pipeline rebuilt —
  GET /api/admin/pipeline/status (admin only, any failed query → 500) + PipelineStatus.tsx in the Almanac tokens: Needs
  you (waiting for Codex, failed + Retry failed, no abstract + Delete & block, queue + Run enrichment, Show more paging),
  Today's sync, Visibility check (total / public / queued / hidden by reason / unexplained), Scheduled jobs (latest
  activity + GitHub links, no health verdicts — run totals aren't stored). Removed (Roi: "removals approved"): Article
  Health, Incomplete Enrichment, diagnostics, stats, label editing, send-digest-now, the CSV download, three admin
  routes and nine server actions.
- Start state: main a2cd626, clean; lock taken as backlog, admin-002 added and claimed.
- Verification: init.sh check GREEN on every head; unit 62 → 68 (experiment + pipeline tests, offline); 7 mocked-network
  Playwright scenarios on a temporary local page (not committed), each fix's test failing before it; screenshots shown
  to Roi (made-up data); PR smoke + replay new / old pass on both heads; Roi checked the preview with real data himself
  ("looks good"). Production 86fdcd6 then edf2009 (/api/version), home 200, status route anonymous 401. Not verified
  live: the first reminder under the new count (2026-10-15 03:00 UTC, should read Day 16/90).
- Review: Codex · tier 2 · plan 2 rounds 102.9k / 30.6k · PR 1 3 rounds 50.3k / 21.9k / 24.5k · PR 2 3 rounds 76.1k /
  29.7k / 17.1k ≈ 353k · BLOCKING: none (fixed on the way: activity is not job health; run totals not recoverable;
  run-2 engaged as a total, not /day; the retry list = FAILED_UNPUBLISHED_OR; test account not excluded; NULL
  needs_enrichment uncounted; lists capped at 50; a stale refresh overwriting newer state; a silent delete failure;
  Show-more during a refresh / two Show-mores at once).
- Commits / PR: b73a9d2, 0ba3e00, ddaa87f → #134 merged 86fdcd6; 660cf1c, fab966d, a6f207a → #135 merged edf2009 —
  each on Roi's word.
- Pending Roi approvals: none. Roi: tomorrow's Slack reminder (Day 16/90, no "not excluded" note); publish the 3
  ai_refused articles with `npm run enrich:refused` (dry run first); the first daily posting with the Daily Posts panel,
  then (his yes) a read-only check; Thursday's security scan; Vercel usage ~2026-10-14.
- Known risks / unresolved: no signed-in non-admin e2e for the status route (no such smoke account); unpinned
  supabase-js in the reminder workflow; an SDK exception in the test-account lookup would skip that morning's message;
  CLAUDE.md "Key Features Built" still lists an admin "overview"; making the weekly AI report usable is a later item.
- Lesson: a number on a screen can come from somewhere other than the page that shows it — "Day 117/90" was the daily
  reminder script, not the weekly report I first named; find the writer before fixing the reader. Before keeping a
  repair tool, count what it would touch: Article Health's buttons would have re-enriched ~20.7k live articles.
- Next best step: feed-002 / scripts-001 need Roi's decisions; ai-001 ~2026-11-01; the weekly AI report later.

### Session 20261013-1029-claude-35c5 · 2026-10-13 · Claude Code · growth-002 (closed)
- Goal / Completed: Growth OS rebuilt for the real daily flow — one article to every platform each day. PR 1 (#132):
  the test net Codex asked for — 38 unit tests (linkFree, /il target selection + failures, generate-post
  post-processing) run by `npm run test:unit` in init.sh check (hard RED) and PR smoke; a SaveHint browser test on the
  preview. PR 2 (#133): `app/admin/growth/DailyPosts.tsx` replaces CampaignCalendar.tsx — Generate All (server pick,
  every other platform forced + echo-checked, batches of 3, Retry Failed), one tab per platform (Facebook IL, WhatsApp,
  Telegram = WhatsApp with its UTM, LinkedIn, Facebook Intl, X), Copy & mark posted with the card's own platform +
  language, LinkedIn URL by row id, AI Photos kept (Roi uses it), recommendations / dismissals / search kept. The
  feedback route keeps one approved row per article + platform + Israel day and returns its id; GET
  /api/admin/growth/today gives today's rows, the day's article and the streak. Removed: the 90-day rotation, the Content
  Agent tab, the single-post flow, the growth_tasks server actions (table stays), six unused components.
- Start state: main cba7324, clean; baseline init.sh check GREEN.
- Verification: 53 unit tests; init.sh check GREEN on every head; 15 mocked-network Playwright scenarios on a
  temporary local page (nothing left localhost; not committed), each fix's test failing on the code before it; PR
  smoke + replay new / old pass on both PRs; production a2cd626, home 200. Not verified live: Roi's first daily posting
  with the panel (no production rows read by me).
- Review: Codex · tier 2 · plan 2 rounds 68.4k / 27.3k · PR 1 2 rounds 64.9k / 27.7k · PR 2 4 rounds 80.8k / 43.6k /
  34.3k / 26.5k (round 4 beyond the cap on Roi's word; one attempt lost to the ChatGPT usage limit, re-run at the
  reset) ≈ 374k · BLOCKING: none (fixed on the way: marking before today's state loaded, generation and marking
  overlapping — twice, the clipboard wait, midnight in an open tab, failed platforms lost on reload — twice, a failed
  copy recorded as posted, a replaced panel still generating, then overwriting a newer panel's drafts — my own
  round-2 fix).
- Commits / PR: #132 → 62b242f, #133 → a2cd626, each merged on Roi's word. #133's merge was first refused: the
  cancelled duplicate smoke run counted as a failed required check; re-ran it on the same head.
- Pending Roi approvals: none. Roi: today's posts through the new panel (Copy & mark posted on each tab); then, with his
  yes, a read-only check of today's approved rows and vetree.app/il. Thursday's security scan; Vercel usage ~2026-10-14.
- Known risks / unresolved: approved rows before 2026-10-13 carry the rotation's platform label; Telegram has no Skip;
  the generate-post threads hook read stays (rule 14: that route changed 3× in 7 days); drafts made before Israel
  midnight don't show after the panel starts the new day; the lint baseline still lists deleted files (harmless).
- Lesson: a fix for a race can open a new one one level up — the round-2 "stop and save what you made" overwrote a
  newer panel's drafts; when an instance is replaced, the old one should stop and write nothing. Count mocked calls on
  arrival, not after their delay, or a timing test proves nothing. Dev StrictMode doubles every load effect — never
  assert request counts with ==.
- Next best step: Roi's daily posting (first live run); feed-002 / admin-001 / scripts-001 need Roi's decisions;
  ai-001 ~2026-11-01.
