# Review checklist — read this instead of all three CLAUDE.md files

The reviewer is always the **other** agent (D10): Claude Code worked → Codex reviews; Codex
worked → Claude Code reviews. This page keeps reviews thorough where it matters and cheap where it
doesn't (D11, Roi 2026-10-05). Every Codex run costs ~15k tokens before it reads anything, and a
full-diff round cost 85k–190k during the rollout, so fewer, better-aimed rounds save the most.

## 1. Pick the tier

| Tier | When | Review |
|---|---|---|
| **0 — none** | `harness-state` commits (CLAUDE.md exception 1); typo / formatting fixes that cannot change meaning, **never in a sensitive file** | none |
| **1 — light** | small change (≈ under 150 changed lines) touching **no** sensitive area | **one** focused round, `model_reasoning_effort="medium"`; a second round only if round 1 reports BLOCKING |
| **2 — full** | **any** sensitive area (list below), whatever the size | loop until `BLOCKING: none`, `model_reasoning_effort="high"`, **max 3 rounds** |
| **2 — full, medium effort** | a large change (≈ 150+ changed lines) touching **no** sensitive area | loop until `BLOCKING: none`, `model_reasoning_effort="medium"`, **max 3 rounds** |

**Sensitive areas** (Roi, 2026-10-05): auth / sessions · Supabase writes and migrations
(`supabase/migrations/**`, `.insert/.update/.upsert/.delete`, RPCs that write) · security and
secrets (env vars, `security-acknowledged.json`, headers, rate limits) · paid AI calls (anything
calling Claude or another model) · email sending (Resend, digest) · the harness itself
and every rule or policy document: `CLAUDE.md`, `app/api/CLAUDE.md`, `supabase/CLAUDE.md`,
`AGENTS.md`, and the harness rules under `docs/harness/` on `main` (scripts, README, this
checklist, DESIGN). **A sensitive area always overrides tiers 0 and 1** — except the state files
on the `harness-state` branch (primer.md, feature_list.json, session-log.md, session.lock), which
keep CLAUDE.md exception 1 (no review). Unsure → treat it as sensitive.

## 2. Rounds

- **Round 1** reviews the change: `git diff origin/main...HEAD` (or the named commits).
- **Round 2 and later review only what changed since the last reviewed commit**
  (`git diff <last-reviewed-sha>..HEAD`) plus the previous round's findings — never the whole
  diff again.
- **Cap: 3 rounds.** Still BLOCKING after round 3 → stop patching: the design is probably wrong
  (CLAUDE.md rule 14 in spirit). Write down what keeps failing and ask Roi before going on.
- The worker verifies each finding before acting on it (CLAUDE.md), with targeted reads — not by
  re-reading everything.

## 3. Give the reviewer a lean context

Pass: the diff (or the commit range), this checklist, and **only the CLAUDE.md sections the change
touches** (by heading). Do not ask a reviewer to read all three CLAUDE.md files (1,400+ lines).

The critical rules in one line each — the full text is in CLAUDE.md under the same number:

0. Every Claude call uses `CLAUDE_MODEL` from `lib/ai/model.ts` (Sonnet 4.6); never Haiku. Exception:
   `scripts/*.mjs` and `.github/workflows/scripts/*.js` can't import TS and repeat the same model ID.
1. API routes export `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration` for heavy work.
2. SDK / Supabase clients are created **inside** the handler, never at module level.
3. Admin routes use the service-role key.
4. Large-animal filtering is done in JS, not in Supabase queries.
5. Nullable columns: `.or('col.is.null,col.neq.X')`, never a bare `.neq()`.
6. Status codes: 404 = route not found only; 500 data errors; 429 rate limit; 401 / 403 auth.
7. Claude JSON replies: strip markdown fences before `JSON.parse`.
8. Article lists never `select('*')`; `summary` is fetched lazily.
9. Protected routes: server client + `getUser()` → 401; admin via `user_roles` `.maybeSingle()` → 403;
   user-facing routes also require `email_confirmed_at`.
10. Analytics queries exclude admin + test user via `excludedUsersOrFilter()`.
11. Server code never imports `@/lib/supabase/client`.
12. Save / unsave goes through `fetch('/api/save-article')`, not a server action.
13. Rate limiting is a no-op outside production only; production fails loud.
14. 3 fixes to one area in 7 days → before a 4th patch, present the rebuild-vs-patch assessment and
    get Roi's explicit go-ahead on the chosen path.
15. Schema changes only as migration files; `db push` needs Roi's yes.
16. `security-acknowledged.json` changes only with Roi's sign-off.
Also: never log emails or pass user text / request bodies to Sentry; the CLAUDE.md branch / PR /
merge policy and its two exceptions.

## 4. Ask for short output

Reviewer output is only:

```
BLOCKING: numbered, each with file:line evidence — or exactly `BLOCKING: none`
NON-BLOCKING: numbered, one or two lines each
```

No command logs, no restating the change, no VERIFIED section unless asked.

## 5. Record the cost

The session entry's Review line names the reviewer, the tier, rounds and tokens, e.g.
`Review: Codex · tier 2 · 2 rounds · 36k + 41k tokens · BLOCKING: none`. Codex prints
"tokens used" at the end of each run; Claude Code shows its usage with `/cost`.

## 6. Prompt templates

**Codex reviews Claude Code's work** (own Terminal.app window, CLAUDE.md):

```
codex exec --sandbox read-only -c model_reasoning_effort="<medium|high>" \
  "You are a REVIEWER (read-only): do not run docs/harness/init.sh, take no lock, edit nothing.
   Tier <1|2>, round <n>. Review: <git diff origin/main...HEAD | git diff <last-sha>..HEAD>.
   Context: docs/harness/review-checklist.md and CLAUDE.md sections: <headings>.
   [Round ≥2: previous findings: <paste>. Say RESOLVED / NOT RESOLVED for each first.]
   Output only BLOCKING (file:line evidence, or exactly 'BLOCKING: none') and NON-BLOCKING."
```

**Claude Code reviews Codex's work:** start Claude Code in the repo and say

```
Review Codex's work as the reviewer (D10) — don't run the session routine. Tier <1|2>, round <n>:
<diff / commit range>. Use docs/harness/review-checklist.md. Output only BLOCKING / NON-BLOCKING.
```
