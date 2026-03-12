# API Routes Guide

## Standard Template
```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    // logic
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
```

## Route Index
| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/enrich-articles` | POST | PubMed enrichment | GitHub Action |
| `/api/enrich-failed` | POST | Re-queue failed articles | Admin |
| `/api/delete-account` | POST | GDPR deletion | User session |
| `/api/growth/generate-post` | POST | AI content agent | Admin |
| `/api/growth/feedback` | POST | Approve/skip feedback | Admin |
| `/api/growth/stats` | GET | Agent learning stats | Admin |
| `/api/analytics/track` | POST | Log page view | Public |
| `/api/analytics/search` | POST | Log search query | Public |
| `/api/digest/send` | POST | Send weekly email | DIGEST_SECRET |
| `/api/tags/follow` | POST | Follow a tag | User |
| `/api/tags/unfollow` | DELETE | Unfollow a tag | User |
| `/api/stats/public` | GET | Public user/article counts | Public |

## Common Patterns

### Get user
```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Check admin
```ts
const { data: role } = await supabase
  .from('user_roles').select('role').eq('user_id', user.id).single()
if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Trigger GitHub Action
```ts
await fetch(`https://api.github.com/repos/roikris/vetree/actions/workflows/WORKFLOW.yml/dispatches`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.GITHUB_PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ref: 'main' }),
})
```

### Rate limiting
```ts
import { ratelimitModerate } from '@/lib/ratelimit'
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
const { success } = await ratelimitModerate.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

### Send email (Resend)
```ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'Vetree <digest@digest.vetree.app>',
  to: user.email,
  subject: '🌿 Your Vetree Weekly Digest',
  html: emailHtml,
})
```

## Content Agent — generate-post flow
1. Fetch preferences from `growth_agent_preferences`
2. Fetch articles (exclude shown, exclude large animal in JS)
3. Weighted random by recency (exponential decay)
4. Call Claude Sonnet with platform-specific prompt
5. Check for SKIP_LARGE_ANIMAL response → retry up to 3x
6. Check length limits (twitter ≤ 280, whatsapp ≤ 400)
7. Embed UTM in article URL
8. Return { post_content, article_id, article_title, article_url, labels, hook_line }

## Platform Rules (for prompts)
```ts
const platformRules = {
  twitter: 'MAX 280 chars total. One hook + one insight. Ruthless brevity.',
  linkedin: 'Rhythm: short→long→short. 150-300 words. No bullets. Human voice.',
  facebook: 'Conversational, 100-200 words. Personal tone.',
  facebook_il: 'Same as facebook but Hebrew. Natural clinical Hebrew.',
  whatsapp: 'Very short, casual. 50-80 words max. Hebrew for IL.',
  instagram: 'Hook + insight + hashtags. 100-150 words.',
  telegram: 'Informative. 100-150 words. Slightly technical ok.',
}
```
