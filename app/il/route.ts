import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { getClientIP, ratelimitLoose } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// vetree.app/il — the Facebook IL Page's action button (social-001). Facebook limits some business / creator Pages to
// two external links a month, so the daily Facebook IL post carries no link at all; its last line points readers to the
// Page button, which sends them here. Every day ONE article is posted to EVERY platform ("Generate All"; the daily
// platform rotation is deprecated), so today's article = the one most recently marked as posted on ANY platform
// (Growth OS "Copy & mark posted" → growth_agent_memory, outcome 'approved'). The record's platform label is not used:
// the main button still labels it with the rotation's platform. Tagged so analytics still attribute the visit to
// Facebook IL. A hidden article, no post yet, or any error → the home page (same tags), never an error page.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://vetree.app'
const UTM = 'utm_source=facebook&utm_medium=social&utm_campaign=il&utm_content=page-button'

function go(path: string) {
  const res = NextResponse.redirect(`${SITE}${path}?${UTM}`, 307)
  // the target changes every day: never let a browser, Facebook's in-app browser or a CDN keep an old one
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function GET(request: NextRequest) {
  try {
    // inside the try: a limiter outage (Redis) also ends on the home page, reported, never on an error page
    const { success } = await ratelimitLoose.limit(`il:${getClientIP(request)}`)
    if (!success) return go('/')

    const supabase = createAdminClient()
    const { data: post, error } = await supabase
      .from('growth_agent_memory')
      .select('article_id')
      .eq('outcome', 'approved')
      .not('article_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`growth_agent_memory read failed (${error.code})`)
    if (!post?.article_id) return go('/')

    // Only an article readers can actually see (Public Article Filter, supabase/CLAUDE.md)
    const { data: article, error: aErr } = await supabase
      .from('articles')
      .select('id')
      .eq('id', post.article_id)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .maybeSingle()
    if (aErr) throw new Error(`articles read failed (${aErr.code})`)
    if (!article) return go('/')

    return go(`/article/${encodeURIComponent(article.id)}`)
  } catch (e) {
    Sentry.captureException(e)
    return go('/')
  }
}
