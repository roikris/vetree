/**
 * Tiered article matcher for LinkedIn post metrics.
 *
 * TIER 1 — Slug: extract content words from URL, compare against stored hook_line
 * TIER 2 — Date window ±1 day against growth_agent_memory.created_at
 * TIER 3 — Claude Sonnet batch for still-unmatched rows
 */
import Anthropic from '@anthropic-ai/sdk'

export type MemoryRow = {
  id: string
  article_id: string
  hook_line: string | null
  created_at: string
  posted_url?: string | null
}

export type PostInput = {
  /** Unique key for this post — url during upload, DB row id during rematch */
  key: string
  url: string
  post_date: string | null
}

export type MatchResult = {
  article_id: string
  method: 'activity_id' | 'slug' | 'date' | 'ai'
}

// Extract the long numeric activity ID from a LinkedIn URL
// Handles: share-7478467709375074307-XXXX and ugcPost-7478467709375074307-XXXX
function extractActivityId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:share|ugcPost)[-_]?(\d{15,})/)
  return m ? m[1] : null
}

// ─── Text normalisation ───────────────────────────────────────────────────────
// Strip emoji, punctuation, collapse whitespace → token array
function normalize(s: string): string[] {
  return s
    .toLowerCase()
    // emoji blocks (basic + supplementary)
    .replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27FF}]/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

// ─── Slug extraction ──────────────────────────────────────────────────────────
// LinkedIn URL formats:
//   /posts/{profile}_{content-words}-activity-{digits}-{4chars}
//   /posts/{profile}_{content-words}-share-{digits}-{4chars}
// Returns null for ugcPost URLs (hashtag junk) and unrecognised formats.
function extractSlug(url: string): string | null {
  if (!url) return null
  if (url.toLowerCase().includes('ugcpost')) return null   // skip ugcPost junk

  const m = url.match(/\/posts\/([^/?#]+)/)
  if (!m) return null
  const segment = m[1]

  const underscoreIdx = segment.indexOf('_')
  if (underscoreIdx === -1) return null

  const afterProfile = segment.slice(underscoreIdx + 1)
  // Strip trailing -activity-{digits}-{alphanum} or -share-
  const cleaned = afterProfile.replace(/-(?:activity|share|ugcPost)[-_]?\d[\d-]*[-_]\w+$/i, '').trim()

  return cleaned || null
}

// ─── Ordered-subsequence match score ─────────────────────────────────────────
// Returns fraction of slugTokens that appear in hookTokens in order
function slugMatchScore(slugTokens: string[], hookTokens: string[]): number {
  if (!slugTokens.length) return 0
  let hi = 0
  let matched = 0
  for (const tok of slugTokens) {
    while (hi < hookTokens.length && hookTokens[hi] !== tok) hi++
    if (hi < hookTokens.length) { matched++; hi++ }
  }
  return matched / slugTokens.length
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function matchArticlesToPosts(
  posts: PostInput[],
  memory: MemoryRow[],
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()

  // Pre-normalise hook_lines (first 12 tokens) once
  const hookTokens = new Map<string, string[]>()
  for (const m of memory) {
    hookTokens.set(m.id, m.hook_line ? normalize(m.hook_line).slice(0, 12) : [])
  }

  // Build activity_id → memory row map from posted_url
  const activityIdToMemory = new Map<string, MemoryRow>()
  for (const m of memory) {
    if (m.posted_url) {
      const aid = extractActivityId(m.posted_url)
      if (aid) activityIdToMemory.set(aid, m)
    }
  }

  const afterTier0: PostInput[] = []

  // ── TIER 0: Activity ID exact match ─────────────────────────────────────────
  for (const post of posts) {
    const aid = extractActivityId(post.url)
    if (aid && activityIdToMemory.has(aid)) {
      const mem = activityIdToMemory.get(aid)!
      results.set(post.key, { article_id: mem.article_id, method: 'activity_id' })
    } else {
      afterTier0.push(post)
    }
  }

  const afterTier1: PostInput[] = []

  // ── TIER 1: Slug ────────────────────────────────────────────────────────────
  for (const post of afterTier0) {
    const slug = extractSlug(post.url)
    if (!slug) { afterTier1.push(post); continue }

    const slugToks = normalize(slug)
    if (slugToks.length < 3) { afterTier1.push(post); continue }   // too short

    let bestScore = 0
    let bestMemId: string | null = null
    let uniqueWinner = true

    for (const mem of memory) {
      const ht = hookTokens.get(mem.id) ?? []
      if (!ht.length) continue
      const score = slugMatchScore(slugToks, ht)
      if (score >= 0.8) {
        if (score > bestScore) {
          bestScore = score; bestMemId = mem.id; uniqueWinner = true
        } else if (score === bestScore && bestMemId !== mem.id) {
          uniqueWinner = false
        }
      }
    }

    if (bestMemId && uniqueWinner) {
      const mem = memory.find(m => m.id === bestMemId)!
      results.set(post.key, { article_id: mem.article_id, method: 'slug' })
    } else {
      afterTier1.push(post)
    }
  }

  // ── TIER 2: Date window ±1 day ──────────────────────────────────────────────
  const afterTier2: PostInput[] = []
  const oneDayMs = 24 * 60 * 60 * 1000

  for (const post of afterTier1) {
    if (!post.post_date) { afterTier2.push(post); continue }

    const postMs = new Date(post.post_date).getTime()
    const candidates = memory.filter(m => {
      const memMs = new Date(m.created_at.slice(0, 10)).getTime()
      return Math.abs(memMs - postMs) <= oneDayMs
    })

    if (candidates.length === 1) {
      results.set(post.key, { article_id: candidates[0].article_id, method: 'date' })
    } else {
      afterTier2.push(post)
    }
  }

  // ── TIER 3: Claude Sonnet batch ──────────────────────────────────────────────
  if (afterTier2.length > 0) {
    try {
      // Client initialised INSIDE function per critical rule
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const sevenDayMs = 7 * 24 * 60 * 60 * 1000

      const slugDescriptions = afterTier2.map(post => {
        const slug = extractSlug(post.url) ?? post.url.slice(-80)
        const slugWords = normalize(slug).join(' ')
        const postMs = post.post_date ? new Date(post.post_date).getTime() : null

        const candidates = postMs
          ? memory
              .filter(m => {
                const memMs = new Date(m.created_at.slice(0, 10)).getTime()
                return Math.abs(memMs - postMs) <= sevenDayMs
              })
              .map(m => ({
                id: m.id,
                date: m.created_at.slice(0, 10),
                first15: normalize(m.hook_line ?? '').slice(0, 15).join(' '),
              }))
          : []

        return { key: post.key, slug: slugWords, post_date: post.post_date, candidates }
      })

      const prompt = `Match each LinkedIn post URL slug to the most likely stored post record.
For each item in the array:
- "slug" = words extracted from the post URL
- "candidates" = possible matching records with their first 15 words

Rules:
- Match based on meaningful word overlap between slug and first15
- Only assign if confident (>= 70% meaningful overlap)
- Assign null when uncertain
- Return ONLY a JSON object mapping each "key" to a candidate "id" string or null
- No explanation, no markdown

Posts:
${JSON.stringify(slugDescriptions, null, 2)}`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
      const clean = raw
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

      let aiMap: Record<string, string | null> = {}
      try { aiMap = JSON.parse(clean) } catch { /* leave unmatched */ }

      for (const post of afterTier2) {
        const memId = aiMap[post.key]
        if (memId) {
          const mem = memory.find(m => m.id === memId)
          if (mem) results.set(post.key, { article_id: mem.article_id, method: 'ai' })
        }
      }
    } catch {
      // Haiku failed — leave rows unmatched, don't throw
    }
  }

  return results
}
