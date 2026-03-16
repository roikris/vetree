# Vetree — Rules for AI agents

This is a Next.js app deployed on Vercel (serverless). 
These rules exist because we already burned time learning them the hard 
way. 
Do not suggest changes that violate them.

## Hard rules — never break these

**Rule 1 — API route headers**
Every API route file must have these two lines at the top:
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
Never remove them. Never suggest removing them.

**Rule 2 — Client setup goes INSIDE the function**
This is the most common mistake. On Vercel, if you set up 
the Anthropic or Supabase client outside the function it causes a 404.

WRONG (breaks production):
const anthropic = new Anthropic(...)
export async function POST() { ... }

CORRECT:
export async function POST() {
  const anthropic = new Anthropic(...)
}

This applies to Anthropic, Resend, and any other service client.

**Rule 3 — Large animal filtering must happen in JavaScript, not in the 
database**
We filter out large animal articles (equine, livestock, poultry, etc.) 
after fetching from the database, not during the query. 
The Supabase array filter syntax is unreliable for this. 
Never move this filter into a Supabase query.

The JS filter looks like this:
const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal',
  'Livestock','livestock','Poultry','poultry','Food Animal','food animal']
const filtered = articles.filter(a => 
  !a.labels?.some((l) => LARGE_ANIMAL.includes(l)))

**Rule 4 — Nullable database columns**
Some columns can be NULL. When excluding a user from results, 
.neq() silently drops all NULL rows too — which is wrong.
Always use .or() instead:

WRONG: .neq('user_id', adminId)
CORRECT: .or(`user_id.is.null,user_id.neq.${adminId}`)

**Rule 5 — HTTP status codes**
404 = route doesn't exist (never use it for "no results found")
500 = something broke in the app or database
429 = rate limited
Do not change existing status codes.

**Rule 6 — Admin routes use the service role key**
Admin API routes must use SUPABASE_SERVICE_ROLE_KEY, not the anon key.
Never swap these.

## What this app does
Vetree aggregates veterinary research articles from PubMed, 
enriches them with AI-generated summaries, and serves them to vets.
The enrichment pipeline runs 6 times a day via GitHub Actions.
The growth/content agent generates social media posts about articles.

## Where to focus
The best areas to improve are:
- app/api/growth/generate-post (the social post generator)
- app/api/enrich-articles (the enrichment pipeline)
- lib/ratelimit.ts (rate limiting utilities)

## What to leave alone
- middleware.ts (handles auth — very sensitive)
- Any Supabase RLS policies
- The UTM tracking parameters in article URLs
```

