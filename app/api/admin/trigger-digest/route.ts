export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Trigger digest send with server-side DIGEST_SECRET
    const digestResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'}/api/digest/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DIGEST_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ triggered_by: 'admin-manual' })
    })

    if (!digestResponse.ok) {
      const errorText = await digestResponse.text()
      throw new Error(`Digest API error: ${errorText}`)
    }

    const result = await digestResponse.json()

    return NextResponse.json(result)

  } catch (error) {
    console.error('[admin/trigger-digest] Error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger digest', details: String(error) },
      { status: 500 }
    )
  }
}
