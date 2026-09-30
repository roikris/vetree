// Server code only (uses the service role key); never import from client components.
import { createClient } from '@supabase/supabase-js'

/**
 * The only application writer of user_consents (append-only audit log; no INSERT policy, so
 * service role). Callers must already have established WHO the consent belongs to: the
 * signed-in, verified session (POST /api/auth/save-consent, profile settings). Email-signup
 * choices are held in the signing-up browser and recorded through that route by ConsentGate
 * once the verified owner is signed in — never before verification.
 *
 * consented_at is the recording time. A signup-source row that already exists (partial unique
 * index, migration 062) counts as already recorded, not an error.
 */
export const CONSENT_SOURCES = ['signup', 'in_app_prompt', 'settings'] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]
export { CURRENT_CONSENT_VERSION } from '@/lib/constants/consent'
import { CURRENT_CONSENT_VERSION } from '@/lib/constants/consent'

export async function recordConsent(input: {
  userId: string
  termsAccepted: boolean
  marketingOptIn: boolean
  consentSource: ConsentSource | null
  consentVersion?: string
  /** Language of the terms wording shown for this row (null: not shown) — migration 067 */
  termsLanguage?: 'en' | 'he' | null
  /** Language of the digest question asked for this row (null: not asked) */
  marketingLanguage?: 'en' | 'he' | null
  ip: string | null
  userAgent: string | null
}): Promise<{ ok: true; alreadyRecorded?: boolean } | { ok: false; error: string }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await supabase.from('user_consents').insert({
    user_id: input.userId,
    terms_accepted: input.termsAccepted,
    marketing_opted_in: input.marketingOptIn,
    consent_version: input.consentVersion ?? CURRENT_CONSENT_VERSION,
    consent_source: input.consentSource,
    terms_language: input.termsLanguage ?? null,
    marketing_language: input.marketingLanguage ?? null,
    consented_at: new Date().toISOString(),
    ip_address: input.ip,
    user_agent: input.userAgent,
  })
  if (error?.code === '23505') return { ok: true, alreadyRecorded: true }
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
