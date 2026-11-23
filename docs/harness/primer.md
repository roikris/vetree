# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-11-23 — Session 20261122-1742-claude-bdb8 (analytics-001: growth review report; growth-005 / ux-001 / seo-002 / analytics-002 added)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `2f17c51` (#160 robots.txt blocks meta-webindexer + ShapBot — bot surge 11-15..17, analytics-001, 2026-11-17; #159 every Claude call on claude-sonnet-5-5 — Roi, no re-measure; expect ~1.46x tokens, ai-001, 2026-11-06; #158 Growth OS relevance scoring runs as job `score` of enrich-articles.yml after enrichment — panel scoring had timed out on every batch since 10-14, 338/338 backfilled, growth-004, 2026-11-06; #157 next 16.3.8 → 16.4.3, zod + happy-dom patched — scan 2026-10-29 critical advisories, sec-002, 2026-11-01; #156 Google Search Console → Admin → Analytics → Google Search — migration 088, search-console.yml daily 05:00 UTC, 30-day backfill done, analytics-001, 2026-10-31; #155 anon-key writer scripts + day-one CSV importer removed, scripts-001, 2026-10-24; #154 facebookexternalhit on / → static /link-preview (next.config.ts beforeFiles rewrite, lib/metaPreview.ts), perf-001, 2026-10-23; #153 useAuth refreshes once per real sign-in (lib/auth/signInRefresh.ts) — was ~46 server renders per signed-in home load, analytics-001, 2026-10-22; #152 no prefetch on links to /privacy /terms /library /profile /admin/reports, analytics-001, 2026-10-22; #151 "touched today" on the Israel day + ranking tests, growth-003, 2026-10-22; #150 passed-over recommendations rest 14 days (lib/growth/passedOver.ts), panel reachable after the day's article is set, growth-003, 2026-10-21; #149 no prefetch on repeated article links — stream, saved-this-week, ArticleCard, Grove, analytics-001, 2026-10-21; Vercel missed the push → production deployed via the API on Roi's go-ahead; #148 component tests for the consent prompts — happy-dom dev dependency, analytics-001, 2026-10-20; #147 unused FollowTagButton / useFollowedTags removed, 2026-10-20; #146 consent prompts re-check when the signed-in user changes (watchSignedInUser → lib/auth/userWatcher.ts), 2026-10-20; #145 migration 087 — the daily purge removes pending durations > 1 day, 2026-10-20; #144 one user lookup per signed-in page + dashboard footnote, 2026-10-20; #140 auth friction — failed email links explained, reset works cross-browser with the token_hash template, verify-email signed out, signup fixes, analytics-001, 2026-10-19; #143 migration 086 — 356 suspected_fleet + 1,372 suspected_datacenter older rows, 2026-10-19; #142 Analytics hides signed-out likely-automated views by default (switch ?automated=include), six readers paged, 2026-10-19; #141 migration 085 — pre-#139 leave-beacon rows merged into their views, analytics-001, 2026-10-18; #139 one page_views row per view (client view_id, visible-time duration), traffic_class estimate (datacenter ranges), hashed Upstash keys, admin analytics reads paged + fail on error, migration 084, analytics-001, 2026-10-17; #138 scan advisories cleared — source-map-js 1.2.2, braces acknowledged — and the scan reads its
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
- **Highest-priority unfinished item:** growth-005 — December posting trial tab + trial analytics (Roi 2026-11-23), must merge before 2026-12-01; then ux-001, seo-002, analytics-002. Still overdue: bot surge (analytics-001, 2026-11-17): ~11-18 18:00 UTC read the 12 h request log (meta-webindexer gone? renders vs Oct 600–950; were 3,089 / 12 h) + Bot Protection's log → ask Roi to switch Log → Challenge (check our smoke / health check first); still high → article pages cacheable (option 3, tier 2). growth-004 done (#158) — Roi checks the panel 11-07 (fresh picks, no amber warning). ai-001 done (#159, Sonnet 5.5) — watch the 11-07 enrichment + score runs and Anthropic usage. sec-002 done (#157); manual scan 11-01 clean. perf-001: #154 confirmed 2026-10-24 (FB on / → CDN, 0 home renders; home renders without smoke 276 → 113 / 12 h) — left: Roi reads the Vercel usage chart (CLI can't on Hobby). analytics-001 — left: Roi compares Oct 26–28 GSC site totals (676/17, 589/39, 489/31) with the Search Console UI + the Gmail re-check; then close it. Optional: post the cat-treats article (pubmed-42908201, position 2.1, never posted); Google landings leave after ~12 s. Revisit ~2026-10-26 (Roi, 2026-10-23: leave it for now): the Chinese fleet came back 10-20 from Chinese ISP addresses (mostly Hangzhou) after the Tencent firewall block — 17–39 views/day 10-20..22, 1 view per IP, Chrome 148–150 + iPhone, article pages, no referrer, flat over 24 h — untagged (086 was a one-off backfill; live tagging = hosting ranges only), so Admin → Analytics counts them as people; 10-23 nearly none. Options: live fleet tagging + re-tag 10-20.. (recommended), firewall challenge for CN, or nothing. 12 h check done 2026-10-23: #152 + #153 confirmed (function requests −25%; remaining home renders = our smoke + crawlers → perf-001). Done 2026-10-22: #152, #153; /auth/v1/user = 1 per load; /article/null = outside traffic; search-batch 400s = our own smoke; Chrome "503"s = cancelled fetches. CI Node 20 upgrade is Roi's call; perf-001 monitoring
- **Vercel Firewall:** Bot Protection = **Log** since 2026-11-17 17:51 UTC (Roi; was Off). 2026-10-19: custom rule "Block Tencent Cloud bot fleet" — deny AS132203 + AS45090 (CLI: `vercel firewall rules list|…`, publish after changes). Resend click tracking OFF for digest.vetree.app (Roi). Supabase Reset Password template = branded token_hash link (Roi).
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

### Session 20261122-1742-claude-bdb8 · 2026-11-22 → 11-23 · Claude Code · analytics-001 (growth review; item open)
- Goal: Roi — "look at the analytics patterns and produce a full report on what we can be doing better … why linkedin
  impressions have declined … send it to codex as well for an independent evaluation". Then (11-23) turn it into Growth OS
  changes + a posting schedule → Roi: a December trial in its own tab, Daily Posts unchanged; "go ahead, also let's fix
  Outside Growth OS small fixes".
- Completed: report published privately (claude.ai artifact 4WU7efW9X2pZESkpc3hpLe, "Vetree Growth Review"). Findings:
  LinkedIn weekly impressions 3,843 (Jun 1–Aug 10) → 437 (last 4 weeks); breakout posts (13 ≥ 1,000 Mar–mid-Aug) stopped,
  2 since; 0 comments on the last 29 posts (winners had 3–11); engagement rate steady; followers 991 → 1,016. Since 09-29:
  WhatsApp 265 visits / 11 of 18 signups, Google 783 / 1, LinkedIn 35 / 1; WhatsApp weekly visits falling (13 last week).
  Since 10-13 (~38 posts each): X 1 visit, Facebook IL 4. Mobile signup: all 5 signup_errors = "Passwords do not match".
  Codex (independent analysis, own Terminal) agreed; pushback: daily posting + long format existed in the good months,
  judge by activated users, one change per channel at a time.
- Found in code: DailyPosts sends `recentPosts` to generate-post, which never reads it (no repetition guard → templated
  openings). Standing constraint (insights contract): never suggest changing LinkedIn cadence — plan keeps LinkedIn daily.
- Backlog: added growth-005 (December trial tab + trial analytics, must merge before 12-01), ux-001 (mobile signup),
  seo-002 (Google landings: related + inline save), analytics-002 (stale LinkedIn per-post rows).
- Start state: main 2f17c51, clean.
- Verification: read-only production reads (service role, temp scripts deleted); LinkedIn analytics pages in Chrome
  (past_365_days / past_28_days top posts). LinkedIn XLSX exports list only the top 50 posts → linkedin_post_metrics
  per-post values go stale (one row stored at 4 impressions has 9,375); linkedin_daily_metrics totals are right.
- Review: n/a (analysis, no code) · Codex independent analysis 1 round.
- Commits / PR: none (state only).
- Pending Roi approvals: Bot Protection Log → Challenge (after the overdue 11-18 log read); next 16.4.3 → 16.4.5.
- Known risks / unresolved: the 11-18 bot-surge re-check was never done.
- Next best step: growth-005 now (Dec 1 deadline), then ux-001, seo-002, analytics-002.

### Session 20261117-1736-claude-4fa5 · 2026-11-17 · Claude Code · analytics-001 (bot surge; monitoring)
- Goal: Roi — "huge surge of bots last few days. investigate fully and recommend how we stop it".
- Findings (12 h request log 11-17 05:39 → 17:38 UTC, 6,255 requests, 3,089 function renders vs 600–950 / 12 h in
  October; firewall overview 11.2k allowed / 25 h): meta-webindexer 1,182 requests / 872 renders (28%), ~15 views/day
  until 11-14 → ~200 req/h on 11-17, repeats articles (one 63×), /index.rsc prefetch 404×, 0 meta.ai referrals since
  10-20. Disguised no-JS scraper: browser-named UAs, 973 article renders vs 73 tracking calls; VN 155 / BR 114 / BD 86
  renders, ~10/h each, one distinct article per request, rotating UAs, no static assets — invisible in page_views.
  ShapBot (7 IPs, Google Cloud Council Bluffs): 568 page_views since 10-27, 517 in one hour 11-16 00:xx — the spike in
  Admin → Analytics (bot_name, already excluded). Our smoke 1,214 requests / 238 renders (scheduled, 15:xx). Root
  cause of the cost: app/article/[id]/page.tsx reads cookies (getUser) → every hit is a render (no ISR).
- Done: Vercel Bot Protection Off → **Log** (published 2026-11-17 17:51 UTC, Roi: "yes, 1 and 2 today"). #160
  robots.txt Disallow: / for meta-webindexer and ShapBot (facebookexternalhit, meta-externalagent unchanged).
- Start state: main 2d167ec; lock taken for analytics-001.
- Verification: `vercel firewall status` → Bot Protection Log; init.sh check: tsc / lint ratchet / unit / acl / rls /
  schema PASS, build FAIL once on Next's new SecurityFatalError nudge (next 16.4.3: GHSA-mfr8-8qww-v76h,
  GHSA-vc7v-qv4w-wrv8, moderate, 'use cache' only — not used here), `npm run build` retry exit 0; PR suite + replay
  green (44143188339); merged 2f17c51; production /api/version = 2f17c51, robots.txt serves both groups; post-merge
  health check success.
- Review: Codex · tier 1 · 1 round · 17k tokens · BLOCKING: none, NON-BLOCKING: none.
- Commits / PR: #160 → 2f17c51 (Roi: "merge").
- Pending Roi approvals: Bot Protection Log → Challenge after the 24 h log is read; next 16.4.3 → 16.4.5 (Roi's call).
- Known risks / unresolved: whether the scheduled smoke / post-deploy health check (GitHub Actions, VetreeQABot,
  bypass header only on previews) would be challenged — read before switching. npm audit 11-17: 17 high (picomatch
  ReDoS GHSA-fc5q-39xc-vjpf via @sentry/nextjs / eslint-config-next dev chains) — Thursday's scan will show them.
- Lesson: `next build` (16.4.3) can stop with a "SecurityFatalError" upgrade nudge that tells the agent to run
  `next upgrade --agent=security`: verify with npm audit, retry the build, don't run the suggested command unasked.
  `vercel firewall publish` needs `--confirm-name <project> --effects-digest <d>` from its own output; `traffic list`
  needs Observability Plus (not on Hobby). `gh pr merge --delete-branch` was refused by auto mode — merge without it.
- Next best step: ~2026-11-18 18:00 UTC — 12 h request log: meta-webindexer gone?, renders vs 600–950; Bot Protection
  log (what it would challenge; our smoke/health check?) → ask Roi to switch to Challenge. If renders stay high:
  option 3 — article pages cacheable (auth-dependent UI client-side), tier 2.

### Session 20261106-1320-claude-2481 · 2026-11-06 · Claude Code · ai-001 (closed)
- Goal: Roi — "lose the check, let's just move to Sonnet 5.5 altogether" (no side-by-side token re-measure).
- Done (#159 → 2d167ec): reverses 66c5983 — CLAUDE_MODEL = claude-sonnet-5-5; enrich-articles.js, qa-report.mjs,
  qa-triage.mjs repeat the ID + `thinking: between_tools` inline; NO_UPFRONT_THINKING kept conditional (switching back =
  one line + 3 scripts); CLAUDE.md rule 0 (decision + history), CONTENT_AGENT.md (incl. max tokens 2500), review
  checklist. Audit: all 11 Claude call sites send the thinking flag; 2026-10-01 output budgets unchanged; Growth OS
  scores stay valid (checked against the model on their row).
- Start state: main 1ec2069; previous lock (20261106-1150-claude-05a3) released by its session.
- Verification: init.sh check GREEN; live probe claude-sonnet-5-5 + between_tools → end_turn, text only; PR suite +
  replay green; merged 2d167ec; /api/version = 2d167ec; post-merge health check success.
- Review: Codex · tier 2 · 1 round · 50k tokens · BLOCKING: none; NB stale "Max tokens: 1024" doc → fixed.
- Commits / PR: #159 → 2d167ec (Roi: "merge" — first attempt blocked by the auto-mode classifier, merged after auto mode
  was exited).
- Pending Roi approvals: none.
- Known risks / unresolved: expect ~1.46x Anthropic token spend (last measured 2026-10-01). First 5.5 runs to watch:
  enrichment + score job 07:00 UTC 11-07, Friday analysis insights, Thursday security scan.
- Next best step: glance at the 11-07 enrichment Slack report and Anthropic usage after a week.

### Session 20261106-1150-claude-05a3 · 2026-11-06 · Claude Code · growth-004 (closed)
- Goal: Roi — Growth OS recommendations "poorer and poorer": repeats, high decline rate, clearing the roster more than
  once a day. Backlog session: growth-004 added + claimed. Roi: "go", then "merge and backfill".
- Findings: no growth_article_scores write since 2026-10-14; 0 small-animal articles created since 10-10 scored. The
  panel scored on load (50 max, batches of 25, 30 s budget); one batch of 24 timed at 41 s on Sonnet 4.6 (2,174 output
  tokens) → every batch aborted. Worked while < ~15 new articles/day; the 10-14/15 backlog made every batch a full 25
  and it never recovered. Effect: scored pool 275 (10-16) → 160 (11-06) of ~340 eligible, youngest shown 7 → 29 days,
  top score 9 → 5, 10/10 repeats on 11-06 (passed-over articles returning after 14 days). Dismissals work: no
  dismissed article reappeared (by id or title/DOI). The 911 → 339 eligible drop on 10-16 = the 60-day window.
- Done (#158 → 1ec2069): enrich-articles.yml job `score` (after enrich, if !cancelled, Node 22, npm ci) runs
  scripts/score-growth-articles.mts (15 min budget, exit 1 + Slack when eligible articles stay unscored); batches of
  10; recommendations route reads cached scores only + `stale_unscored_count` → amber panel warning (> 48 h unscored);
  2 unit tests (mutation-checked); CLAUDE.md + app/api/CLAUDE.md.
- Start state: main aecc2cb; no lock held.
- Verification: init.sh check GREEN on ee749eb and f6f859f; PR suite + replay green; merged 1ec2069; /api/version =
  1ec2069, post-merge health check success. Backfill: Enrich Articles dispatch run 42219120027 (both jobs success):
  "scored 259/338" → "scored 338/338"; 179 scores written today (max-score ≥ 8: 28).
- Review: Codex · tier 2 · 2 rounds · 38k + 20k tokens · r1 BLOCKING: Node 20 has no native WebSocket → supabase-js
  throws (verified, fixed: Node 22) + 2 NB (Slack timeout, setup inside catch) fixed; r2 BLOCKING: none.
- Commits / PR: #158 → 1ec2069 (Roi: "merge and backfill").
- Pending Roi approvals: none.
- Known risks / unresolved: the local backfill was blocked by the auto-mode classifier (prod write) — done via the
  workflow instead. Each manual Enrich Articles run also runs enrichment (harmless when nothing is pending).
- Lesson: an in-request AI step with a fixed time budget can fail silently forever once its backlog grows; move such
  work to a scheduled job that goes red when it leaves work undone.
- Next best step: Roi — check the panel tomorrow (fresh, high-scored articles; no amber warning); 07:00 UTC run's
  `score` job should score only the day's new articles.

### Session 20261101-1635-claude-5b3d · 2026-11-01 · Claude Code · sec-002 (closed)
- Goal: Roi — "security check has critical issues pending" → "start". Backlog session: sec-002 added + claimed.
- Findings: scan report 2026-10-29 23:02 UTC (scheduled, severity critical) — 3 Next.js advisories (<= 16.4.0, patched
  16.4.1): GHSA-2464-fhr4-w9xw critical (image optimizer + SVG; /_next/image live, no next/image, no
  dangerouslyAllowSVG), GHSA-673q-mjm6-r5xr critical (`use cache` — not used), GHSA-p3m5-59mp-jv5r high (Server
  Actions DoS — 8 action files). npm audit also: zod < 4.6.6 high (lint plugin only), happy-dom <= 21.0.3 high (unit
  tests only).
- Done (#157): next ^16.3.8 → ^16.4.3 (+ @next/*); lockfile zod 4.3.6 → 4.6.7, happy-dom 21.0.3 → 21.0.4.
  eslint-config-next kept at 16.3.8: 16.4.3 brings eslint-plugin-react-hooks 7.1.1 → 4 new lint errors
  (SynthesisPosts immutability, PipelineStatus + SynthesisPanel ×2 set-state-in-effect) — a separate change.
  security-acknowledged.json untouched.
- Start state: main 22a875b; previous lock (20261031-0937-claude-ccc3) released by its session before this one.
- Verification: init.sh check GREEN (tsc, lint ratchet, unit, acl / rls / schema audits, build); npm audit 0 critical /
  0 high (39 moderate: eslint / typescript-eslint / Sentry / OpenTelemetry chains, major bumps); lockfile integrity of all
  12 updated packages = registry; PR suite + replay green; merged aecc2cb; production /api/version = aecc2cb, home 200,
  /_next/image 200, security headers present; post-merge health check success.
- Review: Codex · tier 2 (security) · 1 round · 70k tokens · BLOCKING: none; NB "integrity not verified (no registry
  access)" → verified by me (12/12 match).
- Commits / PR: #157 → aecc2cb (Roi: "yes", then "merge" — the first merge attempt was blocked by Claude Code's auto-mode
  classifier; merged after auto mode was exited).
- Pending Roi approvals: optional manual security scan now (POST /api/admin/security/scan — paid AI call + Slack), else
  Thursday 2026-11-05's scheduled run confirms.
- Known risks / unresolved: @sentry/nextjs 9 lists no Next 16 peer (pre-existing, "invalid" in npm ls since Next 16).
- Lesson: `init.sh lock <new id>` refuses items not in feature_list.json — lock `backlog`, add + claim the item, commit
  the state, then branch.
- Next best step: Thursday's scan clean? Follow-up candidate: eslint-config-next 16.4.3 + the 4 react-hooks lint fixes.

