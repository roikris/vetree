export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { TRIAL_PLATFORMS, hasTakePlaceholder, textFeatures } from '@/lib/growth/trial'
import { hookLineOf } from '@/lib/growth/postProcess'
import { trialAdminGate, trialDbError } from '@/lib/growth/trialAdmin'
import { normalizePickSource, logPickSource } from '@/lib/growth/pickSource'
import * as Sentry from '@sentry/nextjs'

// POST /api/admin/growth/trial/mark — "Copy & mark posted" in 🧪 December Trial (growth-005). Body:
// { article_id, platform, final_text, comment_text? } — final_text is exactly what Roi copied (he may have edited it).
// One database call, record_trial_post() (migration 089): the approval row + the trial row in one transaction, the
// Israel day serialised, a second article that day refused (409), a platform posted outside the trial refused (409),
// a repeat returns the existing row (already_recorded). Date, variant and tracking token are set in SQL.
// growth-006: `pick_source` (how the day's article was chosen) is written onto the trial row AFTER that commit, best
// effort — a failed or slow write returns pick_logged: false, never an error (the post is already recorded).
export async function POST(request: NextRequest) {
  try {
    const denied = await trialAdminGate()
    if (denied) return denied

    const body = await request.json().catch(() => null)
    const articleId = typeof body?.article_id === 'string' ? body.article_id : ''
    const platform = typeof body?.platform === 'string' ? body.platform : ''
    const finalText = typeof body?.final_text === 'string' ? body.final_text.trim() : ''
    const commentText = typeof body?.comment_text === 'string' && body.comment_text.trim() ? body.comment_text.trim() : null
    const info = TRIAL_PLATFORMS.find(p => p.platform === platform)
    if (!articleId || !info || !finalText) {
      return NextResponse.json({ error: 'article_id, a trial platform and final_text are required' }, { status: 400 })
    }
    if (platform === 'linkedin' && hasTakePlaceholder(finalText)) {
      return NextResponse.json({ error: 'Rewrite the [YOUR TAKE …] line first' }, { status: 400 })
    }

    const features = textFeatures(finalText)
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('record_trial_post', {
      p_article_id: articleId,
      p_platform: platform,
      p_language: info.language,
      p_hook_line: hookLineOf(finalText),
      p_post_text: finalText,
      p_comment_text: commentText,
      p_char_count: features.char_count,
      p_ends_with_question: features.ends_with_question,
    })
    if (error) return trialDbError(error.message)
    const result = data as Record<string, unknown>
    const pickLogged = await logPickSource(supabase, result?.approval_id, normalizePickSource(body?.pick_source),
      () => Sentry.captureMessage('trial pick_source not logged', 'warning'))
    return NextResponse.json({ success: true, ...result, pick_logged: pickLogged })
  } catch (error) {
    console.error('[trial/mark] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Failed to record the trial post' }, { status: 500 })
  }
}

