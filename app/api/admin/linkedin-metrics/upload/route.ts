import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Fuzzy header matching: returns the key in row that best matches any of the aliases
function findCol(headers: string[], aliases: string[]): string | null {
  const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const aliasSet = aliases.map(lower)
  for (const h of headers) {
    if (aliasSet.some(a => lower(h).includes(a) || a.includes(lower(h)))) return h
  }
  return null
}

// Parse Excel serial date or date string into ISO date string (YYYY-MM-DD)
function parseDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val)
    if (!date) return null
    const m = String(date.m).padStart(2, '0')
    const d = String(date.d).padStart(2, '0')
    return `${date.y}-${m}-${d}`
  }
  if (typeof val === 'string') {
    // Try to parse MM/DD/YYYY, YYYY-MM-DD, or DD/MM/YYYY
    const s = val.trim()
    // ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // US format M/D/YYYY or MM/DD/YYYY
    const usParts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (usParts) {
      const [, mo, dy, yr] = usParts
      return `${yr}-${mo.padStart(2, '0')}-${dy.padStart(2, '0')}`
    }
    // Try native Date parse as last resort
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

function parseNum(val: unknown): number {
  if (typeof val === 'number') return Math.round(val)
  if (typeof val === 'string') return parseInt(val.replace(/,/g, ''), 10) || 0
  return 0
}

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

  // Parse multipart form
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: false })

  if (isDryRun) {
    // Return sheet names + detected headers + first 5 rows per sheet
    const preview: Record<string, { headers: string[]; detectedCols: Record<string, string | null>; rows: Record<string, unknown>[] }> = {}

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      preview[sheetName] = {
        headers,
        detectedCols: {
          post_url: findCol(headers, ['posturl', 'postlink', 'link', 'url', 'shareurl', 'contenturl']),
          post_date: findCol(headers, ['publishdate', 'createddate', 'postdate', 'date', 'publishedat', 'createdat', 'postedat']),
          impressions: findCol(headers, ['impressions', 'impression', 'views', 'reach']),
          engagements: findCol(headers, ['engagements', 'engagement', 'reactions', 'interactions', 'totalengagement']),
        },
        rows: rows.slice(0, 5),
      }
    }
    return NextResponse.json({ dry_run: true, sheets: preview })
  }

  // Find the per-post sheet — pick first sheet where we can detect all 4 key columns
  let targetSheet: string | null = null
  let urlCol: string | null = null
  let dateCol: string | null = null
  let impressionsCol: string | null = null
  let engagementsCol: string | null = null
  let allRows: Record<string, unknown>[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
    if (!rows.length) continue
    const headers = Object.keys(rows[0])

    const u = findCol(headers, ['posturl', 'postlink', 'link', 'url', 'shareurl', 'contenturl'])
    const d = findCol(headers, ['publishdate', 'createddate', 'postdate', 'date', 'publishedat', 'createdat', 'postedat'])
    const i = findCol(headers, ['impressions', 'impression', 'views', 'reach'])
    const e = findCol(headers, ['engagements', 'engagement', 'reactions', 'interactions', 'totalengagement'])

    if (u && d && i && e) {
      targetSheet = sheetName
      urlCol = u
      dateCol = d
      impressionsCol = i
      engagementsCol = e
      allRows = rows
      break
    }
  }

  if (!targetSheet) {
    return NextResponse.json({
      error: 'Could not detect per-post sheet. Use ?dry_run=true to inspect headers.',
    }, { status: 422 })
  }

  // Collect unique post_dates to batch-fetch article_id matches
  const uniqueDates = [...new Set(allRows.map(r => parseDate(r[dateCol!])).filter(Boolean))] as string[]

  // Fetch matching linkedin posts from growth_agent_memory for these dates
  const { data: memoryRows } = await supabase
    .from('growth_agent_memory')
    .select('article_id, created_at')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')
    .in('created_at', []) // placeholder; we'll use JS filter below

  // Fetch all approved linkedin posts (no date filter on Supabase since DATE() isn't directly filterable via PostgREST)
  const { data: linkedinMemory } = await supabase
    .from('growth_agent_memory')
    .select('article_id, created_at')
    .eq('platform', 'linkedin')
    .eq('outcome', 'approved')

  // Build date → article_id map
  const dateToArticleId: Record<string, string> = {}
  for (const row of linkedinMemory || []) {
    const postDate = row.created_at?.slice(0, 10)
    if (postDate && row.article_id) {
      dateToArticleId[postDate] = row.article_id
    }
  }

  // Build upsert payload
  const upsertRows = []
  let skipped = 0

  for (const row of allRows) {
    const post_url = row[urlCol!] ? String(row[urlCol!]).trim() : null
    const post_date = parseDate(row[dateCol!])
    const impressions = parseNum(row[impressionsCol!])
    const engagements = parseNum(row[engagementsCol!])

    if (!post_date) { skipped++; continue }
    // post_url may be null for some LinkedIn exports; use date as fallback key
    const article_id = post_date ? (dateToArticleId[post_date] || null) : null

    upsertRows.push({
      post_url: post_url || null,
      post_date,
      impressions,
      engagements,
      article_id,
      raw_row: row,
    })
  }

  if (!upsertRows.length) {
    return NextResponse.json({ error: 'No valid rows found after parsing', skipped }, { status: 422 })
  }

  // UPSERT — idempotent on post_url (rows without post_url get INSERT only; duplicates possible but rare)
  // Split: rows with post_url (upsert) vs rows without (insert)
  const withUrl = upsertRows.filter(r => r.post_url)
  const withoutUrl = upsertRows.filter(r => !r.post_url)

  let upserted = 0
  let inserted = 0
  let errorMsg: string | null = null

  if (withUrl.length) {
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .upsert(withUrl, { onConflict: 'post_url', ignoreDuplicates: false })
    if (error) errorMsg = error.message
    else upserted = withUrl.length
  }

  if (withoutUrl.length && !errorMsg) {
    const { error } = await supabase
      .from('linkedin_post_metrics')
      .insert(withoutUrl)
    if (error) errorMsg = error.message
    else inserted = withoutUrl.length
  }

  if (errorMsg) {
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    sheet: targetSheet,
    total_parsed: upsertRows.length,
    upserted,
    inserted,
    skipped,
    matched_articles: upsertRows.filter(r => r.article_id).length,
    date_range: uniqueDates.length ? { from: uniqueDates.sort()[0], to: uniqueDates.sort().at(-1) } : null,
  })
}
