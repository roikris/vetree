# GitHub Actions Workflows

This directory contains automated workflows for the Vetree project.

## Setup

### 1. Run Database Migration

Before using these workflows, run the migration to add required columns:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Open `supabase/migrations/002_add_enrichment_columns.sql`
4. Copy and paste the SQL into the editor
5. Click **Run**

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repo: https://github.com/roikris/vetree
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret** and add:

   - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (found in Project Settings → API)
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (get one at https://console.anthropic.com/)

**Important**: Use the **service role key**, not the anon key, as these workflows need admin access.

## Workflows

### 1. Daily PubMed Sync (`daily-sync.yml`)

**Schedule**: Daily at 6:00 AM UTC

**What it does**:
- Searches PubMed for articles from the last 5 days in 16 veterinary journals
- Normalizes journal names using a standardized mapping
- Checks for duplicates (by PubMed ID)
- Saves new articles to Supabase with `needs_enrichment: true`
- Processes in batches of 20 with 2-second delays

**Manual trigger**:
```bash
# Via GitHub UI: Actions → Daily PubMed Sync → Run workflow
```

### 2. Enrich Articles (`enrich-articles.yml`)

**Schedule**: Daily at 7:00 AM UTC (1 hour after sync)

**What it does**:
- Fetches up to 50 articles where `needs_enrichment = true`
- Uses Claude Haiku to generate:
  - Comprehensive summary (150-250 words)
  - Clinical bottom line (one sentence)
  - Labels (3-5 from allowed list)
  - Strength of evidence classification
  - Corrected authors (if duplicates found)
- Validates labels against allowed list
- Strike system: 3 attempts max, then gives up
- Waits 1 second between articles

**Manual trigger**:
```bash
# Via GitHub UI: Actions → Enrich Articles → Run workflow
```

### 3. Fix HTML Encoding (`fix-encoding.yml`)

**Trigger**: Manual only

**What it does**:
- Scans articles for HTML entities (&#x..., &#...)
- Decodes entities in: authors, title, clinical_bottom_line, summary
- Only updates articles where changes detected
- Processes max 50 articles per run
- Waits 50ms between updates

**Usage**:
```bash
# Via GitHub UI: Actions → Fix HTML Encoding → Run workflow
```

### 4. Reset Enrichment Flag (`reset-enrichment.yml`)

**Trigger**: Manual only (one-time use)

**What it does**:
- Sets `needs_enrichment: false` for ALL articles
- Useful for disabling enrichment on existing articles
- Processes in batches of 1000

**Usage**:
```bash
# Via GitHub UI: Actions → Reset Enrichment Flag → Run workflow
```

## Allowed Labels

The enrichment workflow validates labels against this list:

- Cardiology
- Oncology
- Soft Tissue Surgery
- Orthopedics
- Dermatology
- Neurology
- Internal Medicine
- Small Animal
- Large Animal
- Equine
- Exotic
- Emergency
- Anesthesia
- Radiology
- Pathology
- Pharmacology
- Nutrition
- Behavior
- Reproduction
- Ophthalmology
- Dentistry

## Monitoring

### View Workflow Runs

1. Go to your repo's **Actions** tab
2. Click on a workflow name
3. View run history and logs

### Check Enrichment Status

Query Supabase to see enrichment progress:

```sql
-- Articles needing enrichment
SELECT COUNT(*) FROM articles WHERE needs_enrichment = true;

-- Articles by attempt count
SELECT enrichment_attempts, COUNT(*)
FROM articles
WHERE needs_enrichment = true
GROUP BY enrichment_attempts;

-- Recent enrichments
SELECT title, labels, strength_of_evidence, updated_at
FROM articles
WHERE needs_enrichment = false
ORDER BY updated_at DESC
LIMIT 10;
```

## Troubleshooting

### Daily sync finds 0 articles

- Check if the journals list matches PubMed's journal names exactly
- Verify the date range (default: last 5 days)
- Check workflow logs for API errors

### Enrichment fails

- Verify `ANTHROPIC_API_KEY` is valid
- Check API rate limits and quota
- Review logs for JSON parsing errors
- Articles that fail 3 times are automatically skipped

### Missing columns error

- Run the database migration: `002_add_enrichment_columns.sql`
- Verify columns exist: `SELECT needs_enrichment, enrichment_attempts FROM articles LIMIT 1;`

## Cost Estimates

### Anthropic API (Claude Haiku)

- ~$0.25 per 1M input tokens
- ~$1.25 per 1M output tokens
- Typical article enrichment: ~1,500 input + 400 output tokens
- Cost per article: ~$0.0009
- 50 articles/day: ~$0.045/day or ~$1.35/month

### PubMed API

- Free, no API key required
- Rate limit: ~3 requests/second
- Batching built in (20 articles per request)

## License

These workflows are part of the Vetree project.
