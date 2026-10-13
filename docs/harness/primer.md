# Vetree — Current State (primer.md)

The maintained progress log of the session harness. Read at the start of every working session
(Current State + the latest entry in Recent Sessions); updated at the end of every session.
Routine: `docs/harness/README.md` on `main`. Pre-harness primer (frozen): root `primer.md` on
`main`, or `git show 16c25da:primer.md`.

---

## 1. Current Verified State
*Updated 2026-10-13 — Session 20261013-0829-claude-fb5e (social-002 closed)*

- **Repo root:** `~/dev/vetree` · state worktree: `.harness-state/` (branch `harness-state`)
- **main:** `cba7324` (#131 Facebook IL closing lines: typeable address + WhatsApp Community, 2026-10-13; #129 + #130 Facebook IL link-free posts, vetree.app/il, "save it" hint, 2026-10-13; #127 schema audit + #128 replay safety, migrations 080–082 + 000 recorded, 2026-10-12; #126 unlock log guard, 2026-10-12; PRs #120–#125 least privilege + policy audit, migrations 075–079 applied, 2026-10-11; #119 lint cleanup, 2026-10-10; #118 build warnings / middleware → proxy, 2026-10-10; #117 init.sh lock / unlock, 2026-10-10; #116 "new this week" count, 2026-10-10; #115 shorter digest footer, 2026-10-09; #114 Search Console fixes, 2026-10-07; before it #113 access-control audit,
  migration 074 applied) — last verified: production /api/version = cba7324, home 200; PR #131 smoke + replay new / old PASS
- **Standard startup:** `docs/harness/init.sh` (state, then check) — see README for exit codes. Take / release
  the lock only with `init.sh lock <item> --agent …` / `init.sh unlock "<message>"` (D12), never by hand
- **Standard verification:** `docs/harness/init.sh check [--item <id>]`; build reads production
  Supabase (read-only); never Playwright as a baseline
- **Highest-priority unfinished item:** **growth-002** (Roi 2026-10-13: redesign Growth OS for the real daily flow — one
  article to every platform via Generate All, rotation deprecated — plus Codex's open test suggestions; plan first, rule
  14 for CampaignCalendar.tsx). feed-002 / admin-001 / scripts-001 need Roi's decisions; ai-001 parked (~2026-11-01).
- **The daily posting flow (Roi, 2026-10-13):** every day ONE article is posted to EVERY platform (Generate All). The 90-day
  rotation is deprecated; a growth_agent_memory row's `platform` is the rotation's label, not where Roi posted (CLAUDE.md
  "Campaign Calendar").
- **Current blocker:** none
- **Open PRs awaiting Roi:** none · Roi: generate a fresh Facebook IL post (new ending), "Copy & mark posted" before publishing, tap vetree.app/il; is
  facebook_intl link-limited too? · the 4 dropped indexes stay dropped (Roi 2026-10-13) · check Vercel usage
  ~2026-10-14 (proxy now a Node function, build-001) · Thursday's security scan is the first after 079

## 2. Open Issues & Known Risks
- **Lint is red on main:** 117 errors (103 no-explicit-any, 13 set-state-in-effect, 1 immutability) / 68 warnings,
  never run in CI. Handled by the lint ratchet (`docs/harness/lint-baseline.json`, per file + rule); only new errors
  fail. Scope narrowed in lint-001 (design prototype ignored; require() allowed in CommonJS scripts).
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

### Session 20261013-0829-claude-fb5e · 2026-10-13 · Claude Code · social-002 (closed)
- Goal / Completed: Facebook IL posts now work from a reader's feed. Every facebook_il post ends with two lines the app
  appends (the model stops at the 📄 title): `📲 … vetree . app/il …` — a typeable address Facebook doesn't detect, plus
  the Page button as fallback — and `💬 …` with the Vetree WhatsApp Community invite link, the only link left in the post.
  `makeLinkFree` drops copied / old / reworded closing lines (judged on text without links), keeps clinical text and the
  title line, strips every other link. Roi's composer tests: the WhatsApp link and the spaced address show no counter;
  `vetree.app/il` does.
- Start state: main 4cf3963, branch fix/social-002-feed-reachable, clean; baseline init.sh check GREEN.
- Verification: offline 44/44; init.sh check GREEN on each head; PR smoke + replay new / old pass; production cba7324,
  home 200.
- Review: Codex · tier 2 · 3 rounds · 35.3k / 21.4k / 32.2k ≈ 89k · BLOCKING: none (fixed on the way: exact-match-only
  ending removal, clinical text deleted with a link — twice, the URL's own "whatsapp" counted as a mention; found myself:
  short title line and "E.coli in cats" dropped).
- Commits / PR: cd73b97, 2796a66, 4161229 → #131, merged as cba7324 on Roi's word.
- Pending Roi approvals: none. Roi: generate a fresh Facebook IL post (earlier ones have the old 👆 ending); "Copy & mark
  posted" before publishing; is facebook_intl link-limited too? Thursday's security scan; Vercel usage ~2026-10-14.
- Known risks / unresolved: the Facebook rules come from secondary reports and Roi's composer tests, not Meta's docs —
  Meta may change detection. generate-post/route.ts now has 3 changes in 7 days (rule 14 for the next).
- Lesson: a heuristic that deletes whole lines must read its evidence from the text, not from what it is about to
  remove (the invite URL itself says "whatsapp"); test the short cases, where word-count rules bite.
- Next best step: growth-002 (Growth OS redesign for the daily all-platforms flow) — plan first, rule 14, Roi approves.

### Session 20261013-0828-claude-62c4 · 2026-10-13 · Claude Code · backlog (social-002 added)
- Goal / Completed: Roi found that in a reader's feed the Facebook IL post's "the link is in the button at the top of
  the page" means nothing. Read secondary reports (not Meta's own pages): comment links now count; links to Meta apps
  (WhatsApp) don't; extra links may show as plain text. Roi's composer test: a WhatsApp link shows no link counter,
  vetree.app/il does. Roi chose A (a typeable address Facebook doesn't detect) + C (keep the Page button) + a link to
  the Vetree WhatsApp Community. Added social-002 (priority 1).
- Start state: main 4cf3963, clean; lock free.
- Verification: n/a (state only) · Review: n/a (exception 1) · Commits / PR: state only.
- Pending Roi: which address form shows no counter ('vetree . app/il', 'vetree(.)app/il', 'vetree נקודה app/il').
- Next best step: social-002 (lock it, build, Codex tier 2).

### Session 20261012-1839-claude-df86 · 2026-10-12 → 2026-10-13 · Claude Code · social-001 (closed)
- Goal / Completed: Facebook lets some business / creator Pages attach only 2 external links a month; the Facebook IL
  Page posts daily. Roi chose design A: facebook_il posts carry no link (prompt + `lib/growth/linkFree.ts` strips any URL /
  bare domain, keeps organism names like E.coli) and end with a line pointing at the Page button; the button (set by Roi)
  → `vetree.app/il` (`app/il/route.ts`, no-store 307 to today's article, UTM utm_content=page-button, home on any
  problem); readers arriving that way get a 15-s handwritten "save it" hint with sun rays at the Save button
  (`components/articles/SaveHint.tsx`, preview artifact for Roi); the Facebook IL tab in Generate All now "Copy & mark
  posted" (one approval row per post, shared guard). Roi then made the daily flow explicit: **every day ONE article to
  EVERY platform via Generate All; the 90-day rotation is deprecated** → #130: /il takes the newest approved row with an
  article on any platform; CLAUDE.md "Campaign Calendar" rewritten.
- Start state: main 342cacb, branch fix/social-001-facebook-links, clean; baseline init.sh check GREEN.
- Verification: linkFree 23/23 offline; guard simulation (3 clicks → 1 write; failure → retry); Playwright screenshots
  (hint only from the Page button, no overflow, gone ~15 s); init.sh check GREEN on both heads; PR smoke + replay pass on
  both; production e05aae3 then 4cf3963 (/api/version), home 200. Roi tapped /il after #129: a months-old article (rows
  labelled facebook_il only on the rotation's day) → #130. /il after #130 not re-checked by me: the read-only prod query
  for the last posted rows was blocked by auto mode despite Roi's yes; I left it.
- Review: Codex · tier 2 · #129 code 3 rounds 65.9k / 36.8k / 24.9k (+28.1k attempt lost to the ChatGPT usage limit,
  re-run after the reset) · #130 code 2 rounds 46.7k / 30.0k ≈ 232k · BLOCKING: none (fixed on the way: bare domains,
  Facebook IL tab not recorded, limiter outside the fallback, organism names stripped, double approval rows; accepted by
  Roi: Content Agent approvals would move /il — tab unused, documented, growth-002).
- Commits / PR: 66853bc, 5398bf5, 512e549 → #129 merged e05aae3; 77c6333 + e7476a8 → #130 merged 4cf3963 — each on Roi's word.
- Pending Roi approvals: none. Roi: press "Copy & mark posted" once on today's post and tap vetree.app/il (yesterday's
  pubmed-42806282 may never have been saved as posted); is facebook_intl under the same link limit? Thursday's security
  scan; Vercel usage ~2026-10-14. The 4 dropped indexes stay dropped (Roi, 2026-10-13).
- Known risks / unresolved: CampaignCalendar.tsx had 3 fixes in 7 days (rule 14 applies to the next one); records'
  platform label is the rotation's, not where Roi posted; `next dev` rewrites AGENTS.md (restore it, never commit it).
- Lesson: docs can describe a flow the owner abandoned months ago — before building on "how it works", ask how Roi
  actually does it today. A fix that widens a pattern (any bare domain) needs its false-positive cases tested too.
- Next best step: growth-002 (Growth OS redesign for the daily all-platforms flow + Codex's open test suggestions) —
  plan first, rule 14 assessment, Roi approves.

### Session 20261012-0624-claude-d170 · 2026-10-12 · Claude Code · infra-003 (closed)
- Goal / Completed: a database rebuilt from supabase/migrations/ now matches production (Roi chose option B over
  "grants only"). Found locally: 9 public tables in no migration, 004 referencing them first, and under the
  2026-10-30 defaults 29 of 33 objects short (analytics_events: no service_role access at all). PR 1 (#127): migration
  080 harness_schema_report() + schema-audit vs supabase/schema.json (4,293 facts) in init.sh check, PR smoke, daily.
  PR 2 (#128): docs/harness/replay.sh rebuilds on the pinned supabase/postgres:17.6.1.063 (--network none) under new
  AND old default privileges and runs all three audits; gates the required smoke check; daily with Slack. 000 (pg_trgm,
  15 dashboard-era tables, one dashboard function — never run on production), 081 (24 additive service_role grants),
  082 (guarded reconciliation: RLS + 7 policies on 8 tables, 3 constraints, 4 dropped indexes, a dropped CHECK and
  NOT NULL — nothing runs on production).
- Start state: main a652c31, branch chore/infra-003-replay-grants, clean; baseline init.sh check GREEN.
- Verification: replay PASS both modes (acl 33/33, rls 32 / 40, schema 3,954 facts; default privileges by an exact
  rule); self-check 11 planted changes caught + atomic 081; a deliberately wrong migration failed both replays and the
  smoke gate; schema selftest 86 fixtures, planted bugs caught (12 + 4); 080 tested on the PG17 image; lock selftest
  251/251 (bash 3.2 + 5.2). Production (Roi's yes each): 080 pushed (auto mode blocked the first try; Roi: "try again"),
  snapshot 0 secret-shaped values; migration repair 000; dry run only 081 + 082; push; all three audits identical
  before / after; nothing pending. Post-merge on main: replay new + old PASS, audits PASS; production 342cacb.
- Review: Codex · tier 2 · plan 3 rounds 48.2k / 33.1k / 23.2k · PR 1 code 3 rounds 66.5k / 62.1k / 50.1k (+3.1k empty
  run, my runner bug) · PR 2 code 2 rounds 92.1k / 35.3k (one attempt hit the ChatGPT usage limit, re-run after reset)
  ≈ 414k · BLOCKING: none (fixed on the way: secret-shaped names, ambiguous keys, membership options, publications,
  inventory, extension-owned dependents, dotted names, inexact default-privilege rule).
- Commits / PR: #127 → d13bbac, #128 → 342cacb, each merged on Roi's word. Migrations 080, 081, 082 pushed; 000
  recorded as applied.
- Pending Roi approvals: none. Roi decides: restore the 4 indexes production lost (idx_articles_needs_enrichment;
  idx_growth_tasks_date / _status / _day)? Thursday's security scan; Vercel usage ~2026-10-14.
- Known risks / unresolved: storage and auth's shape are listed replay gaps (stand-in / existence check only). The
  Supabase image segfaults on `GRANT <role> TO CURRENT_USER` as postgres (test setup moved to supabase_admin).
- Lesson: only a rebuild shows what the dashboard changed — 9 tables, a function, RLS + policies, constraints and
  dropped indexes that no audit of production alone could reveal. The image's init runs a socket-only temporary
  server: wait for loopback before setup. A mutation test only proves what it touches: check grants by content, not
  by presence.
- Next best step: social-001 (Facebook link limit vs the daily Facebook IL post — design is Roi's call); feed-002 /
  admin-001 / scripts-001 need Roi's decisions.

### Session 20261011-1725-claude-656c · 2026-10-11 → 2026-10-12 · Claude Code · harness-004 (closed)
- Goal / Completed: `init.sh unlock` now publishes session-log.md only if it is origin's log, byte for byte, with this
  session's entry in the appended text (`harness.mjs log-grew`: exit 1 = shrunk / not grown / earlier byte changed /
  entry not in the appended part, exit 2 = could not check; prints sizes and offsets only). Refused → NOT published,
  lock still held, with restore instructions. README: a deliberate fix of an old entry needs Roi's OK and its own
  state commit.
- Start state: main 5545ab5, branch chore/harness-004-unlock-log-guard, clean.
- Verification: lock selftest 244/244 on bash 3.2 + 5.3 (before b2053fb), the new cases 73/73 after it, 251/251 in PR
  CI (bash 5.2); 16 new cases (truncated, one byte edited, line deleted, reordered, same length, LF↔CRLF, BOM removed,
  entry only in the old part; passes with exact published bytes incl. CRLF + BOM + invalid UTF-8, origin
  fast-forward, edit while paused, fix and re-run); with the check disabled 10 cases fail. PR smoke pass; post-merge
  smoke pass; production a652c31. This release is the first under the new rule.
- Review: Codex · tier 2 · plan 1 round 43.6k + code 2 rounds 56.3k / 48.2k ≈ 148k · BLOCKING: none (3 non-blocking
  fixed in b2053fb: the no-log case didn't reach the new guard — documented, check_dirty refuses first; two passing
  cases lacked byte comparisons; BOM-removal refusal added).
- Commits / PR: 32bfcc5, b2053fb → #126, merged as a652c31 on Roi's word.
- Pending Roi approvals: none. Roi: Thursday's security scan (first after 079); Vercel usage ~2026-10-14.
- Lesson: a mutation test only proves what its fixtures reach — a case can pass because an earlier check refuses
  first (the "same length" case first stopped at the old entry grep); put the precondition on origin so only the
  new check can refuse.
- Next best step: infra-003 (replay safety); feed-002 / admin-001 / scripts-001 need Roi's decisions.
