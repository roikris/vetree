// Shared article selection for Growth OS — the "recommended articles" panel
// (/api/admin/growth/recommendations) and the daily auto-pick (/api/growth/generate-post
// without an article_id). Both surfaces rank the same eligible pool, so they agree.
//
// Policy (Roi, 2026-10-01):
// - An article marked 'irrelevant' or 'already_published' never comes back.
// - A posted article never comes back. "Posted" = an approved post in growth_agent_memory,
//   or any human social click on it (covers posts made before the memory existed).
// - Exception — crowd favorites: posted articles with ≥ CROWD_FAVORITE_MIN_CLICKS social
//   clicks may resurface once CROWD_FAVORITE_REST_DAYS have passed since they were last
//   posted or clicked. They are marked crowdFavorite so the UI can say so.
// - Eligible = publicly visible, labelled 'Small Animal', not large-animal, not Exotic.
// - "New" = created_at (new to Vetree), never publication_date — see CLAUDE.md.
//
// Supabase errors throw: a failed exclusion read must never look like "nothing excluded".

import type { SupabaseClient } from '@supabase/supabase-js'
import { excludedUsersOrFilter } from '@/lib/analytics-excluded-ids'
import { getEvidenceLevel } from '@/lib/utils/evidenceBadge'

export const CANDIDATE_WINDOW_DAYS = 60
export const CROWD_FAVORITE_MIN_CLICKS = 20   // ≈ top 15% of posted articles (2026-10)
export const CROWD_FAVORITE_REST_DAYS = 182
const SKIP_REST_DAYS = 7                       // calendar "skip" = not today, not never

const LARGE_ANIMAL = ['Equine', 'equine', 'Large Animal', 'large animal', 'Livestock', 'livestock',
  'Poultry', 'poultry', 'Food Animal', 'food animal']
const EXCLUDED_LABELS = [...LARGE_ANIMAL, 'Exotic', 'exotic']

const CANDIDATE_SELECT = 'id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence, created_at'

export type GrowthCandidate = {
  id: string
  title: string
  clinical_bottom_line: string | null
  labels: string[] | null
  source_journal: string | null
  publication_date: string | null
  strength_of_evidence: string | null
  created_at: string
  crowdFavorite: boolean
  socialClicks: number
  score: number
}

const DAY = 24 * 60 * 60 * 1000

function fail(label: string, error: { message: string } | null) {
  if (error) throw new Error(`[growth/candidates] ${label}: ${error.message}`)
}

async function readAll<T>(label: string, page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    fail(label, error)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

function isEligible(a: { labels: string[] | null }) {
  const labels = a.labels || []
  return labels.includes('Small Animal') && !labels.some(l => EXCLUDED_LABELS.includes(l))
}

function articleIdFromPath(path: string) {
  return path.replace('/article/', '').split('?')[0].trim()
}

const EVIDENCE_POINTS = { gold: 1, silver: 0.6, bronze: 0.2, unknown: 0.4 } as const

/** Eligible articles, best first. Throws on any read error. */
export async function rankGrowthCandidates(supabase: SupabaseClient, now = Date.now()): Promise<GrowthCandidate[]> {
  const today = new Date(now).toISOString().split('T')[0]

  const [memory, socialViews, recent] = await Promise.all([
    readAll<{ article_id: string | null; outcome: string; created_at: string }>('memory', (f, t) =>
      supabase.from('growth_agent_memory').select('article_id, outcome, created_at')
        .not('article_id', 'is', null).order('created_at', { ascending: true }).range(f, t)),
    // Human social clicks on article pages, all retained history
    readAll<{ path: string; created_at: string }>('social views', (f, t) =>
      supabase.from('page_views').select('path, created_at')
        .eq('utm_medium', 'social').like('path', '/article/%').is('bot_name', null)
        .or(excludedUsersOrFilter()).order('created_at', { ascending: true }).range(f, t)),
    readAll<Omit<GrowthCandidate, 'crowdFavorite' | 'socialClicks' | 'score'>>('recent articles', (f, t) =>
      supabase.from('articles').select(CANDIDATE_SELECT)
        .eq('needs_enrichment', false)
        .not('summary', 'is', null)
        .not('clinical_bottom_line', 'is', null)
        .or('quarantined.is.null,quarantined.eq.false')
        .gte('created_at', new Date(now - CANDIDATE_WINDOW_DAYS * DAY).toISOString())
        .order('created_at', { ascending: false }).range(f, t)),
  ])

  // Social clicks + last click per article
  const clicks = new Map<string, number>()
  const lastClick = new Map<string, number>()
  for (const v of socialViews) {
    const id = articleIdFromPath(v.path)
    if (!id) continue
    clicks.set(id, (clicks.get(id) || 0) + 1)
    lastClick.set(id, Math.max(lastClick.get(id) || 0, Date.parse(v.created_at)))
  }

  const neverAgain = new Set<string>()        // irrelevant / already_published
  const lastApproved = new Map<string, number>()
  const recentlySkipped = new Set<string>()
  const touchedToday = new Set<string>()      // any outcome today (all platforms share one article)
  for (const m of memory) {
    const id = m.article_id!
    const at = Date.parse(m.created_at)
    if (m.outcome === 'irrelevant' || m.outcome === 'already_published') neverAgain.add(id)
    if (m.outcome === 'approved') lastApproved.set(id, Math.max(lastApproved.get(id) || 0, at))
    if (m.outcome === 'skipped' && at >= now - SKIP_REST_DAYS * DAY) recentlySkipped.add(id)
    if (m.created_at >= today) touchedToday.add(id)
  }

  // Posted articles may only return as rested crowd favorites
  const restedFavorites: string[] = []
  const isPosted = (id: string) => lastApproved.has(id) || clicks.has(id)
  for (const id of new Set([...lastApproved.keys(), ...clicks.keys()])) {
    const lastPosted = Math.max(lastApproved.get(id) || 0, lastClick.get(id) || 0)
    if ((clicks.get(id) || 0) >= CROWD_FAVORITE_MIN_CLICKS && lastPosted <= now - CROWD_FAVORITE_REST_DAYS * DAY) {
      restedFavorites.push(id)
    }
  }
  const favoriteSet = new Set(restedFavorites)

  // Favorites are older than the recent window — fetch them by id, same visibility filters
  const favorites = restedFavorites.length === 0 ? [] : await readAll<Omit<GrowthCandidate, 'crowdFavorite' | 'socialClicks' | 'score'>>('crowd favorites', (f, t) =>
    supabase.from('articles').select(CANDIDATE_SELECT)
      .in('id', restedFavorites)
      .eq('needs_enrichment', false)
      .not('summary', 'is', null)
      .not('clinical_bottom_line', 'is', null)
      .or('quarantined.is.null,quarantined.eq.false')
      .range(f, t))

  const seen = new Set<string>()
  const ranked: GrowthCandidate[] = []
  for (const a of [...recent, ...favorites]) {
    if (seen.has(a.id)) continue
    seen.add(a.id)
    if (!isEligible(a)) continue
    if (neverAgain.has(a.id) || recentlySkipped.has(a.id) || touchedToday.has(a.id)) continue
    const crowdFavorite = favoriteSet.has(a.id)
    if (isPosted(a.id) && !crowdFavorite) continue

    // 0..1 each. Recency on created_at; favorites get a flat recency in lieu of it.
    const ageDays = Math.max(0, (now - Date.parse(a.created_at)) / DAY)
    const recency = crowdFavorite ? 0.5 : Math.max(0, 1 - ageDays / CANDIDATE_WINDOW_DAYS)
    const evidence = EVIDENCE_POINTS[getEvidenceLevel(a.strength_of_evidence, a.labels)]
    ranked.push({
      ...a,
      crowdFavorite,
      socialClicks: clicks.get(a.id) || 0,
      score: 0.5 * recency + 0.5 * evidence,
    })
  }

  return ranked.sort((x, y) => y.score - x.score)
}
