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
