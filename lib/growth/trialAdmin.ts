// The admin check shared by the December trial routes (growth-005): server client from cookies → 401 / 403
// (CLAUDE.md rule 9). Returns null when the caller is a confirmed admin, else the response to send.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function trialAdminGate(): Promise<NextResponse | null> {
  const cookieClient = await createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.email_confirmed_at) return NextResponse.json({ error: 'Email verification required' }, { status: 403 })
  const { data: role } = await cookieClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** record_trial_post / record_trial_linkedin_metric raise 'conflict: …' (409) or 'invalid: …' (400); anything else 500. */
export function trialDbError(message: string): NextResponse {
  const status = message.startsWith('conflict:') ? 409 : message.startsWith('invalid:') ? 400 : 500
  return NextResponse.json({ error: message.replace(/^(conflict|invalid):\s*/, '') }, { status })
}
