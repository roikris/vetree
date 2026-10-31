// Admin → Analytics → Google Search (analytics-001, migration 088). Read-only.
// Search Console figures come from the daily import (.github/workflows/search-console.yml); our own figures for the
// same pages come from page_views (humans only, admin / test excluded). See CLAUDE.md "Metrics".
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'
import { LIKELY_HUMAN_OR, readAll } from '@/lib/analytics/readAll'
import {
  SEARCH_CONSOLE_RANGES, LOCAL_HOSTS, addDays, articleIdFromPath, isGoogleReferrer, median, pacificMidnightUtc,
} from '@/lib/analytics/searchConsole'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TOP = 25

type SummaryPage = { page_url: string; host: string; path: string; clicks: number; impressions: number; ctr: number | null; position: number | null }
type Summary = {
  from: string; to: string
  daily: { day: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[]
  totals: { clicks: number; impressions: number; position: number | null }
  queries: { query: string; clicks: number; impressions: number; ctr: number | null; position: number | null }[]
  pages: SummaryPage[]
  incomplete_days: { day: string; status: string; query_truncated: boolean; page_truncated: boolean }[]
}

export async function GET(request: Request) {
  try {
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: role, error: roleError } = await cookieClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (roleError) return NextResponse.json({ error: 'Role check failed' }, { status: 500 })
    if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const days = Number(new URL(request.url).searchParams.get('days') ?? '28')
    if (!(SEARCH_CONSOLE_RANGES as readonly number[]).includes(days)) {
      return NextResponse.json({ error: 'days must be 7, 28 or 90' }, { status: 400 })
    }

    const db = createAdminClient()

    // The window: N consecutive Pacific dates ending at the latest successfully imported day
    const { data: latest, error: latestError } = await db.from('search_console_import_days')
      .select('day').eq('status', 'ok').order('day', { ascending: false }).limit(1).maybeSingle()
    if (latestError) throw new Error(`import days: ${latestError.message}`)
    if (!latest) return NextResponse.json({ empty: true })
    const to = latest.day as string
    const from = addDays(to, -(days - 1))

    const { data: summary, error: summaryError } = await db.rpc('search_console_summary', { p_from: from, p_to: to, p_limit: TOP })
    if (summaryError) throw new Error(`summary: ${summaryError.message}`)
    const s = summary as Summary

    // Our own views of the top vetree.app pages over the same dates (UTC bounds of the Pacific days — approximate)
    const localPages = s.pages.filter(p => LOCAL_HOSTS.has(p.host))
    const paths = [...new Set(localPages.map(p => p.path))]
    const local = new Map<string, { googleViews: number; durations: number[]; unmeasured: number }>()
    if (paths.length) {
      const startUtc = pacificMidnightUtc(from)
      const endUtc = pacificMidnightUtc(addDays(to, 1))
      const rows = await readAll<{ path: string; referrer: string | null; duration_seconds: number | null }>('page_views', (a, b) =>
        db.from('page_views').select('path, referrer, duration_seconds')
          .in('path', paths).gte('created_at', startUtc).lt('created_at', endUtc)
          .is('bot_name', null).or(excludedUsersOrFilter()).or(LIKELY_HUMAN_OR)
          .order('created_at').order('id').range(a, b))
      for (const r of rows) {
        if (!isGoogleReferrer(r.referrer)) continue
        const m = local.get(r.path) ?? { googleViews: 0, durations: [], unmeasured: 0 }
        m.googleViews++
        if (r.duration_seconds == null) m.unmeasured++
        else m.durations.push(r.duration_seconds)
        local.set(r.path, m)
      }
    }

    // Last recorded Growth OS post per article page (approved rows only; posts made elsewhere aren't recorded)
    const articleIds = [...new Set(localPages.map(p => articleIdFromPath(p.path)).filter((x): x is string => !!x))]
    const lastPost = new Map<string, string>()
    if (articleIds.length) {
      const posts = await readAll<{ article_id: string; created_at: string }>('growth_agent_memory', (a, b) =>
        db.from('growth_agent_memory').select('article_id, created_at')
          .in('article_id', articleIds).eq('outcome', 'approved')
          .order('created_at').order('id').range(a, b))
      for (const p of posts) if ((lastPost.get(p.article_id) ?? '') < p.created_at) lastPost.set(p.article_id, p.created_at)
    }
    // Titles for article pages
    const titles = new Map<string, string>()
    if (articleIds.length) {
      const { data: arts, error } = await db.from('articles').select('id, title').in('id', articleIds)
      if (error) throw new Error(`articles: ${error.message}`)
      for (const a of arts ?? []) titles.set(a.id, a.title)
    }

    const pages = s.pages.map(p => {
      const isLocal = LOCAL_HOSTS.has(p.host)
      const m = isLocal ? local.get(p.path) : undefined
      const articleId = isLocal ? articleIdFromPath(p.path) : null
      return {
        ...p,
        title: articleId ? titles.get(articleId) ?? null : null,
        local: isLocal
          ? { googleViews: m?.googleViews ?? 0, medianSeconds: median(m?.durations ?? []), unmeasured: m?.unmeasured ?? 0 }
          : null,
        article: articleId ? { id: articleId, lastPost: lastPost.get(articleId) ?? null } : null,
      }
    })

    return NextResponse.json({ empty: false, days, ...s, pages })
  } catch (error) {
    console.error('search-console route failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Could not load Search Console data' }, { status: 500 })
  }
}
