import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifyToken(userId: string, token: string): boolean {
  const secret = process.env.DIGEST_SECRET || ''
  const expected = createHmac('sha256', secret).update(userId).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

function htmlPage(success: boolean, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${success ? 'Unsubscribed' : 'Error'} — Vetree</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f9fafb; margin: 0; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px; max-width: 420px;
            width: 100%; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #1a1a1a; margin: 0 0 12px; }
    p  { font-size: 15px; color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
    a  { display: inline-block; padding: 12px 24px; background: #3D7A5F;
         color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; }
    a:hover { background: #2F5F4A; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Unsubscribed' : 'Something went wrong'}</h1>
    <p>${message}</p>
    <a href="https://vetree.app">Back to Vetree</a>
  </div>
</body>
</html>`
  return new NextResponse(html, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// GET — called from email unsubscribe link (?uid=...&token=...)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  if (!uid || !token) {
    return htmlPage(false, 'Invalid unsubscribe link. Please contact support if the problem persists.')
  }

  if (!verifyToken(uid, token)) {
    return htmlPage(false, 'This unsubscribe link is invalid or has expired.')
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('followed_tags')
    .delete()
    .eq('user_id', uid)

  if (error) {
    console.error('[unsubscribe-all] DB error:', error)
    return htmlPage(false, 'We couldn\'t process your request. Please try again or contact support.')
  }

  return htmlPage(true, 'You\'ve been unsubscribed from all Vetree digest emails. You can re-subscribe any time from your profile.')
}

// POST — kept for any internal/programmatic use (still requires session)
export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { error } = await supabase
      .from('followed_tags')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('[unsubscribe-all] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Unsubscribed from all tag digests' })

  } catch (error) {
    console.error('[unsubscribe-all] Error:', error)
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
  }
}
