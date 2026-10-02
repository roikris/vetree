// Growth OS relevance scoring — Claude rates each article 0–10 on the three things the owner
// posts for. Cached per article in growth_article_scores (migration 071).
//
// Validated offline on 2026-10-01 against 324 articles the owner had already judged (held-out
// half, n=167): max(practice, talk, wow) AUC 0.80, 10/10 of the top 10 were ones he posted,
// vs 0.67 for keyword rules and 0.63 for evidence tier alone. Adding his past picks as few-shot
// examples did not help; a "same topic posted recently" penalty did not either.
//
// Bump RUBRIC_VERSION whenever RUBRIC changes — older rows then stop counting as scored.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CLAUDE_MODEL, NO_UPFRONT_THINKING, responseText } from '@/lib/ai/model'

export const RUBRIC_VERSION = 1
const BATCH_SIZE = 25

const RUBRIC = `You choose research articles for a daily social-media post aimed at first-opinion (general practice) small-animal veterinarians — dogs and cats. Score each article on three independent 0–10 scales:
- practice: would a GP vet reading it this week confirm or change something they do in the consult room? (treatment, drugs, dosing, sedation, tests a GP runs, common conditions, guidelines)
- talk: would vets want to talk about it or share it — surprising, relatable, about the profession, clients, pets' behaviour, media, curiosity value — even if it changes nothing clinically?
- wow: does it defy standard thinking or contradict common practice — a finding that makes a vet say "wait, really?"
Low on all three: referral-only procedures, exotic/wildlife species, basic lab science, reference intervals, niche assay validation, tiny case reports of rare diseases.
Also give reason: one short sentence (max 120 characters) on why it would or wouldn't make a good post.`

export type ScorableArticle = {
  id: string
  title: string
  clinical_bottom_line: string | null
  strength_of_evidence: string | null
  labels: string[] | null
}

export type ArticleScore = {
  article_id: string
  practice: number
  talk: number
  wow: number
  reason: string | null
}

/**
 * Hash of the model that scored it + everything the prompt saw. A score is checked against the
 * model stored on its own row, so switching CLAUDE_MODEL does NOT invalidate existing scores
 * (Sonnet 4.6 and 5.5 judge alike on the held-out set: AUC 0.82 vs 0.80); only an edited article
 * or a RUBRIC_VERSION bump does. Bump RUBRIC_VERSION to re-score everything deliberately.
 */
export function scoreInputHash(a: ScorableArticle, model: string = CLAUDE_MODEL): string {
  return createHash('sha256')
    .update(JSON.stringify([model, a.title, a.clinical_bottom_line, a.strength_of_evidence, a.labels ?? []]))
    .digest('hex')
}

/** Valid cached scores for these articles (rubric + input unchanged). Throws on read error. */
export async function loadValidScores(supabase: SupabaseClient, articles: ScorableArticle[], signal?: AbortSignal): Promise<Map<string, ArticleScore>> {
  const out = new Map<string, ArticleScore>()
  const byId = new Map(articles.map(a => [a.id, a]))
  const ids = [...byId.keys()]
  for (let i = 0; i < ids.length; i += 100) {
    let query = supabase.from('growth_article_scores')
      .select('article_id, practice, talk, wow, reason, rubric_version, input_hash, model')
      .in('article_id', ids.slice(i, i + 100))
      .eq('rubric_version', RUBRIC_VERSION)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw new Error(`[growth/scoring] load scores: ${error.message}`)
    for (const r of data || []) {
      const a = byId.get(r.article_id)
      if (a && r.input_hash === scoreInputHash(a, r.model)) {
        out.set(r.article_id, { article_id: r.article_id, practice: r.practice, talk: r.talk, wow: r.wow, reason: r.reason })
      }
    }
  }
  return out
}

const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10

/** Parse + validate one batch reply. Omitted or invalid ids are simply not scored. */
export function parseScores(raw: string, batch: ScorableArticle[]): ArticleScore[] {
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed: unknown = JSON.parse(clean)
  if (!Array.isArray(parsed)) throw new Error('scores reply is not an array')
  const wanted = new Set(batch.map(a => a.id))
  const seen = new Set<string>()
  const out: ArticleScore[] = []
  for (const r of parsed as Record<string, unknown>[]) {
    const id = r?.id
    if (typeof id !== 'string' || !wanted.has(id) || seen.has(id)) continue
    if (!isScore(r.practice) || !isScore(r.talk) || !isScore(r.wow)) continue
    seen.add(id)
    const reason = typeof r.reason === 'string' ? r.reason.trim().slice(0, 300) : null
    out.push({ article_id: id, practice: r.practice, talk: r.talk, wow: r.wow, reason: reason || null })
  }
  return out
}

async function scoreBatch(supabase: SupabaseClient, batch: ScorableArticle[], signal: AbortSignal): Promise<number> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = batch.map(a => JSON.stringify({ id: a.id, title: a.title, bottom_line: a.clinical_bottom_line, study: a.strength_of_evidence, labels: a.labels }))
  const res = await anthropic.messages.create({
    ...NO_UPFRONT_THINKING,
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: RUBRIC,
    messages: [{ role: 'user', content: `Articles (one JSON per line):\n${list.join('\n')}\n\nReturn ONLY a JSON array: [{"id":"...","practice":0-10,"talk":0-10,"wow":0-10,"reason":"..."}] covering every article.` }],
  }, { signal, maxRetries: 0 })  // the signal also covers reading the body, unlike `timeout`

  const scores = parseScores(responseText(res), batch)
  if (scores.length === 0) throw new Error(`scoring reply had no valid scores for a batch of ${batch.length}`)
  const hashes = new Map(batch.map(a => [a.id, scoreInputHash(a)]))
  const now = new Date().toISOString()
  const { error } = await supabase.from('growth_article_scores').upsert(scores.map(s => ({
    ...s,
    rubric_version: RUBRIC_VERSION,
    model: CLAUDE_MODEL,
    input_hash: hashes.get(s.article_id)!,
    scored_at: now,
  })), { onConflict: 'article_id' }).abortSignal(signal)
  if (error) throw new Error(`[growth/scoring] upsert: ${error.message}`)
  // Partial reply: the valid scores are kept, the omitted/invalid ones still count as an error
  if (scores.length < batch.length) throw new PartialBatch(scores.length, batch.length)
  return scores.length
}

class PartialBatch extends Error {
  constructor(public saved: number, total: number) {
    super(`scoring reply covered ${saved}/${total} articles`)
  }
}

/**
 * Score articles in batches of 25, `parallel` at a time. Everything — Claude calls including the
 * response body, and the upserts — is aborted at the deadline (epoch ms); no new wave starts with
 * < 10s left. Each batch settles independently. Returns how many were scored and any batch errors.
 */
export async function scoreArticles(
  supabase: SupabaseClient,
  articles: ScorableArticle[],
  { deadline, parallel = 2 }: { deadline: number; parallel?: number },
): Promise<{ scored: number; errors: string[] }> {
  const batches: ScorableArticle[][] = []
  for (let i = 0; i < articles.length; i += BATCH_SIZE) batches.push(articles.slice(i, i + BATCH_SIZE))
  let scored = 0
  const errors: string[] = []
  const signal = AbortSignal.timeout(Math.max(0, deadline - Date.now()))
  for (let i = 0; i < batches.length; i += parallel) {
    if (deadline - Date.now() < 10_000) break
    const wave = await Promise.allSettled(batches.slice(i, i + parallel).map(b => scoreBatch(supabase, b, signal)))
    for (const r of wave) {
      if (r.status === 'fulfilled') scored += r.value
      else {
        if (r.reason instanceof PartialBatch) scored += r.reason.saved
        errors.push(String(r.reason))
      }
    }
  }
  return { scored, errors }
}
