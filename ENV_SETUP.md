# Environment Variables Setup

This document lists all required environment variables for Vetree.

## Required Variables

### Supabase
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Sentry (Error Tracking)
```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn  # Same as above, for server-side
SENTRY_AUTH_TOKEN=your_sentry_auth_token  # For uploading source maps
```

**Setup Instructions:**
1. Create a Sentry account at https://sentry.io
2. Create a new project for "Next.js"
3. Copy the DSN from the project settings
4. Generate an auth token from Settings → Developer Settings → Auth Tokens
5. Add these to your Vercel environment variables

### Upstash Redis (Rate Limiting)
```bash
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

**Setup Instructions:**
1. Create an Upstash account at https://upstash.com
2. Create a new Redis database (choose the free tier)
3. Copy the REST URL and REST TOKEN from the database details
4. Add these to your Vercel environment variables

### PubMed API
```bash
NCBI_API_KEY=your_ncbi_api_key
```

**Setup Instructions:**
1. Create an NCBI account at https://www.ncbi.nlm.nih.gov/account/
2. Generate an API key from your account settings
3. Add this to your GitHub Secrets for the workflows

## Vercel Environment Variables

Add the following to your Vercel project settings → Environment Variables:

### Production & Preview & Development
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SITE_URL` (your production URL, e.g., https://vetree.app)

## GitHub Secrets

Add the following to your GitHub repository settings → Secrets and variables → Actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SLACK_WEBHOOK_URL` (for notifications)
- `NCBI_API_KEY`
- `ANTHROPIC_API_KEY` (for enrichment)

## Local Development

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Site URL (for local dev)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Sentry (Optional for local dev)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn

# Upstash Redis (Optional for local dev, can use mock)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

## Rate Limiting Behavior

If Upstash Redis env vars are not set, rate limiting will fail. Make sure to add them to production!

- Delete Account: Max 5 requests per IP per minute
- Auth endpoints: Max 10 requests per IP per minute (if implemented)

## Testing Environment Variables

To verify all env vars are set correctly:

1. Check Vercel deployment logs for any missing env var warnings
2. Check Sentry dashboard to see if errors are being tracked
3. Try hitting rate-limited endpoints to verify Upstash is working
4. Check GitHub Actions logs to verify workflow secrets are working
