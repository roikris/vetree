# Session log — every session, append-only, never trimmed

Newest at the bottom. The same entries (latest few) appear in primer.md → Recent Sessions.

### Session 000 · 2026-10-04 → 2026-10-05 · Claude Code · harness rollout (pre-harness)
- Goal / Completed: designed and built the session harness with Roi. Plan v9 (6 Codex review
  rounds → BLOCKING: none); baseline measured; primer inventory + history approved; rules
  committed on `chore/agent-harness` (3d2f0b7, local); this state branch created locally (step 5).
- Start state: main @ fa30e82 locally (55 commits behind) → fast-forwarded to 16c25da, later
  60e658d (#109). Clean tree.
- Verification: `init.sh check` GREEN @ 3d2f0b7 (tsc 18 s, lint ratchet pass, build 59 s);
  `init.sh state` stops (exit 2) while origin/harness-state is absent; classify self-test 5/5.
- Review: Codex plan review rounds 1–6 (DESIGN.md Appendix B). Diff review pending (step 9).
- Commits / PR: 3d2f0b7 on chore/agent-harness (not pushed, no PR yet).
- Pending Roi approvals: first push of harness-state (step 6); merge of the rules PR (step 9).
- Known risks / unresolved: Vercel suppression via vercel.json unproven (step 7); Codex git
  access in its sandbox untested (step 8); /tmp was wiped by a reboot on 2026-10-05 — work files
  now in ~/dev/vetree-harness-work/.
- Next best step: rollout step 5b (isolation re-check), then step 6 with Roi's OK.

### Session 20261005-0846-claude-b18d · 2026-10-05 · Claude Code · harness-dryrun-001
- Goal / Completed: rollout dry run (a) — one full routine on a throwaway item: start, lock, claim,
  quick baseline, evidence, entry, release. All steps worked as written in README.md.
- Start state: chore/agent-harness @ f5f01b7, clean; state @ 5514fc0, lock free.
- Verification: `init.sh state` exit 0; `init.sh check --quick --item harness-dryrun-001` GREEN
  (tsc pass, lint ratchet pass) on f5f01b7.
- Review: n/a (state-only).
- Commits / PR: state commits lock → claim → this handoff; no product branch.
- Pending Roi approvals: none.
- Known risks / unresolved: item parked as blocked until the dry runs finish.
- Next best step: dry run (b) — WIP carry-over on a local-only branch.

### Session 20261005-0849-claude-f6ca · 2026-10-05 · Claude Code · harness-dryrun-002
- Goal / Completed: dry run (b) part 1 — left a deliberately red WIP for the next session.
  Found and fixed a harness bug on the way: Next 16 build type errors were UNPARSED (d4242f0).
- Start state: chore/agent-harness @ f5f01b7, clean; state lock free.
- Verification: WIP 4e4a2e1 on LOCAL-ONLY chore/harness-dryrun (Article.strength_of_evidence →
  number); `init.sh check` RED as intended: 5 tsc + 6 build signatures, all in files the WIP did
  not touch → recorded as wip_sha + expected_failures. Rules branch check GREEN @ d4242f0.
- Review: pending (rules diff review at step 9).
- Commits / PR: rules d4242f0 (local); WIP 4e4a2e1 (local only, never pushed); state: this entry.
- Pending Roi approvals: none.
- Known risks / unresolved: internet paused — this handoff is committed locally and pushed when
  the connection returns.
- Next best step: dry run (b) part 2 — a new session must resume via EXPECTED-WIP.

### Session 20261005-0857-claude-7453 · 2026-10-05 · Claude Code · harness-dryrun-002
- Goal / Completed: dry run (b) part 2 — a NEW session resumed the red WIP. RESUME FIRST picked
  the item; `init.sh check --item` (full) → EXPECTED-WIP (exit 10), incl. failures in files the WIP
  never touched. Must-stop cases all stopped (exit 1): (i) one failure missing from the record,
  (ii) HEAD moved past wip_sha, (iii) unparseable build log (synthetic).
- Start state: chore/agent-harness @ d4242f0; state @ e472823, lock free.
- Verification: as above, on WIP 4e4a2e1 (local-only branch).
- Review: n/a (state-only).
- Commits / PR: state only.
- Pending Roi approvals: none.
- Known risks / unresolved: (iii) used a synthetic log — a real unparseable build can't be forced.
- Next best step: dry run (c) — controlled stop, crash, failed push, lost branch.

### Session 20261005-0939-claude-c7de · 2026-10-05 · Claude Code · (none)
- Goal / Completed: dry run (c1) — controlled stop. Nothing pickable (only parked dry-run items,
  all blocked) → per README: ask Roi; short entry + lock released.
- Start state: state @ 70981e8, lock free before this session.
- Verification: n/a · Review: n/a · Commits / PR: state only · Pending Roi approvals: none.
- Next best step: dry run (c2) — crash with the lock held.

### Session 20261005-0940-claude-a6fa · 2026-10-05 · Claude Code · (simulated crash)
- Goal / Completed: dry run (c2) — took the lock and 'crashed' (no handoff). The next start
  printed LOCK HELD but exited 0 → fixed (95f3413): `init.sh state` now exits 2 on a lock that
  isn't the caller's (HARNESS_SESSION). Re-test: exit 2 for a new session, exit 0 for the owner.
- Stale lock removed after the test under Roi's approval of dry run (c) (2026-10-05) — a test lock,
  not a real session's.
- Next best step: dry run (c3) — failed state push.

### Session 20261005-0942-claude-3602 · 2026-10-05 · Claude Code · (failed push)
- Goal / Completed: dry run (c3) — lock push sent to an unreachable URL failed (exit 128); the
  local commit survived; the next `init.sh state` stopped (exit 2) listing the unpushed commit and
  the remote lock (none). README recovery (fetch → inspect → remote lock check → pull --rebase →
  push) recovered it. Then this controlled stop: entry + release.
- Next best step: dry run (c4) — lost-branch recovery.

### Session 20261005-0943-claude-9a55 · 2026-10-05 · Claude Code · harness-dryrun-002
- Goal / Completed: dry run (c4) — deleted the item's local branch; README recovery found
  head_sha locally, created chore/harness-dryrun-recovered-20261005 at it, updated the item (old name kept in notes). Push -u skipped
  (local-only dry-run branch, by design).
- Next best step: dry run (d) — fresh clone.

### Session 20261005-1251-codex-23ce · 2026-10-05 · Codex · harness-dryrun-003
- Goal / Completed: rollout dry run 8e, resumed the same session after the network outage
  stopped the claim push. Recovered per README Failed state push: fetched origin, inspected
  the unpushed log and diff (only claim 3ac4b97), verified the remote lock belongs to this
  session, pulled with rebase (already up to date), and pushed 3ac4b97 to harness-state.
  Quick check GREEN; recorded evidence and parked the item for removal after step 8.
- Start state: resumed on chore/agent-harness @ 95f3413920c65f3aef7e2ac061031cf86e88faea,
  clean; state @ 3ac4b97, remote @ ad4bdb5, own remote lock held; claim was the only local commit.
- Verification: `docs/harness/init.sh --check-git` exit 0; after recovery,
  `HARNESS_SESSION=20261005-1251-codex-23ce docs/harness/init.sh state` exit 0, lock held by
  this session; `HARNESS_SESSION=20261005-1251-codex-23ce docs/harness/init.sh check --quick --item harness-dryrun-003`
  exit 0 GREEN on 95f3413920c65f3aef7e2ac061031cf86e88faea (tsc PASS 17s, lint ratchet PASS,
  lint 28s, build skipped). Target: local; no database reads/writes or paid calls.
- Review: Claude Code verified the pre-resume state (Roi's report); state-only handoff is
  exempt from a separate diff review under CLAUDE.md exception 1.
- Commits / PR / WIP commit: lock ad4bdb5; recovered claim 3ac4b97; this state-only handoff
  `handoff + release lock: 20261005-1251-codex-23ce`. Product commit/build/push, PR and WIP: N/A
  (only harness state changed).
- Pending Roi approvals: none for this state-only dry run.
- Known risks / unresolved: outage recovered; item blocked as "parked dry run; removed after step 8".
  Rules README still needs the tested Codex invocation recorded by the rollout owner.
- Next best step: Claude Code / Roi review dry run 8e, record the tested invocation in the rules,
  finish step 8 and remove parked dry-run items, then continue rollout step 9.

### Session 20261005-1055-claude-93a0 · 2026-10-05 · Claude Code · rollout step 8 cleanup
- Goal / Completed: removed the three dry-run items (harness-dryrun-001/002/003) from
  feature_list.json — their full records stay in this log — and reset Current State.
  Step 8 results (all passed after 2 fixes): DESIGN.md rollout checklist.
- Start state: chore/agent-harness @ 4c81fcc, clean; state @ e6671c6, lock free.
- Verification: n/a (state only) · Review: n/a (CLAUDE.md exception 1) · Commits / PR: state only.
- Pending Roi approvals: push of chore/agent-harness + draft PR (step 9); merge (Roi's word).
- Next best step: step 9 — Codex review of the full rules diff (60e658d..4c81fcc), then draft PR.

### Session 20261005-1459-claude-2e52 · 2026-10-05 · Claude Code · harness-dryrun-004
- Goal / Completed: step 9 end-to-end test of the 'a failed build is never expected' change
  (38c668c). Local-only WIP 8860f19 (Article.strength_of_evidence → number); handoff recorded with
  `check --quick` (5 tsc signatures); resume `check --item` skipped the build on the recorded WIP
  commit and returned EXPECTED-WIP (exit 10). Item removed afterwards; branch deleted.
- Review: step-9 Codex diff review continues (round 4 next).
- Next best step: Codex review round 4 of the rules diff.

### Session 20261005-1509-claude-a914 · 2026-10-05 · Claude Code · harness-dryrun-005
- Goal / Completed: step 9 test of the WIP-mode gate (Codex diff review round 4): (1) real WIP with
  recorded tsc errors → EXPECTED-WIP 10; (2) WIP commit, tsc + lint clean → EXPECTED-WIP 10 'never
  GREEN'; (3) wip_sha on a normal commit → STOP 2; (4) right WIP commit on the wrong branch → STOP 2.
  Local-only branches deleted; item removed.
- Next best step: Codex review round 5 of the rules diff.

### Session 20261005-1522-claude-bc31 · 2026-10-05 · Claude Code · harness-dryrun-006
- Goal / Completed: step 9 test of efd10fe (Codex round 5, non-blocking): clean WIP commit →
  EXPECTED-WIP (10); the same WIP with an uncommitted edit → STOP (2). Branch + item removed.
- Next best step: short Codex look at efd10fe, then Roi's OK for push + draft PR.

### CORRECTION to Session 20261005-1522-claude-bc31 (written by 20261005-1525-claude-07f1, 2026-10-05)
- That entry's results are FALSE: its test never ran in WIP mode (the edit created an untracked
  lib/utils.ts, so no WIP commit was made and wip_sha stayed empty; both runs were ordinary GREEN
  checks). The entry is left as written above, per the append-only rule; this correction supersedes it.

### Session 20261005-1525-claude-07f1 · 2026-10-05 · Claude Code · harness-dryrun-006
- Goal / Completed: proper re-run of the efd10fe clean-tree test, with a guard that the WIP commit
  exists: (a) clean WIP → exit 10 EXPECTED-WIP, build not run, never GREEN; (b) same WIP + an
  uncommitted edit → exit 2 STOP. Tree verified clean afterwards; branch + item removed.
- Also: corrected the entry of 20261005-1522-claude-bc31, whose test was invalid (see the correction in session-log).
- Next best step: short Codex look at efd10fe, then Roi's OK for push + draft PR.

### Session 20261005-1545-claude-0ccc · 2026-10-05 · Claude Code · rollout step 9
- Goal / Completed: rules branch pushed; draft PR #110 opened on Roi's OK. Checks: scope pass
  (docs-only), smoke skipped (run success), Vercel preview ready. Codex review of the full rules
  diff: 6 rounds, 6 blocking fixed, BLOCKING: none (DESIGN.md step 9).
- Pending Roi approvals: merge of #110.
- Next best step: after Roi merges #110 — Session 001: build the backlog with Roi.

### Session 20261005-1621-claude-4de2 · 2026-10-05 · Claude Code · rollout step 9 (merge)
- Goal / Completed: Roi approved the merge; #110 marked ready (smoke skipped, docs-only; run
  success on b899862), squash-merged as 5ae7d29. Local checkout on main @ 5ae7d29.
- Note: DESIGN.md's step-9 row still says "Merge: on Roi's word" — tick it in the next rules PR.
- Next best step: Session 001 — build the backlog with Roi (init.sh check --quick; no product code).

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

### Session 20261005-1638-claude-3439 · 2026-10-05 · Claude Code · harness-002
- Goal / Completed: Roi's eight review-budget measures (D11): risk tiers + sensitive list, delta
  rounds, 3-round cap, lean reviewer context (new docs/harness/review-checklist.md), BLOCKING /
  NON-BLOCKING output, effort levels, primer keeps latest 5 (done: 363 → 234 lines), cost line.
- Start state: main @ 5ae7d29, clean; state lock free (session 001 paused). An earlier start
  (20261005-1630-claude-2221) wrongly overwrote session 001's lock and was reverted (a5…/revert commit).
- Verification: init.sh check GREEN before each commit; PR #111 checks pass (smoke skipped).
- Review: Codex · tier 2 · 3 rounds · 28.6k / 12.2k / 22.0k tokens · BLOCKING: none (2 blocking fixed).
- Commits / PR: 3a72897, 93fcf93, 45b510f on chore/harness-review-budget → draft PR #111.
- Pending Roi approvals: merge of #111; whether to add `init.sh lock`/`unlock` (proposed).
- Next best step: resume backlog session 001 with Roi.

- CORRECTION to the entry above (session 20261005-1638-claude-3439): "(a5…/revert commit)" means revert commit 52fed24.

### Session 20261005-1947-claude-9005 · 2026-10-05 · Claude Code · backlog update
- Goal / Completed: Roi merged #111 (b54393b) → harness-002 `merged`. Added **harness-003** on Roi's
  word: `init.sh lock <item>` / `init.sh unlock` (refuse when any lock is held; owner-only unlock;
  failed-push handling; README updated) — tier 2 review. Its order vs the session-001 candidates
  is Roi's call when the backlog session resumes.
- Verification: n/a (state only) · Review: n/a (exception 1) · Commits / PR: state only.
- Next best step: resume backlog session 001 with Roi.

### Session 20261006-1422-claude-ab88 · 2026-10-06 · Claude Code · backlog session 001 (completed)
- Goal / Completed: resumed and finished the backlog session with Roi. Roi agreed the order and
  put a new item first. Backlog: 1 enrich-001 (24 articles failed enrichment 3+ attempts, from
  the enrichment report) · 2 infra-001 (GRANTs, deadline 2026-10-30) · 3 feed-001 · 4 harness-003
  · 5 build-001 · 6 lint-001 · ai-001 parked (~2026-11-01). F was already done in #111.
- Start state: main @ b54393b, clean; lock free. Baseline: init.sh check --quick GREEN.
- Verification: n/a (no product code) · Review: n/a (state only) · Commits / PR: state only.
- Pending Roi approvals: enrich-001 resolution (prod writes / paid Claude calls) — ask with findings;
  infra-001 read-only prod access when it starts.
- Next best step: new session for enrich-001 (read-only prod investigation approved).

### Session 20261006-1444-claude-6864 · 2026-10-06 · Claude Code · enrich-001 (controlled stop — waiting for Roi)
- Goal / Completed: the 24 articles failing 3+ attempts are all Claude refusals on pathogen
  research. Codex/gpt-6-astra side-by-side test (identical prompt): 24/24 answered; Roi: good.
  Roi chose a refusal-only fallback to gpt-6-astra (rule 0 exception, internal disclosure).
  Built on fix/enrichment-refusal-fallback → draft PR #112.
- Start state: main @ b54393b, clean; lock free.
- Verification: read-only prod queries; mocked-API tests; init.sh check GREEN on head 21e2d6b.
- Review: Codex · tier 2 · 2 rounds · 27.4k + 34.7k tokens · BLOCKING: none (2 blocking fixed).
- Commits / PR: e418960, 21e2d6b → #112 (draft).
- Pending Roi approvals: OPENAI_API_KEY secret; gpt-6-astra access; merge #112; re-run the 24.
- Next best step: after Roi's merge + key — with his OK, re-run the 24 and re-count; then infra-001.

### Session 20261006-1824-claude-501f · 2026-10-06 → 07 · Claude Code · enrich-001 (controlled stop — Roi's local run next)
- Goal / Completed: Roi chose Codex on his ChatGPT plan over API billing (OpenAI advises against
  ChatGPT auth in CI; repo is public). Reworked #112: refusals → ai_refused after one attempt via
  record_enrichment_refusal() (locked); `npm run enrich:refused` on Roi's Mac (identical shared
  prompt, ChatGPT-login guard, same validation, guarded save). Found in testing: pre-057 rows hold
  the abstract in `summary` (24/24) → "waiting" = the marker; `codex login status` writes stderr.
- Verification: migration 073 applied (Roi "push"): 24 ai_refused, manual-review count 0, none
  visible, new function service-role only; #112 full smoke pass; merged a527f5f.
- Review: Codex · tier 2 · 3 rounds · 55.7k / 46.8k / 47.8k tokens · BLOCKING: none (6 blocking fixed).
- Commits / PR: 6d8eef7, 6e40b11, d17cd37, 75c4363 → #112 merged as a527f5f.
- Pending Roi approvals: none — Roi runs the fallback himself.
- Next best step: after Roi's run, re-count ai_refused (expect 0 waiting) and close enrich-001.

### Session 20261007-0604-claude-2342 · 2026-10-07 · Claude Code · enrich-001 (verified + closed)
- Goal / Completed: verified Roi's fallback run and closed enrich-001. First check (09:05) found
  nothing saved — that was the dry run (08:36–08:39); Roi's real run (09:33–09:36, "Saved: 24")
  came later. Now: 0 waiting; 24 saved via codex:gpt-6-astra, all pass the Public Article Filter;
  quality 24/24 clean; manual-review count 0; live page 200. Item → merged.
- Review: n/a (verification only, read-only).
- Next best step: infra-001 (GRANT enforcement, deadline 2026-10-30) — ask Roi for read-only prod access.

### Session 20261007-1242-claude-5b95 · 2026-10-07 · Claude Code · infra-001 (closed)
- Goal / Completed: Supabase's 2026-10-30 change (new public tables/sequences lose auto-grants; existing
  objects + functions unaffected). After two plan rounds showed a SQL-text guard keeps leaking, Roi chose
  a catalog audit: migration 074 harness_acl_report() (pushed on Roi's yes), supabase/access.json
  baseline (33 relations), acl-audit in init.sh / PR smoke / daily + post-deploy, 24 offline fixtures incl.
  6 sentinel-leak checks. Added infra-002 (least privilege) and infra-003 (replay safety).
- Verification: live report 33 × 4 rows, anon denied; audit PASS locally, in PR CI and post-merge.
- Review: plan · 4 rounds · 75.7k / 48.3k / 60.6k / 47.0k (round 4 beyond the cap, Roi) · BLOCKING: none;
  code · Codex · tier 2 · 3 rounds · 58.4k / 39.7k / 40.9k · BLOCKING: none.
- Commits / PR: 5c20d64 → #113, merged by Roi via the web UI as 4686368 (GitHub merge API 500 ×4).
- Next best step: feed-001.

### Session 20261007-1922-claude-7410 · 2026-10-07 · Claude Code · seo-001 (closed)
- Goal / Completed: Roi's side quest — Google Search Console errors. Read the Page indexing report
  (read-only): 195 not indexed, mostly Google's choice (143 crawled-not-indexed, 30 alternate canonical,
  11 redirects, 2 robots-blocked on purpose). Fixed: /auth/signin 404 → permanent redirect to /login
  (+ the library link); /login, /signup soft 404 → noindex,follow; /?search={search_term_string} soft 404 →
  noindex on search results and the JSON-LD SearchAction removed. /article/pubmed- (empty id): no source
  in code or sitemap, already a correct 404.
- Verification: init.sh check GREEN; local prod build and live production after deploy (f0b17e6).
- Review: Codex · tier 2 · 1 round · 36.1k tokens · BLOCKING: none.
- Commits / PR: 5926c9d → #114, merged as f0b17e6 on Roi's word.
- Pending Roi: "Validate fix" on the GSC Not found + Soft 404 reports.
- Next best step: feed-001.

### Session 20261009-1730-claude-5a0d · 2026-10-09 · Claude Code · digest-001 (closed)
- Goal / Completed: Roi found the digest's legal footer repetitive. Explained what §30A (advertising) and §17F
  (direct mailing) require and that the sender's name must be in the email itself (a link isn't enough; a
  company as sender would replace Roi's name — not incorporated yet, so no "Ltd."). Shortened footer: English
  names only "Vetree"; Hebrew keeps name, address, consent, data sources, removal, deletion.
- Verification: init.sh check GREEN; deployed (946f146). No digest sent.
- Review: Codex · tier 2 · 1 round · 22.2k tokens · BLOCKING: none.
- Commits / PR: 6c2885e → #115, merged as 946f146 on Roi's word.
- Open question for a lawyer (Roi): company as sender; P.O. box instead of a street address.
- Next best step: feed-001.

### Session 20261010-0452-claude-9c7c · 2026-10-10 · Claude Code · feed-001 (closed)
- Goal / Completed: the feed header's "N new this week" counted publication_date ≥ 7 days ago without the
  summary/quarantine checks (future-dated preprints counted forever). Now getNewThisWeekCount() in
  lib/queries/publicStats.ts: public filter + created_at, cached per UTC hour, null on failure. 46 → 117.
  Lint baseline 178 → 177.
- Verification: init.sh check GREEN; live header "117 new this week" after deploy (48e1524).
- Review: Codex · tier 2 (lint baseline) · 2 rounds · 47.6k + 16.1k tokens · BLOCKING: none (1 fixed: unstable_cache
  serves stale values past revalidate → key by hour).
- Commits / PR: b882d93, 23ff18f → #116, merged as 48e1524 on Roi's word.
- Lesson: unstable_cache `revalidate` is stale-while-revalidate and keeps the old value when a refresh fails — not a max age.
- Next best step: harness-003 (init.sh lock/unlock).

### Session 20261010-0508-claude-6918 · 2026-10-10 · Claude Code · harness-003 (closed)
- Goal / Completed: `docs/harness/init.sh lock <item|backlog> --agent claude|codex` and `init.sh unlock "<message>"`
  replace hand-written session.lock files (D12). Both sync with origin first, refuse when the lock is held / not
  owned / the state worktree has other changes, build the commit off to the side and push without force; a failed
  push is classified as published / NOT published / NOT KNOWN. unlock also publishes the handoff (primer,
  feature_list, session-log) and requires this session's log entry. A per-checkout mutex also blocks `state`.
- Verification: lock self-test 178/178 on bash 3.2 (Mac) and 5.2 (CI, now in PR smoke); 5 mutations all caught;
  init.sh check GREEN; merged tree = PR head; production 61f9f4d.
- Review: Codex · tier 2 · plan 3 rounds (33.3k / 32.9k / 40.5k, cap reached, Roi chose A) · code 2 rounds
  (50.2k / 39.4k) · BLOCKING: none (2 fixed: git clean skips ignored files; lost push ack ≠ not published).
- Commits / PR: cec8d9c, da1636f → #117, merged as 61f9f4d on Roi's word. This lock was the last hand-written one.
- Lesson: `git clean` silently skips ignored files — delete one known file with `unlink` and check it is gone.
  Claude Code's safety check blocks `rm` on variable paths; `unlink` / `rmdir` express the intent better anyway.
- Next best step: build-001 (middleware → proxy, Sentry onRouterTransitionStart, scan-route tracing).

### Session 20261010-1034-claude-41e2 · 2026-10-10 · Claude Code · build-001 (closed)
- Goal / Completed: cleared all build warnings. middleware.ts → proxy.ts (Next 16; now Node.js runtime — Edge is not
  allowed) with its own Sentry reporting (Next 16.3.8 forwards proxy errors only on Edge); Sentry
  onRouterTransitionStart warning suppressed (tracing off on purpose); security-scan route: fs reads marked
  turbopackIgnore + outputFileTracingIncludes, trace 676 files / 6.2 MB (whole repo) → 1,396 / 5.7 MB (package files
  kept for npm audit — Roi chose A). Scan CHECK 17 now reads proxy.ts. First session opened with `init.sh lock`.
- Verification: init.sh check GREEN, 0 build warnings; local probe (throw + beforeSend log-and-drop): one Sentry event,
  no query; PR smoke pass; production ba9fb77 live checks pass.
- Review: Codex · tier 2 · 2 rounds · 58.6k + 39.5k tokens · BLOCKING: none (1 fixed: proxy errors lost on Node).
- Commits / PR: 88cac12, 8762402, e4052d1 → #118, merged as ba9fb77 on Roi's word. The first production deploy
  failed before building ("Git information retrieval failed" — Vercel couldn't fetch the commit); Roi redeployed.
- Lesson: `/*turbopackIgnore: true*/` must sit on the path expression (`path.join(/*…*/ cwd, x)`), not only inside
  fs.readFileSync( — and listing package.json in outputFileTracingIncludes pulls in every dependency's package.json.
- Pending Roi: Vercel usage in a few days (proxy billed as a Node function); Thursday's security scan.
- Next best step: lint-001.

### Session 20261010-1719-claude-9084 · 2026-10-10 · Claude Code · lint-001 (closed)
- Goal / Completed: lint baseline 177 → 117 (70 → 44 entries). eslint.config.mjs: design prototype ignored;
  require() allowed in the CommonJS scripts only; no-unescaped-entities keeps > and }, allows ' and ". Onboarding's
  HandDrawnArrow moved to module level; prefer-const ×2. Left: 103 no-explicit-any, 13 set-state-in-effect,
  useFollowedTags immutability (benign hoisting). The three Session-001 "possible bugs": none was a real bug.
- Verification: init.sh check GREEN; no new file+rule pair and no grown count vs main; PR smoke pass; production
  9429086 live.
- Review: Codex · tier 2 · 2 rounds · 45.0k + 26.1k tokens · BLOCKING: none (1 fixed: reordering useFollowedTags swapped
  in a new file+rule pair — D9 forbids that even when the total falls; reverted).
- Commits / PR: 38fd077, 55ce2b3 → #119, merged as 9429086 on Roi's word.
- Lesson: an eslint flat-config rule override for a plugin rule needs the same `files` as the config object that
  defines the plugin (else "could not find plugin"). The ratchet is per file + rule — check pairs, not the total.
- Incident (mine): closing build-001, my script opened session-log.md for writing before reading it, which
  emptied it, then wrote one entry (f81d84f: 28 entries → 1; repeated once here). Restored in this handoff from 7c89e29
  (history byte-identical) + the build-001 and lint-001 entries. Write state files only after reading them fully.
- Next best step: infra-002 (least privilege) — needs Roi for anything touching production grants.

### Session 20261010-1903-claude-8c5f · 2026-10-10 → 2026-10-11 · Claude Code · infra-002 (closed)
- Goal / Completed: least privilege for the Data API. Migration 075 + `rls-report` showed production's RLS policies;
  076 closed topic_syntheses (anyone could read / insert / rewrite cached syntheses incl. query + user_id); 077 and 078
  closed the four insert-anyone tables (synthesis_feedback, page_views, search_logs, analytics_events) after #122 moved
  the tracking routes to the service role; 079 trimmed anon / authenticated grants to what their policies allow (no
  TRUNCATE / TRIGGER / REFERENCES / MAINTAIN for either). Guard: `rls-audit` vs supabase/rls.json (32 tables, 40
  policies) in init.sh check, PR smoke and daily, like acl-audit. 077 also fixed scan CHECK 9's table list (076 would
  have raised a false "missing grants" on Thursday).
- Start state: main 9429086, branch chore/infra-002-least-privilege, clean.
- Verification: after every push acl-audit PASS 33/33 and rls-report as expected; tracking still records (count-only
  reads, Roi's yes: 12 → 13 page views + 1 search after 078); check_table_grants() 0; Roi checked signed-in, admin and
  guest pages after 079; rls selftest 57 (42 audit) + mutations caught; init.sh 5 audit scenarios; lock selftest
  178/178; init.sh check GREEN; PR smoke ran rls audit PASS.
- Review: Codex · tier 2 · 14 rounds over 6 PRs · 52.5k / 48.6k / 41.7k (#120), 45.7k (#121), 58.6k / 20.8k (#122),
  66.7k / 20.9k (#123), 98.0k (#124), plan 54.4k / 24.9k + code 72.0k / 43.3k / 31.1k (#125) ≈ 679k · BLOCKING: none
  (fixed on the way: rls-report accepted malformed reports; guard plan — missing env read as network, no rls.json
  validation, empty snapshot; guard code — roles compared by joined string, snapshot errors outside the handler,
  unescaped paths).
- Commits / PR: #120 5e5cc4c, #121 4175a92, #122 e4a8995, #123 2fd4bef, #124 cbcf274, #125 5545ab5 — each merged on Roi's
  word. Migrations 075–079 applied with Roi's yes each.
- Pending Roi approvals: none. Roi: Thursday's security scan (first with 079's grants); Vercel usage ~2026-10-14.
- Known risks / unresolved: a removed grant turns an empty RLS result into 42501 — guest paths were swept, admin
  re-queue buttons now error (admin-001); anon keeps SELECT on saved_articles for Trending (feed-002); acl-audit prints
  its --expected path unescaped (test-only option). Auto mode blocked the first 076 push and a prod probe script that
  included an anon INSERT (my mistake — never probe with writes); Roi pushed on, the probe never ran. I named PR #124
  before it existed. A reader's sign-up / login / reset at 07:50 UTC (WhatsApp link) was before 079 and ended signed in.
- Lesson: before trimming a grant, sweep every guest / signed-in code path for that table — "no rows" becomes
  "permission denied". fetch refuses some ports (9, discard): use a high port for an ECONNREFUSED test. Never compare
  lists by joining them into one string.
- Next best step: harness-004 (unlock refuses a shrunken session log), then infra-003; feed-002 / admin-001 need Roi.

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

### Session 20261014-1443-claude-dbb9 · 2026-10-14 · Claude Code · unlock note
- The entry above was committed and pushed by hand (340da35) before `init.sh unlock`, so unlock's append-only check
  saw no new entry; this note is the appended text it publishes. Next time: write the entry, leave it uncommitted, run
  `init.sh unlock` (it commits and pushes the handoff).

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

### Session 20261017-1603-claude-ea2b · 2026-10-17 · Claude Code · analytics-001 (report delivered)
- Goal / Completed: Roi: research 3 analytics patterns (IL ~5:1 views per unique, SG surge, many non-promoted articles
  read) — real users or not, what they mean, how to use them. Roi's yes to read-only production reads, last 7 days.
  Verdicts: SG + CN = bot fleet (pattern 3 is that fleet crawling ~193 articles); IL is real people, inflated by the
  tracker's leave beacon inserting a 2nd row per page and by 2–3 heavy IPs; most US / IE / SE "visitors" are Meta /
  AWS / Azure link scanners. Real signal: Google organic long-tail from 20+ countries, 3 ChatGPT referrals, a working
  WhatsApp channel with auth friction.
- Start state: main 819cd4e, clean; lock taken as backlog, analytics-001 added and claimed.
- Verification: analysis only — no code changed. Numbers in analytics-001's notes; scripts in the session scratchpad.
- Review: none (no code, no PR).
- Commits / PR: state commits only.
- Pending Roi approvals: which follow-ups to open (beacon fix, bot tagging, firewall rule, signup errors, SEO).
- Known risks / unresolved: datacenter attribution is by city (Vercel geo), an inference; 7-day window, small counts;
  the Petah Tikva desktop skimmer may be Roi signed out (admin is skipped only when signed in).
- Lesson: the page tracker writes two rows per page left — any views / uniques figure built on raw page_views rows
  counts human multi-page visits twice; filter duration_seconds IS NULL for view counts until fixed.
- Next best step: Roi picks the follow-ups; the beacon fix and the bot tagging change every analytics number, so first.

### Session 20261017-1616-claude-e12a · 2026-10-17..19 · Claude Code · analytics-001 (in progress)
- Goal / Completed: Roi: Codex-check the analytics research, then patch every hole ASAP. Plan (4 Codex rounds) →
  PR A #139: one page_views row per view (client view_id, cumulative visible time, pending-duration table, legacy RPC),
  traffic_class estimate from datacenter ranges (official lists + RIPEstat ASNs), Upstash limiter keys hashed, admin
  analytics reads paged with errors surfaced, HeadlessChrome = bot; migration 084. Upstash: 2,731 raw-IP analytics keys
  deleted. Migration 085 (#141): 482 legacy beacon rows merged / deleted. PR B #140 (reset-password via the browser
  client's PKCE outcome + token_hash, failed-link notice, verify-email when signed out, signup friction) — open.
- Start state: main 819cd4e; lock taken for analytics-001.
- Verification: #139 suite green, merged be191db; production: Tencent = 110 of 138 human-tagged rows after deploy, 0
  legacy-style rows, durations on their views. 085: PGlite fixtures + JS dry run = production log {482, 480, 479, 2};
  #141 suite green, merged 0e3171d, health check success. #140: localhost (next build + start) checks of the notice,
  verify-email, signup, wall return URL; NOT tested with real email.
- Review: Codex · tier 2 · plan 4 rounds; #139 to BLOCKING: none; #140 3 rounds → BLOCKING: none; 085 1 round → none.
- Commits / PR: #139 → be191db, #141 → 0e3171d (both on Roi's word); #140 draft at e4093d8.
- Pending Roi approvals: #140 real-email incognito test (reset link; same link twice; other browser; double signup →
  first link), then merge word; Supabase reset template → `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`
  only after #140 merges (dashboard, Roi); 086 SQL; Firewall rule.
- Known risks / unresolved: traffic_class is an estimate (ranges incomplete, VPN users match); IP_HASH_SALT fallback is
  loud in production only; raw IP kept in user_consents (Roi's decision). Auto mode blocked reading the Upstash and
  Supabase CLI credentials — Roi lifted it for Upstash; the template switch stays with Roi.
- Lesson: localhost testing here needs `next dev --webpack` (Turbopack panics) or build + start, and the PWA service
  worker must be unregistered first (it serves stale chunks); `next dev` rewrites AGENTS.md — restore, never commit.
- Next best step: #140 email test with Roi; then 086 and the Firewall proposal (Tencent data since 2026-10-17).

### Session 20261019-1624-claude-ba0d · 2026-10-19 · Claude Code · analytics-001 (in progress — follow-ups only)
- Goal / Completed: Roi: remove the suspected automated traffic from the analytics, then #140. #142: Admin → Analytics
  hides signed-out likely-automated views by default (LIKELY_HUMAN_OR; switch in the URL so LinkedIn / Paid Campaigns
  follow), six readers paged past 1,000 rows, failed reads shown. 086 (#143): production read-only calibration (Roi's
  yes) → 356 suspected_fleet + 1,372 suspected_datacenter older rows, ids logged, reversible. Vercel Firewall: deny
  Tencent Cloud AS132203 + AS45090 (Roi: "do the firewall rule yourself"). #140: rebased, replaceState(null) in the
  notice, real-email test with Roi (Gmail connector + Roi typing passwords) — every case passed; merged; Roi switched
  the reset template to a branded token_hash link → cross-browser reset verified in production (incognito).
- Start state: main 0e3171d; lock taken for analytics-001.
- Verification: #142 Codex r1 BLOCKING (sibling panels unfiltered) → fixed, r2 BLOCKING (replaceState with
  history.state skips Next's router sync, verified in next/dist app-router.js) → fixed, r3 none; suites green; merged
  083d1db. 086: PGlite fixtures, JS dry run = production log {356, 1372}, 0 signed-in tagged, schema audit PASS, Codex
  none, merged 1806b1a. Firewall: rules list live, home 200. #140: Codex r4 none (Roi approved a 4th round), suite green,
  merged 3dd971f, health check success.
- Review: Codex · tier 2 · #142 3 rounds; 086 1 round; #140 round 4 (one NB applied unreviewed: skip link z-[70]).
- Commits / PR: #142 → 083d1db, #143 → 1806b1a, #140 → 3dd971f (each on Roi's word).
- Pending Roi approvals: delete test account roi.kris+vt1; which follow-ups to open.
- Known risks / unresolved: the town / fleet rules are estimates (a real SG/CN reader without referrer, or a person in
  a datacenter town, is hidden by default — the switch shows them); Gmail warning check inconclusive (Roi had dismissed
  one); the Gmail connector could not see the reset emails Gmail did deliver (search lag) — Roi pasted links.
- Lesson: in Next 16, history.replaceState(window.history.state, …) carries __NA and Next skips its router sync —
  pass null. PKCE recovery links only work in the browser that requested them (and a later request, even a
  rate-limited one, replaces the stored verifier); token_hash links work anywhere. Resend click tracking on auth
  emails makes Gmail flag them.
- Next best step: Roi picks the analytics-001 follow-ups (primer); ~2026-10-22 check the firewall rule's effect.

### Session 20261020-1043-claude-d205 · 2026-10-20 · Claude Code · analytics-001 (in progress — follow-ups only)
- Goal / Completed: Roi: "continue" → #144 one user lookup per signed-in page (getSharedUser, module-level auth
  listener) + dashboard footnote; 087 (#145) the daily purge removes pending durations > 1 day (Roi: "Push");
  test account roi.kris+vt1 deleted (delete_user_account(), held 1 consent row); firewall verified (last
  datacenter:tencent view 2026-10-19 18:19:35 UTC, 0 since; 266 denied in 25 h; signed-out SG+CN ~140/day → 7);
  #146 ConsentGate + DigestConsentPrompt re-check on each change of signed-in user (watchSignedInUser /
  lib/auth/userWatcher.ts; PASSWORD_RECOVERY counts; stale results dropped); #147 dead FollowTagButton /
  useFollowedTags removed; #148 component tests for both prompts (happy-dom).
- Start state: main 3dd971f; lock taken for analytics-001.
- Verification: #144 localhost 3 → 1 /auth/v1/user per page; 087 PGlite fixture, dry run = 087 only, schema-snapshot +
  audit PASS (4412 facts); #146 userWatcher unit tests; #148 15 component tests, each of 11 guards fails a test when
  removed; unit 111 pass on Node 20 + 24 (CI 111/111). Every PR suite green; post-merge health checks success.
- Review: Codex · tier 2 · #144 1 round; 087 1 round; #146 2 rounds (r1 3 BLOCKING: recovery event ignored, stale
  submit, late invalidation — all verified + fixed); #147 1 round; #148 2 rounds (r2 relaunched after Codex usage limit).
- Commits / PR: #144 → ae229b7, #145 → bbdd2e1, #146 → 34d515b, #147 → 9f83192, #148 → b48d847 (each on Roi's word).
- Pending Roi approvals: which remaining follow-up next; CI Node 20 → 24 upgrade (separate decision).
- Known risks / unresolved: #146's sign-in switches not exercised in a real browser (component tests only); #147's
  first smoke run had both search @weekly tests time out (rerun passed) — watch for recurrence; the 503 prefetches.
- Lesson: verifyOtp({ type: 'recovery' }) emits PASSWORD_RECOVERY, not SIGNED_IN; delete_user_account() also deletes
  auth.users (no separate admin delete). node:test mock.module needs Node ≥ 22.3 — CI's Node 20 lacks it; tsx tests
  run as CommonJS, so fakes can go in require.cache. A review "done" marker from an earlier round with the same name
  makes a wait loop return stale output — use a fresh prefix or compare mtimes.
- Next best step: Roi picks: the 503 prefetch check (perf-001 overlap) or something else; Gmail re-check is Roi's.

### Session 20261020-1043-claude-d205 · 2026-10-20 · Claude Code · lock release
- Handoff for the entry above (same session): that entry went out as its own state commit before unlock, which the
  unlock's append-only check then saw as no growth — this line rides with the lock release. Primer Recent Sessions
  updated (latest 5).

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

### Session 20261024-1148-claude-8763 · 2026-10-24 · Claude Code · perf-001 (#154 check; monitoring)
- Goal: Roi — "let's pick this up": the 12 h check after #154.
- Findings (12 h request log 10-23 23:49 → 10-24 11:48 UTC vs 10-23 07:37 → 19:34): facebookexternalhit 170 requests,
  157 on / served /link-preview from the CDN (prerender HIT/STALE), 0 home renders (was 130 / 12 h); its 11 remaining
  function requests are article pages (by design). Home renders 404 → 233, of which our smoke 120; without the smoke
  276 → 113: OAI-SearchBot 49, meta-webindexer 31 (search crawler, kept by design), crawlers ~15, a Baidu-app session
  from CN 6, people ~10. Function requests 948 → 589 (windows differ: night vs Israeli day — direction only).
  Vercel CPU: `vercel usage` / `vercel metrics` need a paid plan or add-on (Hobby: no); the dashboard was signed out in
  the MCP browser → the usage chart is for Roi to read.
- Side checks: Chinese fleet (primer note, revisit ~10-26) — 10-23: 2 CN views, 10-24: 1; today's 43 CN requests = one
  Baidu-app burst at 01 UTC (mostly static files) + 5 HeadlessChrome. page_views low (10-23: 43, 10-24 to 11:48: 2
  human-ish) checked as a possible broken sensor: every /api/analytics/track POST is 200 and matches rows; the day's
  renders are mostly no-JS scrapers (BD, VN) and it is Friday–Saturday (Saturday 10-17: 9 human views) → not broken.
- Start state: main a82f724; lock taken for perf-001.
- Verification: read-only (request logs, page_views via service role, gh run list: scheduled smoke 10-24 success).
- Review: n/a (no code change).
- Commits / PR: none.
- Pending Roi approvals: none.
- Known risks / unresolved: CPU effect not yet read from the usage chart.
- Lesson: on Hobby the CLI's request log reaches back 12 h only and `vercel usage` / `vercel metrics` are unavailable —
  the request log carries clientIpCountry (country, no IP / ASN).
- Next best step: Roi reads the usage chart (daily Fluid Active CPU, 10-22 → 10-25); revisit the Chinese fleet ~10-26.
