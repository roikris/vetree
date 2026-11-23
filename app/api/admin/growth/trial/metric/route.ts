export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { trialAdminGate, trialDbError } from '@/lib/growth/trialAdmin'

// PATCH /api/admin/growth/trial/metric — Roi's per-post LinkedIn numbers for a trial post (growth-005):
// { approval_id, kind: 'comments' | 'impressions', value }. Comments = audience comments (his own link comment and
// replies excluded), entered at >= 24 h; impressions as LinkedIn shows them, at >= 7 days. Editable any time.
export async function PATCH(request: NextRequest) {
  try {
    const denied = await trialAdminGate()
    if (denied) return denied
    const body = await request.json().catch(() => null)
    const value = Number(body?.value)
    if (typeof body?.approval_id !== 'string' || !['comments', 'impressions'].includes(body?.kind) || !Number.isInteger(value) || value < 0) {
      return NextResponse.json({ error: 'approval_id, kind (comments | impressions) and a whole number >= 0 are required' }, { status: 400 })
    }
    const { data, error } = await createAdminClient().rpc('record_trial_linkedin_metric', {
      p_approval_id: body.approval_id, p_kind: body.kind, p_value: value,
    })
    if (error) return trialDbError(error.message)
    return NextResponse.json({ success: true, ...(data as Record<string, unknown>) })
  } catch (error) {
    console.error('[trial/metric] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to save the number' }, { status: 500 })
  }
}
