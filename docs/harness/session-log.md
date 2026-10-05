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
