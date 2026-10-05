# Session harness — the routine every working session follows

Agents forget everything between sessions. This routine makes each session start from where the
last one stopped, work on ONE thing, prove it, and hand off cleanly. Why it is built this way, and
every decision Roi took: [`DESIGN.md`](DESIGN.md).

**Reviewers** (e.g. `codex exec --sandbox read-only` in the review loop) do NOT follow this
routine: no `init.sh`, no lock, no edits.

## Where things live

| What | Where | Changed by |
|---|---|---|
| Rules (this file, `init.sh`, `harness.mjs`, `lint-baseline.json`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`) | `main` | normal draft PR (docs-only → smoke skipped) |
| State: `primer.md` (current state, lessons, recent sessions), `feature_list.json` (backlog), `session-log.md` (every session, never trimmed), `session.lock` | branch `harness-state`, under `docs/harness/` | sessions, committed + pushed **directly** (CLAUDE.md exception 1) |

Locally the state branch is a git worktree at `.harness-state/` inside the repo, created by
`init.sh state` and hidden from git via the clone's exclude file. Only the allowlisted state files
may exist there (checked on every run). **Never merge `harness-state` into `main`.**

The old root `primer.md` is frozen and superseded. History before the harness: `git show
16c25da:primer.md` (shallow clone → `git fetch --unshallow` first).

## Start

1. `pwd` is the repo root; note `git branch --show-current`, `git status` (anything dirty that you
   didn't make: record it, never commit or discard it without asking), `git log --oneline -5`.
2. Read `CLAUDE.md`, `app/api/CLAUDE.md`, `supabase/CLAUDE.md`.
3. **Codex only:** `docs/harness/init.sh --check-git`. Fails → stop, tell Roi.
4. `docs/harness/init.sh state`. Then read `.harness-state/docs/harness/primer.md` (Current State
   + the latest session) and `.harness-state/docs/harness/feature_list.json`.
5. **Take the lock:** write `.harness-state/docs/harness/session.lock` in exactly this format —
   `init.sh` reads the owner from the unindented `session: ` line:
   ```
   session: 20261005-0846-claude-b18d
   agent: Claude Code
   started: 2026-10-05T08:46:44Z
   item: <item id>
   ```
   (id = `YYYYMMDD-HHMM-<agent>-<4 random hex>`), then commit and push.
   Then `export HARNESS_SESSION=<id>` so later `init.sh` runs recognise the lock as yours.
   `init.sh state` stops (exit 2) on any lock that isn't yours → tell Roi. Push fails → stop; no
   product work.
6. **Reconcile with GitHub**, for every item with a `pr`: merged → `merged`; closed unmerged →
   `in_progress` or `blocked` with a note; open and `passing` but the PR head ≠ the evidence SHA →
   `in_progress` ("head changed after verification"). GitHub unreachable → note it, change nothing.

## Pick one item

- **Resume first.** An `in_progress` item continues: `git fetch`, `git switch <branch>`,
  `git pull --ff-only`. Branch predates the harness (no `head_sha`) → record its head as
  `head_sha`. Branch gone or rewritten → look for `head_sha` locally (`git cat-file -e <sha>`), then
  `git fetch origin <head_sha>`; found → new branch `<branch>-recovered-YYYYMMDD` at that SHA,
  `git push -u`, update the item (old branch + PR kept in notes); not found → stop, tell Roi.
- Otherwise the lowest `priority` among `not_started`, unless Roi names one. Backlog empty → a
  backlog session with Roi. Everything blocked → ask Roi.
- New item → branch from current `origin/main` (`feat/`, `fix/`, `chore/`).
- **Claim before product work:** item → `in_progress` + `branch`; commit + push the state. Push
  fails → stop; no product work.
- Roi redirects mid-item → that item → `blocked` ("paused by Roi for <id>") with its next step.
  Never reset or hide it.
- Rule 14: `git log --since=7.days -- <paths of the item's area>` — 3 fixes already → present the
  rebuild-vs-patch assessment to Roi before writing code.

## Baseline — on the picked item's branch

`docs/harness/init.sh check` (add `--item <id>` when resuming; `--quick` skips the build, for
sessions that touch no code). Any later branch switch → run it again; only a baseline on the
current HEAD counts.

| Result (exit) | Meaning | Do |
|---|---|---|
| GREEN (0) | tsc, lint ratchet and build pass (`GREEN (quick — build not run)` with `--quick`: say so in evidence) | work |
| POSSIBLE TRANSIENT (3) | tsc + lint passed and the build failed with the known Supabase/network signature | re-run once; exit 3 again → treat as RED |
| EXPECTED-WIP (10) | HEAD is the item's `wip_sha`, every failed check left parsed signatures, and every failure matches its `expected_failures` | continue the item |
| RED / REGRESSION (1) | anything else — a failure this session didn't cause | record it, release the lock, tell Roi; fixing it becomes an item only with Roi's OK |
| STOP (2) | needs a human (lock, unpushed state, wrong worktree…) | read the message, tell Roi |

Lint is a **ratchet** (D9): `lint-baseline.json` lists the known errors per file + rule; only
errors above those counts fail. A PR that fixes lint errors shrinks the file in the same PR
(`docs/harness/init.sh --write-lint-baseline`). It never grows.

`next build` **reads production Supabase** (read-only). Local dev shares the production database,
so "local" is never isolated.

## Work

- Draft PR (`gh pr create --draft`); push freely.
- Run the item's `verification` steps as written. A step with `db_writes: prod` or
  `paid_calls: true` needs Roi's OK **for that item** first; record the approval and its scope in
  the evidence. Never run Playwright as a baseline check.
- Review loop by the **other** agent until `BLOCKING: none` (CLAUDE.md): Claude Code worked →
  Codex reviews; Codex worked → Claude Code reviews. Mark the PR ready once, when done.
- `passing` = verified on the PR head, evidence recorded (with that SHA). Only Roi merges.
- After every successful push: update the item's `head_sha`.

## Before you stop — every line done, or N/A with the reason

- [ ] Product branch: `npm run build` green before its last commit, committed, pushed.
      **Unfinished and red** → a WIP commit (CLAUDE.md exception 2): check the PR is a draft
      (`gh pr view --json isDraft`), stage only this session's own changes (review
      `git diff --staged`, not just file names), commit `WIP (build red): <what's unfinished>`,
      push, run `init.sh check`, and record `wip_sha` + `expected_failures` (the signatures from
      `$(git rev-parse --git-path harness)/*.sigs.json`) in the item. The first normal, built commit after it clears both.
- [ ] Item status + evidence honest — no `passing` without proof.
- [ ] Session entry in `primer.md` (Recent Sessions) **and** appended to `session-log.md`.
- [ ] `primer.md` Current State updated; next step written down.
- [ ] Lock released (delete `session.lock`) and the state committed + pushed. A release counts
      only once its push succeeds.

A **controlled stop** (regression, nothing to do, Roi stops the session) also writes a short entry
and releases the lock. Only a crash leaves a lock behind; a stale lock is removed only on Roi's word.

### Session entry format

```
### Session <id> · YYYY-MM-DD · <Claude Code | Codex> · <item id>
- Goal / Completed:
- Start state: branch, base SHA, dirty files
- Verification: exact commands + target + outcome; tested SHA
- Review: the other agent's result (BLOCKING: none / open items)
- Commits / PR / WIP commit:
- Pending Roi approvals:
- Known risks / unresolved:
- Next best step:
```

## Failed state push (lock, claim or handoff)

All commands inside `.harness-state`. Never reset or discard the local commit.
`git fetch origin`; inspect `git log origin/harness-state..HEAD` and `git diff origin/harness-state`.
Check ownership on the **remote**: `git show origin/harness-state:docs/harness/session.lock` must
be this session's id (or absent, when taking the lock). Then `git pull --rebase` and push again.
`session-log.md` conflicts keep both entries; a conflict in `feature_list.json` or `primer.md` →
stop and ask Roi. Still failing → stop and tell Roi, leaving the commit in place.

## Fresh clone

Node 24.x / npm 11.x · `gh auth login` · `.env.local` (see `ENV_SETUP.md`; the Vercel dashboard
is the source of truth) · then `docs/harness/init.sh` (it runs `npm ci` when needed and never
approves npm install scripts — that is Roi's call).

**Codex working sessions** — tested in rollout dry run 8e (2026-10-05), from the repo root:

```
codex exec --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -c 'sandbox_workspace_write.writable_roots=["<absolute repo path>/.git"]' "<task>"
```

Still sandboxed: writes only inside the repo (incl. its `.git`, needed to commit) plus network for
fetch/push. Plain `workspace-write` keeps `.git` read-only — `--check-git` then stops, correctly.
Never use `danger-full-access` / `--dangerously-bypass-approvals-and-sandbox` for a working session.
Codex receives the root `AGENTS.md` automatically (from the root and from subfolders) but not
CLAUDE.md, which `AGENTS.md` tells it to read. Its work is then reviewed by Claude Code (D10).

**Codex reviews** (Claude Code worked): `codex exec --sandbox read-only "<review task>"` in its own
Terminal.app window — tested in dry run 8f: it reviewed without running the routine.
