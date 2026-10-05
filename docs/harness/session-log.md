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
