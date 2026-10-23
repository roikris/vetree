# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-10-23 — Session 20261023-1625-claude-3452 (perf-001: #154 Meta link-preview fetchers get a prerendered home — ~310 home renders/day removed)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `a82f724` (#154 facebookexternalhit on / → static /link-preview (next.config.ts beforeFiles rewrite, lib/metaPreview.ts), perf-001, 2026-10-23; #153 useAuth refreshes once per real sign-in (lib/auth/signInRefresh.ts) — was ~46 server renders per signed-in home load, analytics-001, 2026-10-22; #152 no prefetch on links to /privacy /terms /library /profile /admin/reports, analytics-001, 2026-10-22; #151 "touched today" on the Israel day + ranking tests, growth-003, 2026-10-22; #150 passed-over recommendations rest 14 days (lib/growth/passedOver.ts), panel reachable after the day's article is set, growth-003, 2026-10-21; #149 no prefetch on repeated article links — stream, saved-this-week, ArticleCard, Grove, analytics-001, 2026-10-21; Vercel missed the push → production deployed via the API on Roi's go-ahead; #148 component tests for the consent prompts — happy-dom dev dependency, analytics-001, 2026-10-20; #147 unused FollowTagButton / useFollowedTags removed, 2026-10-20; #146 consent prompts re-check when the signed-in user changes (watchSignedInUser → lib/auth/userWatcher.ts), 2026-10-20; #145 migration 087 — the daily purge removes pending durations > 1 day, 2026-10-20; #144 one user lookup per signed-in page + dashboard footnote, 2026-10-20; #140 auth friction — failed email links explained, reset works cross-browser with the token_hash template, verify-email signed out, signup fixes, analytics-001, 2026-10-19; #143 migration 086 — 356 suspected_fleet + 1,372 suspected_datacenter older rows, 2026-10-19; #142 Analytics hides signed-out likely-automated views by default (switch ?automated=include), six readers paged, 2026-10-19; #141 migration 085 — pre-#139 leave-beacon rows merged into their views, analytics-001, 2026-10-18; #139 one page_views row per view (client view_id, visible-time duration), traffic_class estimate (datacenter ranges), hashed Upstash keys, admin analytics reads paged + fail on error, migration 084, analytics-001, 2026-10-17; #138 scan advisories cleared — source-map-js 1.2.2, braces acknowledged — and the scan reads its
  history again, sec-001, 2026-10-16; #137 homepage "Articles saved this week" — every reader's saves, migration 083, anon SELECT on
  saved_articles revoked, feed-002, 2026-10-16; #136 proxy runs only with the Supabase session cookie, perf-001, 2026-10-14; #135 admin Pipeline rebuilt as the Slack messages expanded, Article Health removed, 2026-10-14; #134 daily reminder counts run 2 + excludes the test account, weekly AI report hidden, Overview removed, 2026-10-14; #133 Growth OS daily posts panel, one article → every platform, 2026-10-13; #132 unit tests in init.sh check + PR smoke, 2026-10-13; #131 Facebook IL closing lines: typeable address + WhatsApp Community, 2026-10-13; #129 + #130 Facebook IL link-free posts, vetree.app/il, "save it" hint, 2026-10-13; #127 schema audit + #128 replay safety, migrations 080–082 + 000 recorded, 2026-10-12; #126 unlock log guard, 2026-10-12; PRs #120–#125 least privilege + policy audit, migrations 075–079 applied, 2026-10-11; #119 lint cleanup, 2026-10-10; #118 build warnings / middleware → proxy, 2026-10-10; #117 init.sh lock / unlock, 2026-10-10; #116 "new this week" count, 2026-10-10; #115 shorter digest footer, 2026-10-09; #114 Search Console fixes, 2026-10-07; before it #113 access-control audit,
  migration 074 applied) — last verified: production /api/version = 3dd971f, post-merge health check success; cross-browser reset verified in production (incognito, token_hash template); earlier: 085 log {legacy 482, matched 480, loads 479, deleted 482}, 0 legacy rows left, schema audit PASS
- **Standard startup:** `docs/harness/init.sh` (state, then check) — see README for exit codes. Take / release
  the lock only with `init.sh lock <item> --agent …` / `init.sh unlock "<message>"` (D12), never by hand
- **Standard verification:** `docs/harness/init.sh check [--item <id>]` (now incl. `npm run test:unit`, hard RED); build
  reads production Supabase (read-only); never Playwright as a baseline
- **Vercel CPU (perf-001, 2026-10-14):** Hobby Fluid Active CPU was 4h 50m / 4h (30 days). #136: the proxy runs only
  with `sb-<ref>-auth-token` or its `.0` chunk. Watch the usage chart 2026-10-15..17 (proxy row down, < ~8 min/day);
  if not enough → option B (article ISR). PR rule: drafts until done, ready once, never re-run a passing suite.
  Functions Storage was 8.93 / 10 GB → Roi set deployment retention: pre-production 1 week, production / canceled /
  errored 30 days (2026-10-15); re-read it with the CPU chart.
- **Highest-priority unfinished item:** perf-001 check after ~2026-10-24 06:00 UTC (12 h log: FB on / → /link-preview, home renders ~235 → ~80). analytics-001 — left: only the Gmail re-check (Roi); then close it. 12 h check done 2026-10-23: #152 + #153 confirmed (function requests −25%; remaining home renders = our smoke + crawlers → perf-001). Done 2026-10-22: #152, #153; /auth/v1/user = 1 per load; /article/null = outside traffic; search-batch 400s = our own smoke; Chrome "503"s = cancelled fetches. CI Node 20 upgrade is Roi's call; perf-001 monitoring; scripts-001 needs Roi; ai-001 ~2026-11-01
- **Vercel Firewall (2026-10-19):** custom rule "Block Tencent Cloud bot fleet" — deny AS132203 + AS45090 (CLI: `vercel firewall rules list|…`, publish after changes). Resend click tracking OFF for digest.vetree.app (Roi). Supabase Reset Password template = branded token_hash link (Roi).
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

### Session 20261023-1625-claude-3452 · 2026-10-23 · Claude Code · perf-001 (bot traffic; monitoring)
- Goal: Roi — "let's look at the bot traffic in perf-001".
- Findings (read-only, 12 h request logs 10-21/22/23): facebookexternalhit fetches / ~155 ×/12 h, every ~2.5 min,
  identical each day (Roi: no FB ad running) = ~2/3 of all home renders (home is force-dynamic, private no-store);
  Meta user agents ~25–30% of function requests. Our daily smoke ~230 function requests at ~10:58 (VetreeQABot UA).
  OAI-SearchBot / ChatGPT-User ~65 (AI search referrals — keep). Google / Bing / Apple / Amazon ~30. The request log
  has no IP / ASN fields — classification is by user agent + pace only.
- Done: #154 beforeFiles rewrite (next.config.ts): / with facebookexternalhit|facebookcatalog → /link-preview, a static
  page under the root layout (same title / description / canonical / OG / Twitter tags; noindex). lib/metaPreview.ts
  + 2 unit tests. Article pages untouched (per-article tags; ~75 FB fetches / 12 h, mostly the day's post).
- Start state: main 483dd31; lock taken for perf-001.
- Verification: init.sh check GREEN; next start locally (FB → prerender HIT, browser → private no-store, tags
  identical); Vercel preview via `vercel curl` + preview request log (FB → pathType prerender HIT, browser →
  streaming_func); PR suite green; merged a82f724; production: FB → x-matched-path /link-preview HIT, browser → / MISS,
  security headers on both; post-merge health check success.
- Review: Codex · tier 2 (next.config.ts carries security headers) · 1 round · BLOCKING: none; NB noindex + drop
  meta-externalagent (robots.txt already blocks it) applied, not re-reviewed; NB "verify on Vercel" done.
- Commits / PR: #154 → a82f724 (Roi: "Merge").
- Pending Roi approvals: none.
- Known risks / unresolved: none known. Facebook's cached preview refreshes hourly (description carries the
  article count).
- Lesson: `npx vercel curl <path> --deployment <preview url>` reaches protected previews — use it (plus the preview
  request log's pathType) to prove a route is served without a function before merging.
- Next best step: after ~2026-10-24 06:00 UTC, 12 h request log: facebookexternalhit on / should show route
  /link-preview (prerender), home renders ~235 → ~80. Then the Vercel usage chart (daily Fluid Active CPU).

### Session 20261023-1327-claude-8155 · 2026-10-23 · Claude Code · analytics-001 (12 h check; item open for the Gmail re-check)
- Goal: Roi "let's go" — the 12 h request-log check of #152 + #153.
- Done (read-only): production request log 2026-10-23 01:29 → 13:16 UTC (3,299 records, one deployment dpl_2kALSVcb = 483dd31).
  Function requests 1,076 (before: 1,427 / 1,495 per 12 h, about −25%). /privacy 9 (was 120), /terms 4 (17), /library 5
  (46), /profile 3 (31). /index.rsc 225 (342): 107 = our production smoke (cron ran 10:57:49; same size as on 10-22),
  118 = signed-out crawlers doing full page loads every ~0.5 s (/login, /, /, …, article pages; US / JP / FR / TH),
  16 = IL (Roi). No signed-in refresh bursts; the 19:16 post-deploy burst did not recur.
- Start state: main 483dd31; lock taken for analytics-001.
- Verification: the counts above (vercel logs requests --since 12h --limit 10000).
- Review: none (read-only check, no code).
- Commits / PR: none.
- Pending Roi approvals: none.
- Known risks / unresolved: crawler page loads are now the main source of home renders — a perf-001 question (Firewall /
  bot rules), not analytics-001.
- Lesson: when comparing day-over-day request counts, subtract the smoke window first (its size is stable ~100 renders).
- Next best step: Gmail re-check (Roi: does an inbox that never got Vetree mail flag the auth email?) → close
  analytics-001.

### Session 20261022-1659-claude-63e7 · 2026-10-22 · Claude Code · analytics-001 (follow-ups; item open)
- Goal: Roi — analytics-001 leftovers (nav prefetch, /article/null, search 400s, /auth/v1/user calls); "let's finish the analytics".
- Done: #152 prefetch={false} on links to /privacy /terms /library /profile /admin/reports (Footer, cookie banner,
  landing, AuthButton, app bar, BottomNav, SearchControls, LibraryClient, PersonalizedFeed). #153 useAuth refresh storm:
  auth-js emits SIGNED_IN on every page start + tab refocus (_recoverAndRefresh) and every useAuth() (one per stream
  row) called router.refresh() → 47 uncached /index.rsc renders per signed-in home load (342 in 12 h). Now one
  module-level decision (lib/auth/signInRefresh.ts): refresh once, only when SIGNED_IN / INITIAL_SESSION names a user
  different from the one in the session cookie at page load. CLAUDE.md Auth & Roles updated.
- Findings: /auth/v1/user = 1 per signed-in load now (the 10-19 excess gone since #144). /article/null 404s = outside
  traffic. CORRECTION: the 3 /api/search/batch 400s at ~11:07 UTC are our own production smoke (negative tests,
  e2e/smoke.spec.ts:108-113; GitHub starts the 06:00 cron ~11:06). Chrome's "503" on superseded RSC fetches = cancelled
  requests (Vercel logged 200) — likely also the old localhost 503s.
- Start state: main 08e7628; lock taken for analytics-001.
- Verification: #152 / #153 init.sh check GREEN; PR suites green (39820624117, 39836572589); post-merge checks success
  (39822362940, 39838434123). #153 in production (Chrome, signed in): home load 47 → 1 home RSC fetch; 3 simulated
  refocus events → 0 extra; session cookie readable via document.cookie (2 chunks, base64) and parses to the user id.
- Review: Codex · #152 tier 1 · 2 rounds (r1 BLOCKING missed links, fixed; r2 none) · #153 tier 2 · 2 rounds (r1 2
  BLOCKING with SDK repro — late listener / A→B account switch — fixed; r2 none, both RESOLVED).
- Commits / PR: #152 → 79ed91c, #153 → 483dd31 (Roi: "merge when green", "merge on green").
- Pending Roi approvals: none.
- Known risks / unresolved: a burst of ~20 /index.rsc at 19:16:27–32 UTC right after the #153 deploy, alongside
  /admin/growth requests — most likely another tab still on the old bundle; re-check in the 12 h log.
- Lesson: count server renders per page load in the Vercel request log, not just requests per link — a client
  listener multiplied by component count is invisible in code review. Our own production smoke shows up in request
  logs as US headless traffic at ~11:07 UTC: check the smoke window before blaming outside bots.
- Next best step: after ~2026-10-23 08:00 UTC, re-read the 12 h request log: /privacy /terms /library /profile
  (baseline 120 / 17 / 46 / 31 of 1,427) and /index.rsc (baseline 342) should drop. Gmail re-check (Roi). Then close
  analytics-001.

### Session 20261021-1635-claude-31c7 · 2026-10-21 → 2026-10-22 · Claude Code · growth-003 (closed)
- Goal: Roi — "articles I mark as not relevant keep popping up as daily post suggestions"; also "I can't see
  recommendations until today's article resets".
- Investigation (production, read-only): dismissals work — 243 irrelevant rows, none dismissed twice, none shown
  again (2 cards in a set already loading 8 s after the click); no title/DOI twins of dismissed articles shown; 0 of 36
  vatinoxan articles ever dismissed. Cause: fixed ranking → ~8/10 cards identical day to day (Zenalpha shown 10 days
  running until marked already-published; vatinoxan sedation in every set since 10-18).
- Done: #150 lib/growth/passedOver.ts — shown on 3 earlier Israel days with no post/dismissal → out 14 days (panel +
  auto-pick), "N resting" in the panel; recommendations reachable after the day's article is set (review + dismiss);
  app/api/CLAUDE.md. #151 touchedToday on the Israel day (was UTC: yesterday's posts/skips blocked until 03:00 Israel);
  6 rankGrowthCandidates tests on a fake db.
- Start state: main a02736c; lock taken for growth-003.
- Verification: dry run on production data (18 resting, 2 eligible → 3 new articles in the top 10); 7 + 6 unit tests;
  mutation checks (old UTC line fails the Israel-day test; removing the favorites fetch fails the crowd-favorite test);
  init.sh check GREEN on both PRs; PR suites green (39638476075, 39816936594); post-merge checks success (39639363425,
  39818059494).
- Review: Codex · #150 tier 2 (app/api/CLAUDE.md) · 2 rounds (r1 none + NB empty-state text, fixed; r2 none) · #151
  tier 1 · 2 rounds (r1 none + 2 NB test gaps, fixed; r2 none, RESOLVED).
- Commits / PR: #150 → 1de3d45, #151 → 08e7628 (each on Roi's "merge when green"). Vercel deployed both on its own.
- Pending Roi approvals: none.
- Known risks / unresolved: the resting rule counts any panel load as "shown", including review-only loads after the
  day's article is set — intended, watch whether lists empty out.
- Lesson: when a dashboard "keeps showing" something, check the served-sets log before the exclusion code: the logic was
  right; the experience came from a static ranking. `npx vercel ls` can hang in a wait loop — poll /api/version instead.
- Next best step: analytics-001 leftovers (Roi, 2026-10-22): nav links prefetched twice; /article/null 404s; 400s on
  /api/search/batch.

### Session 20261021-1301-claude-0f07 · 2026-10-21 · Claude Code · analytics-001 (503 check + #149; paused for growth-003)
- Goal: Roi picked the 503 prefetch check; then "do the prefetch change".
- Done: 503s NOT reproduced in production — 12 h request log (3,472 records, Hobby keeps 12 h) 0 5xx; Roi's signed-in
  home load 14:31 UTC: 43 requests all 200/304; pages never return 503 in code → localhost 503s were a dev-server
  artifact. Same load ran ~40 uncached function requests (every visible /article/* prefetched) → #149 prefetch={false}
  on StreamRow ×2, SavedThisWeek, ArticleCard, GroveView.
- Start state: main b48d847; lock taken for analytics-001.
- Verification: init.sh check GREEN (e6c7ca3), build green 042c307; PR suite green (run 39620775429); production
  16:31 UTC signed-in home load: 0 /article/* prefetches (before ~30), ~10 function requests (before ~40).
- Review: Codex · tier 1 · 2 rounds (r1 BLOCKING: ArticleCard + GroveView still prefetched — verified, fixed; r2 none).
- Commits / PR: #149 → a02736c (squash, on Roi's word).
- Incident: Vercel created NO production deployment for the merge push (previews fine) → post-merge check failed
  after 15 min. On Roi's go-ahead: POST /v13/deployments (gitSource sha a02736c) → dpl_Fk8XaNVTK7e1fyE2R2dXf3BYaQYr;
  /api/version = a02736c; check re-run success. The auto-mode permission check blocks production deploys without Roi.
- Pending Roi approvals: none.
- Known risks / unresolved: nav links /library /profile /admin prefetched twice per load; 4× 404 /article/null and
  3× 400 /api/search/batch in 12 h; watch whether Vercel misses another push.
- Lesson: Hobby request logs reach back only 12 h (`vercel logs requests`); signed-in traffic is a few views a day, so
  a zero needs a deliberate signed-in load to mean anything. `vercel api --input file.json` for nested bodies (-F
  nested keys fail with '"files" should be an array').
- Next best step: growth-003 (Roi, 2026-10-21) — "not relevant" articles keep returning as daily post suggestions.

