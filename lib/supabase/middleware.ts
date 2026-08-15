import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  })

  // Anonymous visitors have no Supabase auth cookie to validate — skip the
  // getUser() round-trip entirely instead of paying a Supabase call just to
  // learn "no session" for every logged-out request (the majority of
  // traffic). Cookie name is `sb-<project-ref>-auth-token`, chunked as
  // `.0`/`.1`/... for large tokens — match on the stable substring rather
  // than hardcoding the project ref.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'))

  if (!hasAuthCookie) {
    return { response: supabaseResponse, user: null }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refreshing the auth token. Returned alongside the response so middleware.ts
  // doesn't need its own second server client + getUser() call reading the
  // exact same incoming request cookies a second time — that redundant call
  // used to cost a full extra Supabase round-trip on every request for no
  // benefit (it could never see anything this call didn't).
  const { data: { user } } = await supabase.auth.getUser()

  return { response: supabaseResponse, user }
}
