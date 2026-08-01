import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
