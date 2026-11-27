# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-11-27 — Session 20261125-1803-claude-8472 (analytics-003 merged, #165 + #166)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `fa50ec5` (#166 search cutover date = the 092 deploy 2026-11-25, analytics-003, 2026-11-27; #165 search analytics leave out crawlers + landing-chip searches (`via='chip'`) — migration 092 search_logs bot_name / traffic_class / via, backfill 47 rows, searchDemand() for every demand reader, analytics-003, 2026-11-25; #164 December trial records how each day's article was chosen — migration 091 growth_trial_posts.pick_source, ranking unchanged, growth-006, 2026-11-24; #163 LinkedIn per-post numbers keep the highest export value + its range — migration 090 apply_linkedin_post_metrics, analytics-002, 2026-11-24; #162 article pages: Keep reading (4 related) + inline save, seo-002, 2026-11-23; #161 Growth OS → 🧪 December Trial + trial analytics, migration 089 growth_trial_posts / record_trial_post, Daily Posts records nothing Dec 1–31, growth-005, 2026-11-23; #160 robots.txt blocks meta-webindexer + ShapBot — bot surge 11-15..17, analytics-001, 2026-11-17; #159 every Claude call on claude-sonnet-5-5 — Roi, no re-measure; expect ~1.46x tokens, ai-001, 2026-11-06; #158 Growth OS relevance scoring runs as job `score` of enrich-articles.yml after enrichment — panel scoring had timed out on every batch since 10-14, 338/338 backfilled, growth-004, 2026-11-06; #157 next 16.3.8 → 16.4.3, zod + happy-dom patched — scan 2026-10-29 critical advisories, sec-002, 2026-11-01; #156 Google Search Console → Admin → Analytics → Google Search — migration 088, search-console.yml daily 05:00 UTC, 30-day backfill done, analytics-001, 2026-10-31; #155 anon-key writer scripts + day-one CSV importer removed, scripts-001, 2026-10-24; #154 facebookexternalhit on / → static /link-preview (next.config.ts beforeFiles rewrite, lib/metaPreview.ts), perf-001, 2026-10-23; #153 useAuth refreshes once per real sign-in (lib/auth/signInRefresh.ts) — was ~46 server renders per signed-in home load, analytics-001, 2026-10-22; #152 no prefetch on links to /privacy /terms /library /profile /admin/reports, analytics-001, 2026-10-22; #151 "touched today" on the Israel day + ranking tests, growth-003, 2026-10-22; #150 passed-over recommendations rest 14 days (lib/growth/passedOver.ts), panel reachable after the day's article is set, growth-003, 2026-10-21; #149 no prefetch on repeated article links — stream, saved-this-week, ArticleCard, Grove, analytics-001, 2026-10-21; Vercel missed the push → production deployed via the API on Roi's go-ahead; #148 component tests for the consent prompts — happy-dom dev dependency, analytics-001, 2026-10-20; #147 unused FollowTagButton / useFollowedTags removed, 2026-10-20; #146 consent prompts re-check when the signed-in user changes (watchSignedInUser → lib/auth/userWatcher.ts), 2026-10-20; #145 migration 087 — the daily purge removes pending durations > 1 day, 2026-10-20; #144 one user lookup per signed-in page + dashboard footnote, 2026-10-20; #140 auth friction — failed email links explained, reset works cross-browser with the token_hash template, verify-email signed out, signup fixes, analytics-001, 2026-10-19; #143 migration 086 — 356 suspected_fleet + 1,372 suspected_datacenter older rows, 2026-10-19; #142 Analytics hides signed-out likely-automated views by default (switch ?automated=include), six readers paged, 2026-10-19; #141 migration 085 — pre-#139 leave-beacon rows merged into their views, analytics-001, 2026-10-18; #139 one page_views row per view (client view_id, visible-time duration), traffic_class estimate (datacenter ranges), hashed Upstash keys, admin analytics reads paged + fail on error, migration 084, analytics-001, 2026-10-17; #138 scan advisories cleared — source-map-js 1.2.2, braces acknowledged — and the scan reads its
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
- **Highest-priority unfinished item:** none queued (ux-001 closed, seo-002 #162 + analytics-002 #163 merged). Roi: re-type the 2026-06-11 LinkedIn post's impressions (9,375). growth-006 merged (#164): Dec 1 check one trial row has pick_source. growth-005 merged (#161): from 2026-12-01 Roi posts from 🧪 December Trial; results final 2027-01-08. Bot surge (analytics-001) resolved 2026-11-27: 'other-bot' page views 69 / 615 / 108 on 11-15..17, 0 every day 11-18..27 — #160 worked, Bot Protection stays Log. growth-004 done (#158) — Roi checks the panel 11-07 (fresh picks, no amber warning). ai-001 done (#159, Sonnet 5.5) — watch the 11-07 enrichment + score runs and Anthropic usage. sec-002 done (#157); manual scan 11-01 clean. perf-001: #154 confirmed 2026-10-24 (FB on / → CDN, 0 home renders; home renders without smoke 276 → 113 / 12 h) — left: Roi reads the Vercel usage chart (CLI can't on Hobby). analytics-001 — left: Roi compares Oct 26–28 GSC site totals (676/17, 589/39, 489/31) with the Search Console UI + the Gmail re-check; then close it. Optional: post the cat-treats article (pubmed-42908201, position 2.1, never posted); Google landings leave after ~12 s. Revisit ~2026-10-26 (Roi, 2026-10-23: leave it for now): the Chinese fleet came back 10-20 from Chinese ISP addresses (mostly Hangzhou) after the Tencent firewall block — 17–39 views/day 10-20..22, 1 view per IP, Chrome 148–150 + iPhone, article pages, no referrer, flat over 24 h — untagged (086 was a one-off backfill; live tagging = hosting ranges only), so Admin → Analytics counts them as people; 10-23 nearly none. Options: live fleet tagging + re-tag 10-20.. (recommended), firewall challenge for CN, or nothing. 12 h check done 2026-10-23: #152 + #153 confirmed (function requests −25%; remaining home renders = our smoke + crawlers → perf-001). Done 2026-10-22: #152, #153; /auth/v1/user = 1 per load; /article/null = outside traffic; search-batch 400s = our own smoke; Chrome "503"s = cancelled fetches. CI Node 20 upgrade is Roi's call; perf-001 monitoring
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

### Session 20261124-1311-claude-ff52 · 2026-11-24 · Claude Code · growth-006 (merged)
- Goal: Roi — "use the insights we gained from the analytics to implement changes to the recommendation engine as well
  in the trial"; read-only pull "yes, go ahead".
- Completed: analysis (39 posted articles Oct 13 – Nov 23: no practice/talk/wow score predicts social visits, engaged
  visits, WhatsApp or LinkedIn; median 2 social visitors / 72 h; LinkedIn links ~0 visits; across 1,219 scored
  articles scores weakly track Google/organic reading, rho +0.11..+0.15). Roi: no ranking change, "logging only",
  then the simplified plan "A". #164 → ef3f150: migration 091 growth_trial_posts.pick_source; the 🧪 tab sends how the
  day's article was chosen (bound to that article id); the mark route writes it after record_trial_post() commits
  (5 s, never fails a recorded post); results list `picks` per day. Ranking / auto-pick / Daily Posts unchanged.
- Start state: main 2747150; branch feat/growth-006-trial-pick-source.
- Verification: init.sh check (tsc, lint ratchet, unit, audits) + build; 091 pushed on Roi's "push"; schema snapshot
  07c9b9f (+12 facts); PR smoke run 45458782580 pass; replay old/new pass; production /api/version = ef3f150.
- Review: Codex · tier 2 · plan 3 rounds (54k–66k each; r1–r2 BLOCKING → simplified → none) · code 2 rounds
  (r1 BLOCKING throwing reporter → fixed 68a896f; r2 none).
- Commits / PR: #164 merged by Roi ("merge").
- Pending Roi approvals: none for growth-006. KeepUp / pstack (other repo): Roi to pick emulator-only vs phones and
  the skill's language before /pstack:create-verification-skill (run it from ~/Documents/family-app).
- Known risks / unresolved: provenance is client-reported; a failed pick write stays NULL ('not recorded'); positions
  are inferred from growth_recommendation_sets in January (no set id stored).
- Lesson: a 'logging only' request grew into a race-prone snapshot design over two review rounds — when the data the
  question needs already exists (scores, recommendation logs), log only what's missing.
- Next best step: Dec 1 — first trial day; check one trial row has pick_source. Overdue: analytics-001 bot-surge check.

### Session 20261124-0702-claude-166c · 2026-11-24 · Claude Code · analytics-002 (merged)
- Goal: analytics-002 — LinkedIn per-post rows dropping to a quiet week's numbers (stored 4 impressions, LinkedIn
  9,375). Roi: "next"; also "merge 162 if green" (seo-002 merged as d687760).
- Completed: #163 → 2747150. Migration 090: four nullable range columns + apply_linkedin_post_metrics() (service_role
  only) — per metric keeps the higher of the row's CURRENT value and the export's, inside one UPDATE, with the export
  range; never touches article_id / match_method. lib/linkedin/postMetrics.ts (exportPeriod, mergeMetric,
  undercountReason); upload route writes existing rows only through the RPC; manual edit = all-time (post date →
  today); admin table shows ranges + ⚠ undercount, Eng% n/a when ranges differ; insights prompt calls the numbers
  lower bounds. Rule written into app/api/CLAUDE.md + supabase/CLAUDE.md.
- Start state: main d687760; branch fix/analytics-002-linkedin-post-periods.
- Verification: unit 5/5 + build green; 090 pushed on Roi's "push"; schema snapshot 60083fb; audits PASS; PR smoke
  run 45367834492 pass; replay old/new pass; production /api/version = 2747150, health check success.
- Review: Codex · tier 2 · 3 rounds · r1 BLOCKING race (fixed: compare in SQL), r2 BLOCKING schema.json (fixed:
  post-push snapshot), r3 BLOCKING: none, NB: none.
- Commits / PR: #163 merged by Roi ("merge").
- Pending Roi approvals: optional rolled-back production test of apply_linkedin_post_metrics ("test ok").
- Known risks / unresolved: rows written before 090 have unknown ranges (⚠) until a later export raises them; the
  existing 4-impression row stays until re-typed by hand or a bigger export arrives.
- Lesson: Roi said the higher-only rule was agreed in an earlier PR — nothing recorded it, so it was never built. A
  rule agreed in chat goes into the CLAUDE.md files in the same PR. Also: after launching a review in Terminal, check
  its .out file exists — round 3 sat unlaunched for ~2 h.
- Next best step: Roi re-types the 2026-06-11 post's impressions (9,375) in Admin → Analytics; then the overdue
  analytics-001 bot-surge check.

### Session 20261123-2026-claude-b570 · 2026-11-23 · Claude Code · seo-002 (passing, PR #162 awaiting merge)
- Goal: seo-002 — Google landings: related articles + inline save on article pages. ux-001 closed first (Roi: "close
  it") — removed from the backlog.
- Completed: lib/articles/related.ts (specific labels weigh 3, broad 1; 4 results, moved from the side rail to
  "Keep reading" in the reading column); components/articles/InlineSave.tsx under the clinical bottom line; save-intent
  events carry placement 'inline' | 'appbar', kept through sign-in via the return URL.
- Start state: main c2334c8. Data: 710 signed-out Google article landings in 40 days, 71% desktop, 2% opened a 2nd
  page, 14% >= 30 s.
- Verification: init.sh check GREEN @5ae2438; PR smoke run 45262656835 pass; local dev at desktop + 390 px.
- Review: Codex · tier 1 · 1 round · BLOCKING: none (NB 1 fixed in 5ae2438).
- Commits / PR: #162 (open, ready; awaiting Roi's "merge").
- Pending Roi approvals: merge #162.
- Known risks / unresolved: no interaction tests for the inline button (Codex NB 2).
- Lesson: `next dev` rewrites AGENTS.md with a block asking agents to commit it — revert it, never commit it.
- Next best step: merge #162 on Roi's word; analytics-002.

### Session 20261123-1607-claude-d1c7 · 2026-11-23 · Claude Code · ux-001 (stopped — premise wrong)
- Goal: ux-001 (mobile signup "Passwords do not match"), from Roi's "let's fix Outside Growth OS small fixes".
- Completed: nothing built. app/signup/page.tsx already has a show-passwords toggle and a live mismatch hint (#140,
  2026-10-19). The 5 errors in the 11-22 report are one phone on 2026-10-12 (13:07–13:29 UTC), before that fix; no
  signup_error since. The report presented them as a current problem — corrected to Roi.
- Start state: main c2334c8; branch fix/ux-001-mobile-signup created, no commits.
- Verification: production analytics_events export (rep/analytics_events.json): signup_error 2026-08 ×3, 2026-10 ×5
  (all 10-12), none after; signup_step_viewed/completed Nov 41/8.
- Review: n/a (no change).
- Commits / PR: none.
- Pending Roi approvals: close ux-001, or keep only the Google sign-up + pending save check; go-ahead for seo-002.
- Known risks / unresolved: none new.
- Lesson: before building a fix from a report finding, check the finding's dates against what has shipped since.
- Next best step: Roi's call on ux-001; then seo-002.

### Session 20261123-1151-claude-3a7d · 2026-11-23 · Claude Code · growth-005 (merged)
- Goal: Roi — a month-long trial "another tab like synthesis test and leave the growth OS as it is now … through the
  month of December … dedicated analytics … A/B testing against the data we've already collected"; "go ahead".
- Completed: #161 → c2334c8. Growth OS → 🧪 December Trial (TrialTab.tsx, DailyPosts mode="trial"); lib/growth/trial.ts
  (no X; WhatsApp + Telegram Sun/Mon/Tue/Thu; week-balanced pre-assigned splits: LinkedIn link in post vs first
  comment, WhatsApp short vs current; utm_campaign tokens trial-YYYYMMDD / intl-trial-YYYYMMDD); trial prompts with a
  repetition guard (the panel's recentPosts was never read); migration 089 growth_trial_posts + record_trial_post()
  (approval + trial row, one transaction, one article per Israel day) + record_trial_linkedin_metric() + trial_variant();
  /api/growth/feedback refuses 'approved' Dec 1–31; results (lib/growth/trialAnalysis.ts) final 2027-01-08;
  usePageTracking replaces all four UTMs on a tagged arrival (site-wide).
- Start state: main 2f17c51, clean; branch feat/growth-005-december-trial.
- Verification: init.sh check (tsc, lint ratchet, unit PASS; acl/rls GONE until push — expected); 089 pushed on Roi's
  "push db" (dry run first: 089 only; `--yes` needed in agent mode); schema-snapshot 5019 facts; acl / rls / schema
  audits PASS; rpc trial_variant 3/3; PR suite 45210059689 green on 70647c1; production /api/version = c2334c8,
  post-deploy health check success; trial routes 401 signed out. Not exercised in a browser yet.
- Review: Codex · tier 2 · plan 3 rounds (9 → 4 → 0 blocking) · code 4 rounds (5 → 1 → 1 → 0; round 4 authorised by
  Roi past the cap) · ~70k / 36k / 21k + 101k / 40k / 30k / 36k tokens · BLOCKING: none.
- Commits / PR: #161 (Roi: "merge").
- Pending Roi approvals: optional production preview of the trial tab (4 paid generates) before Dec 1.
- Known risks / unresolved: `next build` hits the SecurityFatalError nudge about half the time (retry passes) — the
  16.4.3 → 16.4.5 bump would end it (Roi's call). Bot-surge re-check (11-18) still overdue.
- Lesson: `supabase db push` in agent mode refuses without `--yes` (HostedMutationConsentRequiredError) — rerun with
  --yes only on Roi's explicit word. Harness audits outside init.sh need `node --env-file-if-exists=.env.local`.
- Next best step: Dec 1 — Roi posts from 🧪 December Trial; Mondays: 7-day LinkedIn export + the to-record list. Then
  ux-001, seo-002, analytics-002.
