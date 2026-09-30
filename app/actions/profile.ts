'use server'

import { createClient } from '@/lib/supabase/server'
import { recordConsent } from '@/lib/consent/record'
import { ratelimitModerate } from '@/lib/ratelimit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function sendPasswordResetEmail() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Not authenticated' }
  }

  // NEXT_PUBLIC_SITE_URL is not set in Vercel — fall back to the hardcoded
  // production origin so Supabase never falls back to the dashboard Site URL.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${siteUrl}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function getUserStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { stats: null, error: 'Not authenticated' }
  }

  // Get total saved articles count
  const { count: totalSaved } = await supabase
    .from('saved_articles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get saved articles with their labels to find most common specialty
  const { data: savedArticles } = await supabase
    .from('saved_articles')
    .select(`
      articles (labels)
    `)
    .eq('user_id', user.id)

  // Count label occurrences
  const labelCounts: Record<string, number> = {}
  savedArticles?.forEach((item: any) => {
    const labels = item.articles?.labels || []
    labels.forEach((label: string) => {
      labelCounts[label] = (labelCounts[label] || 0) + 1
    })
  })

  // Find most common label
  let mostSavedLabel = null
  let maxCount = 0
  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostSavedLabel = label
    }
  }

  // Calculate days since account creation
  const createdAt = new Date(user.created_at)
  const now = new Date()
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  return {
    stats: {
      totalSaved: totalSaved || 0,
      mostSavedLabel,
      daysSinceCreation,
      memberSince: createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    error: null
  }
}

// "On" means: ever gave true consent AND hasn't since flipped the reversible
// digest_opt_out flag. Consent itself is an append-only audit log (never delete
// a past true row — that's the compliance record) — digest_opt_out is the actual,
// reversible on/off switch the send route checks first.
export async function getDigestConsentStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { optedIn: false, error: 'Not authenticated' }

  const [{ data: consents }, { data: prefs }] = await Promise.all([
    supabase.from('user_consents').select('marketing_opted_in').eq('user_id', user.id),
    supabase.from('user_preferences').select('digest_opt_out').eq('user_id', user.id).maybeSingle(),
  ])

  const everConsented = (consents || []).some(c => c.marketing_opted_in === true)
  const optedOut = prefs?.digest_opt_out === true

  return { optedIn: everConsented && !optedOut, error: null }
}

export async function setDigestConsent(optIn: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // user_consents is an append-only, service-role-written audit log. Record through the shared
  // writer with the SESSION user (the old server-to-server fetch to /api/auth/save-consent sent no
  // cookies, and that route is session-only now).
  // Server actions receive untrusted input at runtime (TypeScript doesn't validate it)
  if (typeof optIn !== 'boolean') return { error: 'Invalid value' }
  const { success } = await ratelimitModerate.limit(`consent:${user.id}`)
  if (!success) return { error: 'Too many requests' }

  const h = await headers()
  const consent = await recordConsent({
    userId: user.id,
    termsAccepted: true, // already true — settings is only reachable by an active, terms-accepted user
    marketingOptIn: optIn,
    consentSource: 'settings',
    marketingLanguage: 'en', // the profile settings page is English-only
    // Audit metadata only (ownership is the session). Trustworthy only as far as the ingress
    // (Vercel) sets these headers.
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
  })
  if (!consent.ok) {
    return { error: 'Failed to record consent' }
  }

  const { error: prefError } = await supabase.from('user_preferences').upsert(
    {
      user_id: user.id,
      digest_opt_out: !optIn,
      digest_opted_out_at: optIn ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (prefError) return { error: prefError.message }

  revalidatePath('/profile')
  return { error: null }
}
