# GitHub Actions Workflows

Cron times and triggers verified directly from workflow YAML files.

## Workflow Inventory

### `daily-sync.yml` — Daily PubMed Sync
**Schedule:** 06:00 UTC daily | **Manual:** workflow_dispatch

Searches PubMed for articles from the last 5 days across 16+ veterinary journals.
Normalises journal names, deduplicates by PubMed ID, saves new articles with `needs_enrichment: true`.

---

### `enrich-articles.yml` — Enrich Articles
**Schedule:** 07:00 UTC daily (1 hour after sync) | **Manual:** workflow_dispatch

Fetches up to 50 articles where `needs_enrichment = true`. Calls Claude Sonnet to generate:
summary, clinical bottom line, labels (3–5), strength of evidence, corrected authors.
3-strike system — articles that fail 3× are quarantined.

---

### `weekly-digest.yml` — Weekly Email Digest
**Schedule:** Friday 10:00 UTC | **Manual:** workflow_dispatch

Calls `/api/digest/send` with DIGEST_SECRET bearer token.
Sends to all confirmed users who have not opted out (`user_preferences.digest_opt_out = false`).

---

### `analysis-agent.yml` — Analysis Agent
**Schedule (aggregate job):** 02:00 UTC daily + Friday 12:00 UTC | **Manual:** workflow_dispatch
**Schedule (insights job):** Friday 12:00 UTC only (or manual dispatch)

`aggregate` job (runs daily):
1. POST `/api/admin/analytics/aggregate` → upserts `analytics_daily_snapshot`
2. POST `/api/admin/analytics/signals` → upserts `analytics_signals`

`insights` job (runs Friday only):
1. POST `/api/admin/analytics/insights` → Claude Sonnet analysis → `analytics_insights` → Slack

Both jobs use DIGEST_SECRET bearer auth.

---

### `security-agent.yml` — Security Scan
**Schedule:** Thursday 19:00 UTC | **Manual:** workflow_dispatch

Calls POST `/api/admin/security/scan`. Runs 19+ checks, generates Claude Sonnet fix prompts,
posts findings to Slack, saves to `security_reports`.

---

### `qa-smoke.yml` — Production Smoke (job `smoke-production`)
**Schedule:** Mon–Sat 06:00 UTC (essentials), Sunday 06:00 UTC (full) | **Trigger:** push to `main` (essentials) | **Manual:** workflow_dispatch (choose `full` or `essentials`)

Runs Playwright against `https://vetree.app`. *Essentials* = every test not tagged `@weekly`;
*full* = everything. On `push`, it first polls `/api/version` until production serves the pushed
commit (or a later one containing it), up to 15 minutes — never tests the previous release.
After the run, `scripts/qa-triage.mjs` posts to Slack **only on failure or flaky results** (Claude
Sonnet triage for failures; runs that fail before any test also alarm), and the report is
uploaded as an artifact (7-day retention). Not a required check.

---

### `qa-smoke-pr.yml` — PR Smoke Suite (job `smoke` — the required check)
**Trigger:** pull_request to `main` (preview-gated)

Polls Vercel for the PR's preview deployment, checks it is behind Vercel Deployment Protection
(anonymous request → Vercel login), then runs the **full** suite against it.
`e2e/global-setup.ts` exchanges `VERCEL_AUTOMATION_BYPASS_SECRET` once for a preview-host cookie
(the secret is never sent to other origins). Job name `smoke` is the status check required by
branch protection on `main`. Previews share the production database; analytics writers record
nothing outside production.

---

### `growth-daily-reminder.yml` — Content Post Reminder
**Schedule:** 03:00 UTC daily (06:00 Israel time)

Posts a Slack reminder to generate and approve the day's content post.
todaysTask is determined by pure JS 90-day rotation, NOT from DB.

---

### `backfill-articles.yml` — Historical Import
**Trigger:** Manual (workflow_dispatch) only

Imports articles from a specified historical date range. One-off use.

---

### `reset-enrichment.yml` — Reset Enrichment Flags
**Trigger:** Manual only

Sets `needs_enrichment = true` for articles. Used to re-queue articles for re-enrichment.

---

### `fix-encoding.yml` — Fix HTML Entities
**Trigger:** Manual only

Decodes HTML entities (`&#x…`, `&#…`) in authors, title, clinical_bottom_line, summary.
Processes up to 50 articles per run.

---

## Required GitHub Secrets

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | All workflows that call Supabase directly |
| `SUPABASE_SERVICE_ROLE_KEY` | All workflows needing admin DB access |
| `ANTHROPIC_API_KEY` | enrich-articles, qa-smoke (triage), analysis-agent (insights), security-agent |
| `DIGEST_SECRET` | analysis-agent, security-agent, weekly-digest (bearer auth to API routes) |
| `SLACK_WEBHOOK_URL` | qa-smoke, analysis-agent, security-agent, growth-daily-reminder |
| `NCBI_API_KEY` | daily-sync (PubMed rate limit key) |
| `TEST_USER_EMAIL` | qa-smoke, qa-smoke-pr |
| `TEST_USER_PASSWORD` | qa-smoke, qa-smoke-pr |
| `VERCEL_TOKEN` | qa-smoke-pr (polls Vercel API for preview URL) |

All workflows require `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in env.
