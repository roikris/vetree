# AGENTS.md — Vetree

Read `CLAUDE.md` first. It is the shared rulebook for every agent in this repo, not only Claude
Code; then read `app/api/CLAUDE.md` and `supabase/CLAUDE.md`.

**Started to WORK on Vetree** → follow `docs/harness/README.md` (the session routine).
- Codex working sessions start from the repo root, with the invocation recorded in
  `docs/harness/README.md`, and must pass `docs/harness/init.sh --check-git` before anything
  else. If it fails: stop and tell Roi.
- Until README.md records a tested Codex invocation, Codex is **reviewer-only** in this repo.

**Started as a REVIEWER** (e.g. `codex exec --sandbox read-only` in the review loop) → do NOT run
the session routine or `init.sh`, do not take the session lock, and do not edit any file (the
`harness-state` branch included). Review only what you were asked to review.
