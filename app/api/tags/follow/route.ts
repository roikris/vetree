import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FOLLOWABLE_TAGS = new Set([
  'Cardiology', 'Oncology', 'Soft Tissue Surgery', 'Orthopedics', 'Dermatology', 'Neurology',
  'Internal Medicine', 'Small Animal', 'Large Animal', 'Equine', 'Exotic', 'Emergency', 'Anesthesia',
  'Radiology', 'Pathology', 'Pharmacology', 'Nutrition', 'Behavior', 'Reproduction', 'Ophthalmology',
  'Dentistry',
])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
    }

    const body = await request.json()
    const { tag } = body

    // Only Vetree's article label vocabulary (the enrichment label list) can be followed — an
    // arbitrary string would land in followed_tags, digest matching and the digest's text
    if (typeof tag !== 'string' || !FOLLOWABLE_TAGS.has(tag)) {
      return NextResponse.json({ error: 'Unknown tag' }, { status: 400 })
    }

    // Upsert followed tag
    const { error } = await supabase
      .from('followed_tags')
      .upsert({
        user_id: user.id,
        tag: tag
      }, {
        onConflict: 'user_id,tag'
      })

    if (error) {
      console.error('[follow-tag] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get updated list of followed tags
    const { data: followedTags } = await supabase
      .from('followed_tags')
      .select('tag')
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      followedTags: followedTags?.map(ft => ft.tag) || []
    })

  } catch (error) {
    console.error('[follow-tag] Error:', error)
    return NextResponse.json({ error: 'Failed to follow tag' }, { status: 500 })
  }
}
