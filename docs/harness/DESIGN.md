# Session harness — design, decisions and rollout

This is the reviewed plan the harness was built from (plan v9: six Codex review rounds, the last
`BLOCKING: none`), kept in the repo so the rollout and every decision survive without chat
history. The routine itself is in [README.md](README.md). Decisions D1–D9 and Q1–Q3 are Roi's.

## Changed during step 9 (supersedes the plan text below where they differ)
- **A failed build is never an expected WIP failure** (Codex diff review rounds 1–3: build logs are
  open-ended, keyword parsing kept leaking). `classify` rejects any failed build; build signatures
  are informational only.
- **WIP mode** (`check --item`): only when HEAD == the item's `wip_sha` AND HEAD is a
  `WIP (build red):` commit AND the current branch is the item's branch AND the working tree is
  clean (round 5); a matching SHA with
  anything else inconsistent stops (exit 2) (round 4). The build is skipped; tsc + lint decide; the
  result is EXPECTED-WIP (10), never GREEN. The next normal commit still needs a GREEN build.
- **WIP handoff** records tsc + lint signatures with `init.sh check --quick` (not the full check).
- **tsc parsing is strict:** continuation lines are appended to the diagnostic above; stray lines,
  orphan continuations or an unusual tsc exit code → unparsed.
- **Fail-closed evidence:** every failed check must leave parsed, non-empty signatures; ESLint exit ≥ 2
  or missing JSON → unparsed; transient (exit 3) only for the real sitemap/network error lines and
  only when tsc + lint passed; a second exit 3 = RED.

## Rollout checklist

| Step | What | Status |
|---|---|---|
| 0 | Repair interrupted `npm ci` | ✅ 2026-10-04 |
| 1 | Codex review of the plan to `BLOCKING: none` | ✅ 2026-10-04 — 6 rounds, 14 blocking issues fixed (Appendix B) |
| 2 | Measure baseline (tsc / lint / build, clean checkout) | ✅ 2026-10-04 at 16c25da (Appendix A) → D9 |
| 3 | Primer fact inventory + history draft, approved by Roi | ✅ 2026-10-05 (POINTERS chosen) |
| 4 | Rules files on `chore/agent-harness` (this commit) | ✅ 2026-10-05, branch rebased on 60e658d (#109); lint baseline 178 errors / 71 entries unchanged |
| 5 | Build the orphan `harness-state` branch locally; 5b re-check isolation | ✅ 2026-10-05 — `harness-state` @ 5514fc0 (local only; git 2.39 → `worktree add --detach` + `switch --orphan`); 5b: check GREEN with the folder populated, eslint 0 files from it, tsc/build never mention it |
| 6 | First push of `harness-state` — **asks Roi** | ✅ 2026-10-05 08:02:31Z on Roi's OK — `harness-state` @ 5514fc0 on GitHub; `init.sh state` against it: all checks pass |
| 7 | Prove Vercel does not deploy `harness-state` | ✅ 2026-10-05 — 10 polls 08:02–08:13Z, every query valid, 0 deployments by SHA or branch; 0 GitHub runs, 0 GitHub deployments. Note: the API's `meta-githubCommitSha` filter is ignored when nothing matches (returns unrelated deployments) → the check filters the latest 100 locally, validated on a known main deployment and an impossible SHA |
| 8 | Dry runs a–f (Claude Code, then Codex) | ✅ 2026-10-05 — all passed after 2 fixes. (a) full routine. (b) WIP carried over: EXPECTED-WIP incl. untouched consumers; missing record / moved HEAD / unparsed build (synthetic) all stop. (c) controlled stop, crash (lock now hard-stops), failed push + README recovery, lost-branch recovery. (d) fresh clone: GREEN, worktree tracks origin. (e) Codex worker: default sandbox can't write `.git` → probe stopped it (correct); with `.git` as a writable root it ran the routine, a real network outage failed its claim push → it stopped, then resumed and recovered per README; Claude review BLOCKING: none. (f) Codex reviewer: reviewed 95f3413 read-only, never ran the routine; BLOCKING: none, 2 non-blocking fixed. Fixes: build parser for Next 16 (d4242f0); foreign lock exits 2 (95f3413) |
| 9 | Record rollout outcomes in README.md; Codex review of the diff; draft PR; merge on Roi's word | ⬜ |
| 10 | Session 001: build the backlog with Roi | ⬜ |

Each step is ticked here, with its artifact SHA, in the commit that completes it.

---

# Plan v9: session harness for Vetree (Claude Code + Codex)

Source: walkinglabs/learn-harness-engineering, docs/en/resources/templates (starter four:
instruction file, init.sh, progress log, feature list). Adapted to Vetree's existing process.

Changes: [v2] Roi's Q1–Q3. [v3] Codex round 1 + D4 (state branch), D5 (state-only commits skip
build). [v4] Codex round 2 (5 blocking, 6 non-blocking, verified) + D6 (old primer stays on main
with a superseded banner) + D7 (no parallel sessions). [v5] Codex round 3 (2 blocking, 6
non-blocking, verified) + D8 (WIP commits). [v6] Codex round 4 (2 blocking, 6 non-blocking,
verified): baseline runs AFTER the item is picked; expected-WIP vs. unexpected failures; fresh-clone
--check-git; controlled stops release the lock; tracked DESIGN.md with rollout checklist.
[v7] Codex round 5 (1 blocking, 5 non-blocking, verified): expected-WIP = recorded diagnostic
signatures, not file location; explicit head/wip/expected_failures fields; recovery paths for
failed state pushes and lost branches; fresh-clone + dry-run retirement in rollout.
[v8] Codex round 6: BLOCKING: none. Its 6 non-blocking refinements folded in (no new design).
[v9] Step 2 measured (Appendix A): lint is red on main (178 errors) → D9 lint ratchet.

## Owner decisions (Roi, 2026-10-04)
- D1 The first harness session builds the backlog with Roi (no product code in that session).
- D2 primer.md becomes the progress log, rewritten to the current state (main @ 16c25da, PR #108)
  without losing valuable information.
- D3 Codex uses the harness too. Harness files live under docs/harness/; keep the root tidy.
- Q1 Status lifecycle gets `merged` after `passing`.
- Q2 init.sh runs the full build by default; `--quick` (tsc + lint) for sessions that touch no code.
- Q3 primer keeps recent session entries; session-log.md keeps every entry, never trimmed.
- D4 Progress STATE lives on a dedicated orphan branch `harness-state`; RULES live on main.
- D5 Commits that touch only harness state files are exempt from "build before commit".
- D6 The old root primer.md stays on main, content untouched, with a banner at the very top:
  superseded, not current, pointing to the new primer.
- D7 Roi does not run parallel working sessions. One working session at a time per repo.
  (Reviewer runs don't count — they never touch state.)
- D9 Lint ratchet: lint is red on main (178 errors, 75 warnings at 16c25da; never run in CI).
  Only NEW lint errors fail the baseline. Known errors are listed in
  `docs/harness/lint-baseline.json` ON MAIN (it belongs with the code: a PR that fixes lint shrinks
  it in the same PR). Entry = {file, rule, count}; a file+rule count above its baseline, or a new
  file+rule, fails; fewer is fine (init.sh suggests shrinking the file). Lint cleanup → backlog
  candidate for session 001.
- D10 (Roi, 2026-10-05) The reviewer is always the OTHER agent: Claude Code works → Codex reviews
  (the existing loop); Codex works → Claude Code reviews, until `BLOCKING: none`. Nobody reviews
  its own work. Applied in CLAUDE.md (review bullet), AGENTS.md, README.md (Work).
- D8 Unfinished code at session end → a `WIP (build red): …` commit pushed to the item's draft
  branch. Only that commit is exempt from "build before commit". A PR whose head is a WIP commit
  is never marked ready. (Replaces v4's patch-file idea, which was lossy.)

## Constraints the harness must respect (from CLAUDE.md)
Unchanged for product and rules changes: never commit to main; feat/ fix/ chore/ branches; draft
PRs; push freely to drafts; mark ready once, when done; batch related changes into one PR
(CLAUDE.md:29) — one backlog item may cover several related fixes; adversarial review loop by the other agent (D10)
until `BLOCKING: none`; merge only on Roi's explicit word; Vercel CPU budget; rules 14–16; read the
three CLAUDE.md files before every task.
The ONE exception (D4/D5), written into CLAUDE.md: commits on `harness-state` that touch only
`docs/harness/**` state files go directly to that branch — no PR, no Codex review, no build.
Second exception (D8): a `WIP (build red): …` commit on a draft item branch skips the build.

## Facts established (verified 2026-10-04)
- Local dev, previews and production share ONE Supabase database (CLAUDE.md:202).
- e2e specs have production effects even against localhost: smoke saves/unsaves rows
  (e2e/smoke.spec.ts:478); digest spec rewrites real article rows temporarily
  (e2e/digest-recency-and-memory.spec.ts:146); generate-route spec makes paid Claude calls
  (e2e/generate-route.spec.ts:45).
- `next build` reads production Supabase (app/sitemaps/sitemap.ts, lib/sitemap.ts,
  app/article/[id]/page.tsx:42). Read-only; transient count failures have failed whole builds,
  incl. locally on 2026-10-04 (lib/sitemap.ts:37).
- Branch protection exists for `main` only; no rulesets (GraphQL).
- No GitHub workflow triggers on pushes to non-main branches.
- Vercel project: createDeployments enabled, no ignored-build-step, no vercel.json → every pushed
  branch gets a preview build by default.
- Docs-only smoke skip covers `*.md` and `docs/**`, both sides of renames (qa-smoke-pr.yml:42–48).
- Local npm 11.19 skips install scripts not in allowScripts (esbuild, @sentry/cli, unrs-resolver,
  protobufjs, fsevents x2, @google/genai).
## Not yet verified (acceptance criteria, checked during rollout)
- Where Codex discovers AGENTS.md (root vs subdirectory) — rollout step 8.
- Whether `vercel.json` `git.deploymentEnabled: false` on the orphan branch stops Vercel
  deployments for it — rollout step 7.
- Codex worker sandbox can write `.harness-state/` (inside the repo) — rollout step 8. Also
  whether workspace-write lets Codex `git commit` (it may treat `.git` as read-only) and `git push`
  (network is off by default; may need `-c sandbox_workspace_write.network_access=true`).
  The loop needs git writes + push at startup, lock, claim and handoff, so there is NO deferred-
  commit fallback: a Codex working session must pass `init.sh --check-git` (below) or stop before
  any product work. If only an unsandboxed mode passes, whether Codex runs working sessions at all
  is Roi's decision after the dry run; until then Codex is reviewer-only.
- (Settled at step 2, 2026-10-04: tsc PASS incl. clean checkout — no build output needed; lint
  FAIL 178 errors → D9; build PASS, reads prod Supabase; skipped install scripts don't matter.)

## Layout
On main (rules — normal draft PR; every path is *.md or docs/** → smoke skipped):
```
AGENTS.md                      NEW, root. Entry point for Codex / any AGENTS.md reader.
CLAUDE.md                      EDIT: SESSION HARNESS section + the one policy exception (D4/D5).
                               Nothing else removed or weakened.
primer.md                      KEPT (D6). Banner prepended; old content untouched below it.
docs/harness/README.md         Session loop, state-branch usage, fresh-clone prerequisites,
                               pointer to the old primer.
docs/harness/init.sh           Baseline check + state worktree setup.
docs/harness/lint-baseline.json Known lint errors at 16c25da (D9); only new ones fail.
docs/harness/DESIGN.md         This plan, finalized: decisions D1–D8 with reasons, verified facts,
                               and the rollout checklist with completed steps + artifact SHAs (so an
                               interrupted rollout never depends on chat or scratch files).
```
On `harness-state` (orphan branch, no product code; sessions commit + push directly):
```
docs/harness/primer.md         Progress log: current state, open issues, lessons, recent sessions.
docs/harness/feature_list.json Backlog.
docs/harness/session-log.md    Every session entry, append-only, never trimmed.
docs/harness/session.lock      Present only while a working session is active (D7).
vercel.json                    {"git": {"deploymentEnabled": false}}
README.md                      "State branch for the session harness. Never merge into main.
                               Rules: docs/harness/README.md on main."
```
Working copy: a git worktree at `<repo>/.harness-state/` — per-clone path, so two clones never
collide. Kept out of git by the exclude file (written by init.sh) — no tracked .gitignore change,
so the rules PR stays docs-only. EXPECTED (acceptance tests, not facts yet — rollout 5b and 8):
the Codex workspace-write sandbox covers it because it's inside the repo, and tsc / eslint /
next build ignore it because it holds only allowlisted .md/.json files.

Deferred until there is real session history: evaluator-rubric.md, quality-document.md,
session-handoff.md (the session entry is the handoff).

## Old primer banner (D6, prepended to root primer.md on main)
```
> **⚠️ SUPERSEDED — this is NOT the current state of Vetree.**
> Frozen on 2026-10-04 (last real update 2026-07-17). The current, maintained progress log is
> `docs/harness/primer.md` on the `harness-state` branch:
> https://github.com/roikris/vetree/blob/harness-state/docs/harness/primer.md
> (locally: `.harness-state/docs/harness/primer.md` after running `docs/harness/init.sh`).
> Agents: do not act on anything below; read the current primer instead. Do not edit this file.
```

## AGENTS.md (draft)
- Read CLAUDE.md first: it is the shared rulebook for every agent here, not only Claude Code.
- Started to WORK on Vetree → follow docs/harness/README.md.
- Started as a REVIEWER (e.g. `codex exec --sandbox read-only` review loop) → do NOT run the
  session loop, init.sh, take the session lock, or edit any file. Review only what you were asked.
- Codex working sessions run from the repo root with the invocation recorded in README.md (set by
  the dry run) and must pass `docs/harness/init.sh --check-git` first; failing → stop, tell Roi.
  Until the dry run records a working invocation, Codex is reviewer-only.

## CLAUDE.md edits (draft)
1. After WORK STYLE, new section SESSION HARNESS: every working session follows
   docs/harness/README.md; state lives on branch `harness-state`, worked in `.harness-state/`;
   never merge harness-state into main; one working session at a time (D7).
2. In BRANCH & PR POLICY, a scoped exception: "Exception (Roi, 2026-10-04): commits on
   `harness-state` that change only `docs/harness/**` state files go directly to that branch —
   no PR, no Codex review, no `npm run build`. Everything else in this section applies unchanged."
3. Second scoped exception (D8, Roi, 2026-10-04): "Unfinished code at the end of a session may be
   committed as `WIP (build red): <what's unfinished>` on its draft branch without a build; never
   mark a PR ready while its head is a WIP commit."
4. Beside "Always run `npm run build` before committing": "(two exceptions — see BRANCH & PR
   POLICY)".
5. Primer's "All Claude Code prompts must start with: Read CLAUDE.md, app/api/CLAUDE.md,
   supabase/CLAUDE.md first" duplicates WORK STYLE line 1 → recorded as already covered.

## Session loop (docs/harness/README.md)
Start:
1. Confirm repo root, branch, `git status` (dirty start → record it; never commit or discard
   uncommitted changes you didn't make without asking), `git log --oneline -5`.
2. Read CLAUDE.md, app/api/CLAUDE.md, supabase/CLAUDE.md.
3. Codex working session only: `docs/harness/init.sh --check-git` (preliminary probe). Fail → stop.
4. `docs/harness/init.sh state` — sets up / syncs `.harness-state/` (no build yet). Read from it:
   primer.md (Current State + latest entry) and feature_list.json.
5. Take the session lock (see Lock). Lock held → stop and tell Roi. Lock push fails → stop, no
   product work.
6. Reconcile with GitHub: for every item with a `pr`: merged → `merged`; closed unmerged →
   `in_progress`/`blocked` with a note; open + `passing` but PR head SHA ≠ evidence SHA → back
   to `in_progress` ("head changed after verification"). GitHub unreachable → record it, continue
   without status changes.
Pick:
- RESUME FIRST: an `in_progress` item is continued: `git fetch`, `git switch <branch>`,
  `git pull --ff-only`. Branch exists locally but predates the harness (no `head_sha`) → record
  its current head as `head_sha` and continue. Branch gone or rewritten → first look for
  `head_sha` locally (`git cat-file -e <sha>`), then `git fetch origin <head_sha>` (GitHub keeps
  reachable/PR objects, but retention is not guaranteed); found → new branch
  `<branch>-recovered-YYYYMMDD` at that SHA, pushed with upstream set (`git push -u`), item's
  `branch` (and PR, if a new one is needed) updated, old branch + PR kept in notes, nothing
  discarded; not found → stop and tell Roi.
- Metadata lifecycle: `head_sha` updated after every successful product push; `wip_sha` +
  `expected_failures` cleared (null / []) by the first normal, built commit after a WIP.
- Otherwise the lowest `priority` among not_started, unless Roi names one. Backlog empty → this is
  a backlog session with Roi. Everything blocked → ask Roi.
- New item → branch from current origin/main (feat/ fix/ chore/).
- Claim before product work: status `in_progress` + `branch`, commit + push to harness-state.
  Claim push fails → stop, no product work.
- Roi redirects mid-item → current item → `blocked` ("paused by Roi for <id>") with next step;
  never reset or hidden.
- Session 001 = backlog session with Roi (D1); `init.sh check --quick`; no product code.
- Rule 14: before patching, `git log --since=7.days -- <paths>` for the item's area.
Baseline (on the picked item's branch, so it tests the code the session will actually touch):
- `docs/harness/init.sh check` (or `check --quick`). Any later branch switch → run it again; only a
  baseline on the current HEAD counts.
- Red → classify, in this order:
  1. Supabase/network blip (known sitemap signature) → re-run once.
  2. Expected WIP failure: HEAD == the item's `wip_sha`, AND every failure matches a signature in
     the item's `expected_failures` — wherever it occurs (a changed shared type may break an
     untouched consumer; that's fine if it was recorded). Signature = {check, file, code,
     message}, line numbers ignored; `file`/`code` may be null for failures that have none (e.g. a
     build-step error), then the normalized first error line is the message. A non-zero exit that
     init.sh cannot parse into signatures NEVER counts as matched. → expected; continue the item.
  3. Anything unmatched — a new error in any file, or red on a fresh branch from main →
     unexpected regression: record it, release the lock (controlled stop), tell Roi. Repairing it
     becomes an item only with Roi's OK.
Work:
- Draft PR; push freely.
- Verification steps run as written; any step with `db_writes: prod` or `paid_calls: true` needs
  Roi's OK for that item first; the approval and its scope are recorded in evidence.
- Review loop by the other agent (D10) until `BLOCKING: none`; mark PR ready once, when done.
Before you stop (clean-state checklist; each line is done, or N/A with the reason):
- [ ] product branch: `npm run build` green before its last commit, committed, pushed to the
      draft PR. Red build from unfinished code → D8 WIP commit: confirm the PR is a draft
      (`gh pr view --json isDraft`); stage only this session's own changes, reviewing staged hunks
      (`git diff --staged`), not just file names; commit as `WIP (build red): <what's unfinished>`;
      push; run `init.sh check` on it and record `wip_sha` + `expected_failures` (the exact
      signatures from that run) in the item. Afterwards only the dirty changes recorded at start
      (not this session's) may remain.
- [ ] item status + evidence updated honestly (passing evidence carries the PR head SHA)
- [ ] session entry in primer.md Recent Sessions AND appended to session-log.md
- [ ] primer.md Current State updated; next step written
- [ ] lock released; state committed + pushed to harness-state

Lock (D7, single-user, so it guards against accidents — a forgotten session, Claude + Codex
started together — not adversaries):
- `docs/harness/session.lock` = session id (`YYYYMMDD-HHMM-<agent>-<4 random hex>`), agent, start
  time, item. Taken by committing + pushing it; a push rejected because the remote moved → pull,
  re-read; lock present → stop.
- Released (file deleted) in the final state commit — also on every controlled stop (regression,
  nothing to do, Roi stops the session): a short session entry saying why, then release + push.
  A release counts only once its push succeeds; a failed release push (e.g. network) leaves the
  lock on the remote exactly like a crash → recorded as such, handled as a stale lock.
- Failed state push (lock / claim / handoff), all commands run in `.harness-state`: never reset
  or discard the local commit. `git fetch origin` first, then inspect
  `git log origin/harness-state..HEAD` and `git diff origin/harness-state`. Before retrying,
  check lock ownership on the REMOTE (`git show origin/harness-state:docs/harness/session.lock`):
  it must be this session's id (or absent, when taking it). Then `git pull --rebase` and push
  again; still failing → stop and tell Roi, leaving the commit in place. The next init.sh stops on
  it ("unpushed state commits") and shows the owner from the remote lock, the pending commit's
  message, and its session entry — a failed RELEASE has no local session.lock, so the local file
  alone is never used to establish ownership.
- Stale lock (the session ended without releasing) → never removed automatically; tell Roi, and
  remove it only on his word, recording that in the next session entry.
- Push conflict on any state file → pull --rebase; session-log.md conflicts keep both entries; a
  conflict in feature_list.json or primer.md → stop and ask Roi (no automatic resolution).

## init.sh
Subcommands: `state` (repo info + state worktree), `check [--quick]` (dependencies + tsc / lint /
build; `--quick` skips build), `--check-git` (preliminary capability probe). No argument = `state`
then `check`. Non-zero exit if anything fails; summary table.
`--check-git` works on a fresh clone with no local `harness-state` branch: write + delete a temp
file at `$(git rev-parse --git-path harness-probe)`; `git fetch origin harness-state`;
`git push --dry-run origin refs/remotes/origin/harness-state:refs/heads/harness-state` (needs no
local branch; tests auth + network). It is a probe only: the real proof is that the lock and claim
commits actually push — those stay mandatory before product work.
1. Repo: assert `git rev-parse --show-toplevel`; print branch, HEAD, dirty files count, commits
   behind origin/main (`git fetch origin`).
2. State worktree (`.harness-state/`, branch `harness-state` tracking `origin/harness-state`):
   - ensure `.harness-state/` is in the exclude file at `$(git rev-parse --git-path info/exclude)`
     (works in linked worktrees, where `.git` is a file)
   - `git worktree prune`; `git fetch origin harness-state`
   - missing → `git worktree add .harness-state harness-state` (creates the local branch tracking
     origin if absent)
   - exists → verify it's a worktree of THIS repo on branch `harness-state`. Otherwise stop and
     print the case + repair: not a worktree (move it aside, then re-run); wrong branch; branch
     checked out in another worktree (`git worktree list` shows where) → stop; it may be removed
     only if it has no uncommitted changes AND no unpushed commits
     (`git -C <path> log origin/harness-state..HEAD` empty), and only with Roi's OK. Never delete
     or force anything automatically.
   - uncommitted changes or local unpushed commits → stop and report (could be an unfinished
     handoff); else `git -C .harness-state pull --ff-only`
   - AFTER the pull, allowlist check over `git -C .harness-state ls-files` plus
     `ls-files --others` (untracked, ignored ones included; the worktree's `.git` admin file is not
     content): every path must be in {README.md, vercel.json, docs/harness/primer.md,
     docs/harness/feature_list.json, docs/harness/session-log.md, docs/harness/session.lock};
     anything else → stop (tsc / eslint / next build isolation — tsconfig.json:25 and
     eslint.config.mjs:9 don't exclude it). Also: vercel.json present and
     `.git.deploymentEnabled == false`, else stop.
   - `origin/harness-state` missing → stop: "state branch not set up — see README"
3. Dependencies: fingerprint = sha256(package-lock.json + .npmrc) + node -v + npm -v in
   node_modules/.harness-install-stamp. Mismatch / missing → `npm ci`. Never `npm install`. Never
   approves install scripts (Roi's call). Prints npm's skipped-script warnings.
4. Checks, each timed: `npx tsc --noEmit` (measured: needs no build output), `npm run lint`
   compared against lint-baseline.json via `eslint --format json` (D9), `npm run build` (unless
   --quick). Measured at 16c25da: tsc 25 s, lint 31 s, build 82 s. Prints "build reads production
   Supabase (read-only)" up front. On build failure, labels the known sitemap/Supabase blip as
   "possible transient — re-run once" vs. "code failure".
5. Never runs Playwright and suggests no Playwright command.

## Fresh-clone prerequisites (README.md)
Node 24.x / npm 11.x (as measured), `gh auth login`, `.env.local` (see ENV_SETUP.md; Vercel
dashboard is the source of truth — CLAUDE.md OPS NOTES), Codex: `codex exec --sandbox
workspace-write` from the repo root. Shallow clone → `git fetch --unshallow` before reading
history (`git show 16c25da:primer.md`).

## feature_list.json schema
```
{ "project": "vetree", "last_updated": "YYYY-MM-DD", "rules": {...}, "status_legend": {...},
  "features": [ {
    "id": "search-001", "priority": 1, "area": "search",
    "type": "feature|fix|chore|investigation", "title": "...",
    "user_visible_behavior": "...",
    "status": "not_started|in_progress|blocked|passing|merged",
    "verification": [ { "step": "...", "target": "local|preview|production|none",
                        "db_reads": "none|prod", "db_writes": "none|prod",
                        "paid_calls": false } ],
    "evidence": [ { "date": "...", "session": "<session id>", "sha": "<PR head SHA>",
                    "command": "...", "target": "...", "outcome": "pass|fail",
                    "approval": "Roi OK for prod writes, 2026-..-.. (scope)" , "link": "..." } ],
    "branch": "", "pr": null,
    "head_sha": "<last pushed head of the branch>",
    "wip_sha": null,
    "expected_failures": [ { "check": "tsc|lint|build", "file": "...", "code": "TS2322",
                             "message": "..." } ],
    "notes": "" } ] }
```
Lifecycle: not_started → in_progress → passing (verified on the PR head, evidence recorded, PR
awaits Roi) → merged (detected at session start). blocked from any state, reason in notes.
Rules: one in_progress at a time; never edit an item to hide unfinished work.

## Session entry format (primer Recent Sessions + session-log.md)
Session <id> · date · agent (Claude Code / Codex) · item id
- Goal / Completed
- Start state: branch, base SHA, dirty files
- Verification: exact commands + target + outcome; tested SHA
- Review: the other agent's result
- Commits / PR / WIP commit (if any)
- Pending Roi approvals
- Known risks / unresolved
- Next best step

## New primer (docs/harness/primer.md on harness-state)
Sections:
1. Current Verified State — repo root, startup, verification (init.sh), last verified commit +
   date, highest-priority item, blocker, open PRs awaiting Roi.
2. Active Focus / Open Issues & Known Risks — as of PR #108.
3. History — PRs #7–#108 grouped by area. #7–#24 condensed from the old primer; #25–#108 drafted
   from git log + PR bodies; every "current state" claim checked against the code.
4. Hard-Won Lessons — kept.
5. Incident notes — July root-cause narratives incl. causal chains (PR #23's 422 over-correction →
   PR #24).
6. Platform at a Glance — services, schedules, emails (checked against today's workflows).
7. Recent Sessions — latest few entries (all also in session-log.md).
Pointer at the top: "Pre-harness primer: root primer.md on main (frozen, superseded banner)."
Inventory before rewrite (Roi approves): every FACT in the old primer → {keep | already in
CLAUDE.md (cite line) | obsolete (cite superseding commit/code)}.

## Rollout
0. Repair node_modules — DONE 2026-10-04.
   (Step 2 — DONE 2026-10-04, see Appendix A.)
1. Codex plan review to `BLOCKING: none`. (Rounds 1–2 done → v4.)
2. Measure baseline on 16c25da: tsc / lint / build, timings, effects, tsc-before-build on a
   clean checkout (`git worktree` of 16c25da without .next), skipped install scripts.
3. Primer fact inventory + history draft → Roi approves.
4. Main-side files on chore/agent-harness: AGENTS.md, CLAUDE.md edits, primer.md banner,
   README.md, init.sh, DESIGN.md (this plan + rollout checklist; each completed step is ticked
   with its artifact SHA as it happens, committed on the branch).
5. Orphan harness-state built locally: vercel.json, README, new primer, feature_list (empty
   features[]), session-log. One-time bootstrap commit, Roi-authorized: includes root README.md and
   vercel.json (outside the routine docs/harness/** exemption); reviewed by Codex together with the
   main-side diff; no build (no package on the orphan). The state README names the rollout branch
   (chore/agent-harness) and PR while rollout is incomplete.
5b. With the state worktree populated: re-run tsc / lint / build to confirm isolation.
6. ASK Roi before the first push of harness-state.
7. Vercel check: first validate the query on a KNOWN deployment (a recent main SHA must be found,
   HTTP 200, project prj_bntAoER3SkgEdv6LSN7y0Mu1bxzd / team_Zn1w6zVJnUDjMkSrvkclgsUW), using the
   same lookup as qa-smoke-pr.yml:113 (`meta-githubCommitSha`) or the documented v7 `sha` filter.
   (For the known-main lookup, drop `target=preview`.) Then, after the push, poll every 60 s for
   10 min for any deployment of the pushed SHA in any state (queued/building/ready/error/canceled).
   Fail-closed: every poll must return HTTP 200 and a valid deployments array, or the check fails.
   Plus `gh run list --branch harness-state`. Any deployment → stop, tell
   Roi (fallback: ignored build step in the dashboard = his call). Only after a clean check do
   routine state pushes begin.
8. Dry run of the full loop on throwaway items. Bootstrap exception: these sessions run before the
   rules PR merges, so test branches descend from the chore/agent-harness rules commit (SHA
   recorded in DESIGN.md), not origin/main. Afterwards each throwaway item is REMOVED from
   feature_list.json (its full record stays in session-log.md) so RESUME FIRST can never pick it;
   the local test branches and the scratch clone are deleted only after that removal is PUSHED.
   Every case's outcome (pass/fail + evidence) is recorded in DESIGN.md's rollout checklist.
   a) `harness-dryrun-001` (state edits only): start, lock, claim, entry, release, push;
   b) `harness-dryrun-002` on a LOCAL-ONLY throwaway branch `chore/harness-dryrun` (never pushed —
      a push would trigger a Vercel preview build; deleted afterwards): a deliberately red WIP
      commit whose recorded failures include an error in an UNTOUCHED consumer file → a NEW session
      must resume it (expected-WIP path). Then, separately: (i) same `wip_sha`, signature list
      missing one real error → stop; (ii) HEAD ≠ `wip_sha` → stop; (iii) an unparseable build
      failure → stop. (Resume's fetch/pull steps are skipped for this local branch;
      the state commits for this item are still pushed.)
   c) a controlled stop releases the lock; a simulated crash leaves it and the next session stops;
      a simulated failed push (lock, claim, release — e.g. push to an unreachable remote URL)
      leaves the local commit and the next init.sh reports it with the remote lock owner;
      lost-branch recovery from a recorded `head_sha` (local throwaway branch deleted).
   d) fresh clone: `git clone` into the scratch dir, then `git switch --detach <rules SHA>` (main
      lacks the harness until merge) (no local harness-state, no worktree, no
      node_modules, no .next; `.env.local` copied in, and the clone deleted afterwards): `--check-git`, `state`, `check` must work
      end to end (also settles tsc-before-build ordering).
   Run by Claude Code, then Codex (`workspace-write`, from root and from a subdirectory) — start,
   lock, claim, entry, release, push; plus one reviewer-mode Codex invocation that must refuse the
   loop. The throwaway item is then marked and kept in session-log (not deleted).
9. Before the PR: write the rollout outcomes into README.md (working Codex invocation +
   --check-git result, AGENTS.md discovery behaviour, Vercel result, check order, recovery cases).
   Codex review of the main-side diff; draft PR (docs-only → smoke should skip; verify). Merge on
   Roi's word. No ordinary item sessions before that merge — main must carry the rules first.
10. Session 001 = backlog session with Roi.

---

## Appendix A — baseline measurement (step 2)

Machine: Node v24.21.0, npm 11.19.0.
(Restored 2026-10-05 after a reboot cleared /tmp; the raw logs were lost and will be regenerated
when lint-baseline.json is built in step 4. The numbers below were recorded before the loss.)

| Check | Result | Time | Notes |
|---|---|---|---|
| `npx tsc --noEmit` (main checkout, stale .next from 2026-09-20) | PASS, 0 errors | 25 s | |
| `npx tsc --noEmit` (clean checkout: no .next, no next-env.d.ts) | PASS, 0 errors | 23 s | tsc does not need build output → tsc can run before build |
| `npm run lint` | FAIL: 253 problems (178 errors, 75 warnings) | 31 s | Lint is not run in any CI workflow; long-standing debt → D9 ratchet |
| `npm run build` | PASS | 82 s | Read production Supabase (6 sitemap shards + SSG pages, 129 static pages); wrote nothing tracked |

Lint errors by rule: no-explicit-any 103, no-require-imports 37, react/no-unescaped-entities 17,
React Compiler hook rules ~16 (setState in effect, impure call in render, component created in
render, variable used before declared), prefer-const 2, 3 in docs/design_handoff mockups.
Worth a look (possible real bugs): lib/hooks/useFollowedTags.ts:16 (used before declared),
components/onboarding/Onboarding.tsx:288 (component created during render), app/page.tsx:91
(impure function during render).
Lint scope issue: it lints docs/design_handoff_vetree_redesign/** and .github/workflows/scripts/**.

Skipped npm install scripts (esbuild, @sentry/cli, unrs-resolver, protobufjs, fsevents, @google/genai):
no effect on tsc / lint / build.

Build warnings (non-failing, pre-existing): Sentry wants `onRouterTransitionStart` export in
instrumentation-client.ts; Next 16 "middleware" → "proxy" deprecation; 7x Turbopack "dynamic
filesystem access traces the whole project" (app/api/admin/security/scan/route.ts:757 reads source
files at runtime).

Full baseline time: ~2.3 min (tsc 25 s + lint 31 s + build 82 s), plus npm ci (~60 s) when deps change.
Repo after: clean, one worktree, HEAD 16c25da.

---

## Appendix B — Codex plan-review log (step 1)

All runs: `codex exec --sandbox read-only` (codex-cli 0.155.1) in a visible Terminal.app window, from ~/dev/vetree.
The verbatim review files were lost when a reboot cleared /tmp on 2026-10-05; this log was
rewritten from the session transcript. Every finding was verified against the repo before acting.

| Round | Plan | Blocking | Non-blocking | Verdict |
|---|---|---|---|---|
| 1 | v2 | 4 | 6 | build rule vs --quick; local ≠ isolated (shared prod DB, specs write/pay); picker abandons unfinished work; no durable handoff across unmerged branches |
| 2 | v3 | 5 | 6 | concurrent sessions overwrite state; worktree setup/Codex sandbox outside repo; bootstrap gap before rules merge; D4 not scoped in CLAUDE.md; Vercel check could pass falsely |
| 3 | v4 | 2 | 6 | patch-file handoff lossy; Codex deferred-commit fallback contradicts lock/claim protocol |
| 4 | v5 | 2 | 6 | red WIP commit can't resume under stop-on-red; --check-git fails on fresh clone (no local branch) |
| 5 | v6 | 1 | 5 | expected-WIP by file location is wrong (shared type breaks untouched consumer) → use recorded signatures |
| 6 | v7 | 0 | 6 | **BLOCKING: none** — refinements folded into v8 |

Total: 14 blocking issues found and fixed. Owner decisions taken along the way: D4–D8 (see plan).
