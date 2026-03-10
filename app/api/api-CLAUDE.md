# API Routes Guide

## Standard Route Template
Every API route in this directory must follow this pattern:

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Initialize clients INSIDE the function (never at module level)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()

    // ... logic ...

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
```

## Route Index

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/enrich-articles` | POST | Trigger PubMed enrichment pipeline | GitHub Action |
| `/api/enrich-failed` | POST | Re-queue failed articles (force_retry) | Admin |
| `/api/delete-account` | POST | GDPR full account deletion | User session |
| `/api/growth/generate-post` | POST | AI content agent — generates social post | Admin |
| `/api/growth/feedback` | POST | Save approve/skip feedback for agent | Admin |
| `/api/growth/stats` | GET | Agent learning stats | Admin |
| `/api/analytics/track` | POST | Log page view (hashed IP) | Public |
| `/api/analytics/search` | POST | Log search query | Public |

## Common Patterns

### Get authenticated user
```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Check admin
```ts
const { data: role } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single()
if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Trigger GitHub Action
```ts
await fetch(`https://api.github.com/repos/roikris/vetree/actions/workflows/WORKFLOW.yml/dispatches`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_PAT}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ref: 'main' }),
})
```

### Rate limiting (Upstash)
```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
})
const { success } = await ratelimit.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

## Error Status Codes
- `400` — Bad request (missing/invalid params)
- `401` — Not authenticated
- `403` — Not authorized (not admin)
- `404` — Resource not found (NOT for application logic errors)
- `429` — Rate limited
- `500` — Server/DB/API error (use this for application logic failures)
