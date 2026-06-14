export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Returns a 1-hour signed URL for a user's avatar.
// No auth required — signed URLs are scoped to a single file and expire.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const storagePath = `${userId}/avatar.jpg`
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 3600) // 1 hour TTL

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Avatar not found' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
