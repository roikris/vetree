# AGENTS.md — Vetree

Read `CLAUDE.md` first. It is the shared rulebook for every agent in this repo, not only Claude
Code; then read `app/api/CLAUDE.md` and `supabase/CLAUDE.md`.

**Started to WORK on Vetree** → follow `docs/harness/README.md` (the session routine).
- Codex working sessions start from the repo root, with the invocation recorded in
  `docs/harness/README.md`, and must pass `docs/harness/init.sh --check-git` before anything
  else. If it fails: stop and tell Roi.
- Until README.md records a tested Codex invocation, Codex is **reviewer-only** in this repo.
- When Codex is the worker, **Claude Code is the reviewer** (Roi, 2026-10-05): Codex's diff goes
  through a Claude Code review loop until `BLOCKING: none` before the PR is marked ready.

**Started as a REVIEWER** (e.g. `codex exec --sandbox read-only` in the review loop) → do NOT run
the session routine or `init.sh`, do not take the session lock, and do not edit any file (the
`harness-state` branch included). Review only what you were asked to review, using
`docs/harness/review-checklist.md` and the CLAUDE.md sections you were pointed to — not all three
CLAUDE.md files. Output only BLOCKING / NON-BLOCKING.
