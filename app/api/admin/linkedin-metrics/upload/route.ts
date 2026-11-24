import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { exportPeriod, mergeMetric } from '@/lib/linkedin/postMetrics'
import { matchArticlesToPosts } from '@/lib/linkedin/matchArticle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Parse "M/D/YYYY" US month-first text → "YYYY-MM-DD"
// Never use new Date(string) — locale-dependent
function parseUSDate(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim()
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts
  if (!y || y.length !== 4) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseIntSafe(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}

// ─── Sheet parsers ────────────────────────────────────────────────────────────

// TOP POSTS: two side-by-side tables.
// Cols A-C: Post URL | Post Publish Date | Engagements
// Col D:    empty separator
// Cols E-G: Post URL | Post Publish Date | Impressions
// Header row found by scanning for row whose first cell === 'Post URL'
function parseTopPosts(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if (String((rows[i] as unknown[])[0]).trim() === 'Post URL') {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return { posts: [], headerFound: false }

  const headers = rows[headerIdx] as string[]
  const leftMap = new Map<string, { date: string | null; engagements: number | null; raw: Record<string, unknown> }>()
  const rightMap = new Map<string, { date: string | null; impressions: number | null; raw: Record<string, unknown> }>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]

    const leftUrl = String(row[0] ?? '').trim()
    if (leftUrl && leftUrl !== 'Post URL') {
      leftMap.set(leftUrl, {
        date: parseUSDate(row[1]),
        engagements: parseIntSafe(row[2]),
        raw: {
          [headers[0] ?? 'Post URL']: row[0],
          [headers[1] ?? 'Post Publish Date']: row[1],
          [headers[2] ?? 'Engagements']: row[2],
        },
      })
    }

    const rightUrl = String(row[4] ?? '').trim()
    if (rightUrl && rightUrl !== 'Post URL') {
      rightMap.set(rightUrl, {
        date: parseUSDate(row[5]),
        impressions: parseIntSafe(row[6]),
        raw: {
          [headers[4] ?? 'Post URL']: row[4],
          [headers[5] ?? 'Post Publish Date']: row[5],
          [headers[6] ?? 'Impressions']: row[6],
        },
      })
    }
  }

  const allUrls = new Set([...leftMap.keys(), ...rightMap.keys()])
  const posts = []
  for (const url of allUrls) {
    const left = leftMap.get(url)
    const right = rightMap.get(url)
    posts.push({
      url,
      post_date: left?.date ?? right?.date ?? null,
      engagements: left?.engagements ?? null,
      impressions: right?.impressions ?? null,
      raw_row: { ...left?.raw, ...right?.raw },
    })
  }
  return { posts, headerFound: true }
}

// ENGAGEMENT: Date | Impressions | Engagements, row 1 = headers, data after
function parseEngagement(sheet: XLSX.WorkSheet): { date: string; impressions: number | null; engagements: number | null }[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (rows.length < 2) return []
  const result = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const date = parseUSDate(row[0])
    if (!date) continue
    result.push({
      date,
      impressions: parseIntSafe(row[1]),
      engagements: parseIntSafe(row[2]),
    })
  }
  return result
}

// FOLLOWERS:
// Row 1: "Total followers on M/D/YYYY" | "946"
// Row 3: Date | New followers (headers)
// Data from row 4
function parseFollowers(sheet: XLSX.WorkSheet): {
  totalFollowers: number | null
  totalFollowersDate: string | null
  daily: { date: string; new_followers: number | null }[]
} {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  let totalFollowers: number | null = null
  let totalFollowersDate: string | null = null
  if (rows[0]) {
    const r0 = rows[0] as unknown[]
    const headerText = String(r0[0] ?? '').trim()
    const match = headerText.match(/Total followers on (.+)/i)
    if (match) totalFollowersDate = parseUSDate(match[1].trim())
    totalFollowers = parseIntSafe(r0[1])
  }

  // Find daily header row: cell[0] === 'Date'
  let dailyHeaderIdx = -1
  for (let i = 1; i < rows.length; i++) {
    if (String((rows[i] as unknown[])[0]).trim() === 'Date') {
      dailyHeaderIdx = i
      break
    }
  }

  const daily: { date: string; new_followers: number | null }[] = []
  if (dailyHeaderIdx !== -1) {
    for (let i = dailyHeaderIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const date = parseUSDate(row[0])
      if (!date) continue
      daily.push({ date, new_followers: parseIntSafe(row[1]) })
    }
  }

  return { totalFollowers, totalFollowersDate, daily }
}

// DISCOVERY and DEMOGRAPHICS: parse to JSON summary, never stored in DB
function parseSheetSummary(sheet: XLSX.WorkSheet, maxRows = 30): unknown[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return rows.slice(0, maxRows)
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Admin auth
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: role } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isDryRun = request.nextUrl.searchParams.get('dry_run') === 'true'

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'buffer' })

  // ── Locate sheets by name (case-insensitive partial match) ─────────────────
  const sheetFind = (name: string) =>
    workbook.SheetNames.find(s => s.toLowerCase().includes(name.toLowerCase()))

  const topPostsName    = sheetFind('top posts')
  const engagementName  = sheetFind('engagement')
  const followersName   = sheetFind('followers')
  const discoveryName   = sheetFind('discovery')
  const demographicsName = sheetFind('demographics')

  // ── Parse all sheets ───────────────────────────────────────────────────────
  const topPostsResult = topPostsName
    ? parseTopPosts(workbook.Sheets[topPostsName])
    : { posts: [], headerFound: false }

  const engagementRows = engagementName
    ? parseEngagement(workbook.Sheets[engagementName])
    : []

  const followersResult = followersName
    ? parseFollowers(workbook.Sheets[followersName])
    : { totalFollowers: null, totalFollowersDate: null, daily: [] }

  const discoverySummary = discoveryName
    ? parseSheetSummary(workbook.Sheets[discoveryName])
    : []

  const demographicsSummary = demographicsName
    ? parseSheetSummary(workbook.Sheets[demographicsName])
    : []

  // ── Build daily metrics map (ENGAGEMENT + FOLLOWERS merged) ───────────────
  const dailyMap = new Map<string, {
    impressions: number | null
    engagements: number | null
    new_followers: number | null
    total_followers: number | null
  }>()

  for (const row of engagementRows) {
    dailyMap.set(row.date, {
      impressions: row.impressions,
      engagements: row.engagements,
      new_followers: null,
      total_followers: null,
    })
  }

  for (const row of followersResult.daily) {
    const existing = dailyMap.get(row.date) ?? { impressions: null, engagements: null, new_followers: null, total_followers: null }
    dailyMap.set(row.date, { ...existing, new_followers: row.new_followers })
  }

  // Apply total_followers snapshot to its date
  if (followersResult.totalFollowersDate) {
    const existing = dailyMap.get(followersResult.totalFollowersDate) ?? { impressions: null, engagements: null, new_followers: null, total_followers: null }
    dailyMap.set(followersResult.totalFollowersDate, { ...existing, total_followers: followersResult.totalFollowers })
  }

  // ── Look up which post_urls already exist — needed by both the dry-run
  // preview and the real write path, so the "assignments preserved" count is
  // never a guess. article_id/match_method are fetched here ONLY to snapshot
  // the pre-upload state for the post-write verification guard below —
  // they are never copied into the upsert payload itself.
  const postUrls = topPostsResult.posts.map(p => p.url).filter(Boolean)
  const existingPostsMap = new Map<string, {
    impressions: number | null
    engagements: number | null
    impressions_period_start: string | null
    impressions_period_end: string | null
    engagements_period_start: string | null
    engagements_period_end: string | null
    metrics_updated_at: string | null
    article_id: string | null
    match_method: string | null
  }>()

  if (postUrls.length) {
    const { data: existingPosts, error: existingError } = await supabase
      .from('linkedin_post_metrics')
      .select('post_url, impressions, engagements, impressions_period_start, impressions_period_end, engagements_period_start, engagements_period_end, metrics_updated_at, article_id, match_method')
      .in('post_url', postUrls)
    // Without this read every post would look new and its upsert would overwrite a human's article assignment
    if (existingError) {
      return NextResponse.json({ error: `Could not read existing posts: ${existingError.message}` }, { status: 500 })
    }
    for (const p of existingPosts ?? []) {
      if (p.post_url) existingPostsMap.set(p.post_url, p)
    }
  }

  // Per-post numbers count over this export's date range only (analytics-002, lib/linkedin/postMetrics.ts): each
  // metric keeps the highest value any export reported, with the range it was counted over.
  const period = exportPeriod(engagementRows.map(r => r.date))
  const merged = new Map<string, { impressions: ReturnType<typeof mergeMetric>; engagements: ReturnType<typeof mergeMetric> }>()
  for (const p of topPostsResult.posts) {
    if (!p.post_date || !p.url) continue
    const e = existingPostsMap.get(p.url)
    merged.set(p.url, {
      impressions: mergeMetric(e ? { value: e.impressions, start: e.impressions_period_start, end: e.impressions_period_end } : null, p.impressions, period),
      engagements: mergeMetric(e ? { value: e.engagements, start: e.engagements_period_start, end: e.engagements_period_end } : null, p.engagements, period),
    })
  }
  const existingMerged = [...merged.entries()].filter(([url]) => existingPostsMap.has(url)).map(([, m]) => m)
  const periodSummary = {
    export_period: period,
    numbers_raised: existingMerged.filter(m => m.impressions.changed || m.engagements.changed).length,
    lower_numbers_kept: existingMerged.filter(m => !m.impressions.changed && !m.engagements.changed).length,
    period_note: 'Per-post numbers count over the export\'s date range only; each post keeps the highest number any export reported.',
  }

  const postsWithDate = topPostsResult.posts.filter(p => p.post_date)
  const existingRowCount = postsWithDate.filter(p => p.url && existingPostsMap.has(p.url)).length
  const newRowCount = postsWithDate.length - existingRowCount

  const parsedSummary = {
    sheets_found: workbook.SheetNames,
    top_posts_count: topPostsResult.posts.length,
    top_posts_header_found: topPostsResult.headerFound,
    daily_rows_count: dailyMap.size,
    engagement_rows: engagementRows.length,
    follower_rows: followersResult.daily.length,
    total_followers: followersResult.totalFollowers,
    total_followers_date: followersResult.totalFollowersDate,
    discovery: discoverySummary,
    demographics: demographicsSummary,
    ...periodSummary,
  }

  // ── Dry run ────────────────────────────────────────────────────────────────
  if (isDryRun) {
    return NextResponse.json({
      dry_run: true,
      ...parsedSummary,
      existing_rows_metric_update_only: existingRowCount,
      new_rows_to_insert: newRowCount,
      assignment_note: `${existingRowCount} existing row${existingRowCount === 1 ? '' : 's'} will be metric-updated (assignments preserved); ${newRowCount} new row${newRowCount === 1 ? '' : 's'} will be inserted with fresh matches`,
      sample_posts: topPostsResult.posts.slice(0, 5),
      sample_daily: [...dailyMap.entries()].slice(0, 5).map(([date, v]) => ({ date, ...v })),
    })
  }

  // Fetch growth_agent_memory for tiered matching (slug → date → AI)
  const { data: linkedinMemory } = await supabase
    .from('growth_agent_memory')
    .select('id, article_id, hook_line, created_at, posted_url')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')

  // Run tiered matcher — key = post_url
  const postsToMatch = topPostsResult.posts
    .filter(p => p.url && p.post_date)
    .map(p => ({ key: p.url, url: p.url, post_date: p.post_date }))

  const matchMap = await matchArticlesToPosts(postsToMatch, linkedinMemory ?? [])

  // The XLSX knows numbers; humans know articles. Uploads may never overwrite
  // a human (or matcher) decision already sitting on an existing row — so for
  // rows that already exist, article_id/match_method are omitted from the
  // upsert payload entirely (not set to their current value, OMITTED), which
  // means Postgres's ON CONFLICT DO UPDATE leaves those columns untouched.
  // Only genuinely new rows get article_id/match_method from this run's matcher.
  const newRows: Array<Record<string, unknown>> = []       // no post_url — always a fresh insert
  const newRowsWithUrl: Array<Record<string, unknown>> = []   // post_url not seen before — full columns
  const existingRowsWithUrl: Array<Record<string, unknown>> = [] // post_url already exists — numbers only, via the RPC

  for (const p of topPostsResult.posts) {
    if (!p.post_date) continue
    const existing = existingPostsMap.get(p.url)
    if (p.url && existing) {
      // Compared with the row's CURRENT numbers inside one UPDATE (apply_linkedin_post_metrics, migration 090) — not
      // with the read above, which is ~30 s old after the AI matcher: a hand correction made meanwhile must survive.
      existingRowsWithUrl.push({ post_url: p.url, post_date: p.post_date, impressions: p.impressions, engagements: p.engagements, raw_row: p.raw_row })
      continue
    }
    // A new row: the export's numbers with its range (every row carries the same keys — a bulk write NULLs a missing one)
    const imp = mergeMetric(null, p.impressions, period)
    const eng = mergeMetric(null, p.engagements, period)
    const metricFields = {
      post_url: p.url || null,
      post_date: p.post_date,
      impressions: imp.value,
      impressions_period_start: imp.start,
      impressions_period_end: imp.end,
      engagements: eng.value,
      engagements_period_start: eng.start,
      engagements_period_end: eng.end,
      raw_row: p.raw_row,
      metrics_updated_at: new Date().toISOString(),
    }
    if (!p.url) {
      newRows.push(metricFields)
    } else {
      const match = matchMap.get(p.url)
      newRowsWithUrl.push({
        ...metricFields,
        article_id: match?.article_id ?? null,
        match_method: match?.method ?? null,
      })
      // Also through the RPC: if another upload inserted this post meanwhile, the insert below skips it and the RPC
      // applies the numbers (a no-op for the row this upload inserted itself)
      existingRowsWithUrl.push({ post_url: p.url, post_date: p.post_date, impressions: p.impressions, engagements: p.engagements, raw_row: p.raw_row })
    }
  }

  let postsUpserted = 0
  let postsError: string | null = null
  let numbersRaised = 0

  if (newRowsWithUrl.length) {
    // Insert only: a row that appeared since the read keeps its assignment (ignoreDuplicates = ON CONFLICT DO NOTHING)
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .upsert(newRowsWithUrl, { onConflict: 'post_url', ignoreDuplicates: true })
    if (error) postsError = error.message
    else postsUpserted += newRowsWithUrl.length
  }
  if (existingRowsWithUrl.length && !postsError) {
    const { data: raised, error } = await supabase.rpc('apply_linkedin_post_metrics', {
      p_rows: existingRowsWithUrl,
      p_period_start: period?.start ?? null,
      p_period_end: period?.end ?? null,
    })
    if (error) postsError = error.message
    else {
      numbersRaised = typeof raised === 'number' ? raised : 0
      postsUpserted += existingRowsWithUrl.length - newRowsWithUrl.length // the new rows were counted above
    }

    // Safety-net guard: assignment columns were never sent for these rows, so
    // they must be byte-for-byte identical to the pre-upload snapshot. If a
    // future refactor accidentally reintroduces article_id/match_method into
    // this payload, this is what catches it — refuse loudly instead of
    // silently wiping a human decision.
    if (!postsError) {
      const touchedUrls = existingRowsWithUrl.map(r => r.post_url as string).filter(u => existingPostsMap.has(u))
      const { data: postWriteRows, error: verifyError } = await supabase
        .from('linkedin_post_metrics')
        .select('post_url, article_id, match_method')
        .in('post_url', touchedUrls)
      if (verifyError) {
        postsError = `Post-write verification failed: ${verifyError.message}`
      } else {
        const mutated = (postWriteRows ?? []).filter(row => {
          const before = existingPostsMap.get(row.post_url!)
          return before && (before.article_id !== row.article_id || before.match_method !== row.match_method)
        })
        if (mutated.length > 0) {
          postsError = `REFUSED: upload mutated assignment columns on ${mutated.length} existing row(s) — ` +
            `the XLSX knows numbers, humans know articles. Affected: ${mutated.map(r => r.post_url).join(', ')}`
          console.error('[linkedin-metrics/upload]', postsError)
        }
      }
    }
  }
  if (newRows.length && !postsError) {
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .insert(newRows)
    if (error) postsError = error.message
    else postsUpserted += newRows.length
  }

  // ── UPSERT daily metrics with COALESCE ─────────────────────────────────────
  const dailyDates = [...dailyMap.keys()]
  const existingDailyMap = new Map<string, { impressions: number | null; engagements: number | null; new_followers: number | null; total_followers: number | null }>()

  if (dailyDates.length) {
    const { data: existingDaily } = await supabase
      .from('linkedin_daily_metrics')
      .select('metric_date, impressions, engagements, new_followers, total_followers')
      .in('metric_date', dailyDates)
    for (const d of existingDaily ?? []) {
      existingDailyMap.set(d.metric_date, {
        impressions: d.impressions,
        engagements: d.engagements,
        new_followers: d.new_followers,
        total_followers: d.total_followers,
      })
    }
  }

  const dailyUpsertRows = [...dailyMap.entries()].map(([date, incoming]) => {
    const existing = existingDailyMap.get(date) ?? { impressions: null, engagements: null, new_followers: null, total_followers: null }
    return {
      metric_date: date,
      impressions: incoming.impressions ?? existing.impressions,
      engagements: incoming.engagements ?? existing.engagements,
      new_followers: incoming.new_followers ?? existing.new_followers,
      total_followers: incoming.total_followers ?? existing.total_followers,
    }
  })

  let dailyUpserted = 0
  let dailyError: string | null = null

  if (dailyUpsertRows.length) {
    const { error } = await supabase
      .from('linkedin_daily_metrics')
      .upsert(dailyUpsertRows, { onConflict: 'metric_date', ignoreDuplicates: false })
    if (error) dailyError = error.message
    else dailyUpserted = dailyUpsertRows.length
  }

  if (postsError || dailyError) {
    return NextResponse.json({ error: postsError ?? dailyError }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    posts_upserted: postsUpserted,
    daily_rows_upserted: dailyUpserted,
    total_followers: followersResult.totalFollowers,
    total_followers_date: followersResult.totalFollowersDate,
    // Only newRowsWithUrl carries article_id/match_method from this run's
    // matcher — existing rows' assignments were never touched, so they're
    // deliberately excluded from these stats (see assignment_note below).
    existing_rows_metric_update_only: existingRowsWithUrl.length - newRowsWithUrl.length,
    new_rows_inserted: newRowsWithUrl.length + newRows.length,
    assignment_note: `${existingRowsWithUrl.length - newRowsWithUrl.length} existing row${existingRowsWithUrl.length - newRowsWithUrl.length === 1 ? '' : 's'} were metric-updated (assignments preserved); ${newRowsWithUrl.length + newRows.length} new row${(newRowsWithUrl.length + newRows.length) === 1 ? '' : 's'} inserted with fresh matches`,
    ...periodSummary,
    // Posts whose numbers rose, decided by the database against each row's current values (the dry run's figures
    // are a preview; under a concurrent upload the per-group counts above are approximate)
    numbers_raised: numbersRaised,
    lower_numbers_kept: undefined,
    matched_articles: newRowsWithUrl.filter(r => r.article_id).length,
    match_breakdown: {
      slug: newRowsWithUrl.filter(r => r.match_method === 'slug').length,
      date: newRowsWithUrl.filter(r => r.match_method === 'date').length,
      ai: newRowsWithUrl.filter(r => r.match_method === 'ai').length,
      unmatched: newRowsWithUrl.filter(r => !r.article_id).length,
    },
    discovery: discoverySummary,
    demographics: demographicsSummary,
  })
}
