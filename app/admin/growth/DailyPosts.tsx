'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  POSTING_PLATFORMS, GENERATED_PLATFORMS, platformInfo, telegramFromWhatsapp, israelDate, israelDateMinus,
  reconcileDay, postedPlatforms, type ApprovedRow, type Draft,
} from '@/lib/growth/daily'
import { onceGuard } from '@/lib/growth/approvals'

// Growth OS — the daily posts (growth-002, replaces CampaignCalendar.tsx). The owner's flow (Roi, 2026-10-13): every
// day ONE article goes to EVERY platform. Generate All writes a post per platform for one article (Telegram = the
// WhatsApp post with its UTM switched, no model call); each card's "Copy & mark posted" records THAT platform and
// language (growth_agent_memory, one row per article + platform + Israel day — the feedback route dedups). Today's
// posted state and the streak come from the database (/api/admin/growth/today); only the drafts live in this browser.
// Once anything is marked posted today, that article is the day's article: drafts for another one are dropped and
// every generation / retry / rewrite is forced to it and echo-checked.

// AI Photos prompt (owner's wording, 2026-09-26). Copied into ChatGPT with the logo attached
// by hand; "@Create image" is ChatGPT's image command. The content is the article's source
// abstract word for word (articles.abstract, migration 057), not the AI summary.
const PHOTO_PROMPT_PREFIX =
  'craft an image that will pair well with the following professional oriented content on social media networks. make one in normal ratio and one in a 4:5 ratio, embed the attached vetree logo in the image in a non conspicuous way :'
const buildPhotoPrompt = (content: string) => `${PHOTO_PROMPT_PREFIX}\n\n${content}\n\n@Create image`

const STYLE_PROMPTS: Record<string, string> = {
  factual: 'Rewrite this post to be more factual and precise. Stay extremely close to what the study actually found. Remove any interpretive language.',
  engaging: 'Rewrite this post to be more engaging and compelling for a veterinary professional audience. Keep all facts accurate.',
  concise: 'Rewrite this post to be 30% shorter while keeping the key clinical finding.',
  clinical: 'Rewrite this post with more clinical terminology appropriate for specialist DVMs.',
}
const TIGHTEN_INSTRUCTION = 'Rewrite this post staying strictly faithful to the following original study summary. Every factual claim must be directly supported by the summary text. Do not add interpretation beyond what the summary states.'
const NORMALLY_EXCLUDED = ['Equine', 'equine', 'Large Animal', 'large animal', 'Livestock', 'livestock', 'Poultry', 'poultry', 'Food Animal', 'food animal']

type Post = Draft & { language: string; hook_line?: string; crowd_favorite?: boolean; article_labels?: string[] }
type DayStore = { articleId: string | null; articleTitle: string | null; posts: Record<string, Post>; failed?: string[] }
type Article = { id: string; title: string; crowdFavorite?: boolean }

// Drafts are this browser's, per Israel day (posted state is in the database)
const storeKey = (date: string) => `vetree_daily_posts_${date}`
function readStore(date: string): DayStore | null {
  try {
    const raw = localStorage.getItem(storeKey(date))
    return raw ? JSON.parse(raw) as DayStore : null
  } catch { return null }
}
function writeStore(date: string, store: DayStore) {
  try { localStorage.setItem(storeKey(date), JSON.stringify(store)) } catch { /* storage full / blocked: drafts just aren't kept */ }
}
function cleanupOldStores(today: string) {
  try {
    const keep = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(i => storeKey(israelDateMinus(today, i))))
    Object.keys(localStorage)
      .filter(k => (k.startsWith('vetree_daily_posts_') && !keep.has(k)) || k.startsWith('vetree_campaign_'))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

type GenerateBody = { platform: string; language: string; article_id?: string; recentPosts?: string[]; style_instruction?: string; existing_post?: string; abstract_override?: string }
type GenerateResult = { post_content: string; article_id: string; article_title?: string; article_labels?: string[]; crowd_favorite?: boolean; hook_line?: string }

async function generate(body: GenerateBody): Promise<{ ok: true; data: GenerateResult } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch('/api/growth/generate-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error || !data.post_content) return { ok: false, status: res.status, error: data.error || `Server error ${res.status}` }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) }
  }
}

const toPost = (d: GenerateResult, language: string): Post => ({
  post_content: d.post_content, article_id: d.article_id, article_title: d.article_title, language,
  hook_line: d.hook_line, crowd_favorite: d.crowd_favorite, article_labels: d.article_labels,
})
const hookOf = (text: string) => text.split('\n').find(l => l.trim())?.trim()

// The panel lives for one Israel day: at midnight (or on Retry loading) it is rebuilt from scratch — today's posted
// state reloaded, yesterday's article / flags / double-click guard gone, drafts read from the new day's key.
export function DailyPosts() {
  // the Israel date — identical on the server and in the browser (fixed time zone), so no hydration mismatch
  const [day, setDay] = useState(() => israelDate(new Date()))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const check = () => setDay(israelDate(new Date()))
    const timer = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [])
  return <DailyDay key={`${day}:${attempt}`} today={day}
    onDayChange={() => setDay(israelDate(new Date()))} onReload={() => setAttempt(a => a + 1)} />
}

function DailyDay({ today, onDayChange, onReload }: { today: string; onDayChange: () => void; onReload: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<ApprovedRow[]>([])
  const [streak, setStreak] = useState<{ days: number; capped: boolean } | null>(null)
  const [dayArticle, setDayArticle] = useState<Article | null>(null) // fixed once anything is posted today
  const [posts, setPosts] = useState<Record<string, Post>>({})
  const [activeTab, setActiveTab] = useState<string>('')
  const [failed, setFailed] = useState<string[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // 'all' | 'retry' | `rewrite:<platform>` | `img`
  const [marking, setMarking] = useState<string | null>(null)
  const [exclusionNote, setExclusionNote] = useState<string | null>(null)

  const [selected, setSelected] = useState<Article | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; title: string; source_journal?: string }[]>([])
  const [showResults, setShowResults] = useState(false)

  const [recommendations, setRecommendations] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showRecs, setShowRecs] = useState(false)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recsError, setRecsError] = useState<string | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  const [recsMeta, setRecsMeta] = useState<{ scored: number; degraded: boolean; errors: number } | null>(null)

  const [missingUrls, setMissingUrls] = useState<{ id: string; article_id: string; article_title: string | null; date: string }[]>([])
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({})
  const [urlSaving, setUrlSaving] = useState<Record<string, boolean>>({})

  const [photoArticle, setPhotoArticle] = useState<{ id: string; abstract?: string | null; summary?: string; clinical_bottom_line?: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoCopied, setPhotoCopied] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState<string | null>(null) // the card whose copy failed: mark only on an explicit "copied by hand"

  const articleId = dayArticle?.id ?? Object.values(posts)[0]?.article_id ?? null
  const articleTitle = dayArticle?.title ?? Object.values(posts)[0]?.article_title ?? null
  const posted = postedPlatforms(rows, articleId)
  // nothing that can write a "posted" row or change the article runs until today's posted state is known
  const ready = loaded && !loadError
  const photo = photoArticle?.id === articleId ? photoArticle : null // never the previous article's abstract
  const dayChanged = () => {
    if (israelDate(new Date()) === today) return false
    setMessage({ type: 'error', text: "It's past midnight in Israel — a new day has started; the panel is reloading" })
    onDayChange()
    return true
  }

  // The text a card shows / copies — Telegram is always rebuilt from WhatsApp
  const textFor = useCallback((platform: string): string | null => {
    const info = platformInfo(platform)
    if (info?.derivedFrom) {
      const src = posts[info.derivedFrom]?.post_content
      return src ? telegramFromWhatsapp(src) : null
    }
    return posts[platform]?.post_content ?? null
  }, [posts])

  // the drafts and which platforms failed, kept per Israel day (after the start reconciliation only)
  useEffect(() => {
    if (!loaded) return
    const first = Object.values(posts)[0]
    writeStore(today, {
      articleId: dayArticle?.id ?? first?.article_id ?? null,
      articleTitle: dayArticle?.title ?? first?.article_title ?? null,
      posts, failed,
    })
  }, [loaded, today, posts, failed, dayArticle])

  const loadMissingUrls = async () => {
    try {
      const res = await fetch('/api/admin/growth/memory/posted-url')
      const data = await res.json()
      if (res.ok) setMissingUrls(data.rows || [])
    } catch { /* non-blocking */ }
  }

  // ─── Start: today's posted state from the database, reconciled with this browser's drafts ─────────────────────
  useEffect(() => {
    let cancelled = false
    const date = today
    cleanupOldStores(date)
    loadMissingUrls()
    ;(async () => {
      const stored = readStore(date)
      let todayRows: ApprovedRow[] = []
      let fixed: Article | null = null
      try {
        const res = await fetch('/api/admin/growth/today')
        const data = await res.json()
        if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`)
        if (data.date !== today) { onDayChange(); throw new Error(`the server's day is ${data.date}, this page's is ${today}`) }
        todayRows = data.rows || []
        fixed = data.article ? { id: data.article.id, title: data.article.title } : null
        if (!cancelled && typeof data.streak === 'number') setStreak({ days: data.streak, capped: data.streak >= (data.window_days ?? Infinity) })
      } catch (e) {
        if (!cancelled) setLoadError(`Couldn't load today's posted state (${e instanceof Error ? e.message : String(e)}) — generating and marking posted are off until it loads`)
      }
      if (cancelled) return
      const r = reconcileDay(stored?.posts ?? {}, todayRows)
      setRows(todayRows)
      setDayArticle(fixed)
      setPosts(r.drafts as Record<string, Post>)
      // platforms still without a post (failed earlier, or a dropped draft) stay retryable after a reload
      const drafts = r.drafts as Record<string, Post>
      setFailed([...new Set([...(stored?.failed ?? []), ...r.dropped])].filter(p => GENERATED_PLATFORMS.some(g => g.platform === p) && !drafts[p]))
      if (r.dropped.length) setMessage({ type: 'error', text: `Dropped ${r.dropped.length} draft(s) for a different article than today's — use Retry Failed to regenerate them` })
      const firstTab = POSTING_PLATFORMS.find(p => (r.drafts as Record<string, Post>)[p.derivedFrom ?? p.platform])?.platform
      if (firstTab) setActiveTab(firstTab)
      setLoaded(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the search dropdown on an outside click
  useEffect(() => {
    if (!showResults) return
    const close = () => setShowResults(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showResults])

  // AI Photos: the article's source abstract, when the tab opens
  useEffect(() => {
    if (activeTab !== 'ai_photos' || !articleId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await createClient().from('articles').select('abstract, summary, clinical_bottom_line').eq('id', articleId).single()
        if (error || !data) throw new Error(error?.message ?? 'no data')
        if (!cancelled) { setPhotoArticle({ id: articleId, ...data }); setPhotoError(null) }
      } catch {
        if (!cancelled) setPhotoError("Couldn't load the article's abstract — switch tabs and back to retry.")
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, articleId])

  // ─── Article choice: recommendations + search ───────────────────────────────────────────────────────────────
  const loadRecommendations = async () => {
    setLoadingRecs(true)
    try {
      setRecsError(null)
      const res = await fetch('/api/admin/growth/recommendations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`)
      setRecommendations(data.recommendations || [])
      setEligibleCount(data.eligible_count ?? null)
      setRecsMeta({ scored: data.scored_count ?? 0, degraded: !!data.degraded, errors: data.scoring_errors ?? 0 })
    } catch (e) {
      setRecommendations([])
      setRecsError(`Couldn't load recommendations: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setShowRecs(true)
      setLoadingRecs(false)
    }
  }

  // Dismiss permanently (irrelevant / already_published); put it back if the write didn't land
  const dismiss = async (id: string, outcome: 'irrelevant' | 'already_published') => {
    const item = recommendations.find(a => a.id === id)
    setRecommendations(prev => prev.filter(a => a.id !== id))
    try {
      const res = await fetch('/api/admin/growth/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ article_id: id, outcome }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      if (item) setRecommendations(prev => prev.some(a => a.id === id) ? prev : [...prev, item].sort((x, y) => y.score - x.score))
      setRecsError("Dismissal wasn't saved — try again")
    }
  }

  const searchArticles = async (q: string) => {
    if (q.length < 3) { setResults([]); setShowResults(false); return }
    try {
      const res = await fetch(`/api/articles/search-quick?q=${encodeURIComponent(q)}&limit=5`)
      const data = await res.json()
      setResults(data.articles || [])
      setShowResults(true)
    } catch { setResults([]) }
  }

  // ─── Generation ─────────────────────────────────────────────────────────────────────────────────────────────
  const recentPosts = () => {
    const out: string[] = []
    for (let i = 1; i <= 7; i++) {
      const s = readStore(israelDateMinus(today, i))
      const first = s && Object.values(s.posts)[0]
      if (first?.post_content) out.push(first.post_content.slice(0, 100))
    }
    return out
  }

  const noteExclusions = (labels?: string[]) => {
    const excluded = (labels || []).filter(l => NORMALLY_EXCLUDED.includes(l))
    setExclusionNote(excluded.length ? `Labeled: ${excluded.join(', ')} — normally excluded from the automatic pick` : null)
  }

  // One article for every platform: the day's article if anything is posted today, else the selection, else the
  // server picks one with the first platform and every other platform is forced to it.
  const generateAll = async (keepExisting = false) => {
    if (!ready || marking || dayChanged()) return
    const locked: Article | null = dayArticle ?? selected
    setBusy('all'); setMessage(null); setFailed([])
    const recent = recentPosts()
    const next: Record<string, Post> = keepExisting ? { ...posts } : {}
    const todo = GENERATED_PLATFORMS.filter(p => !(keepExisting && next[p.platform]))
    let shared: string | null = locked?.id ?? (keepExisting ? articleId : null)
    const failedNow: string[] = []
    try {
      // the first platform fixes the article when the server picks (up to 3 tries if it lands on a large-animal one)
      const queue = [...todo]
      if (!shared && queue.length) {
        const first = queue.shift()!
        let got: GenerateResult | null = null
        for (let attempt = 0; attempt < 3 && !got; attempt++) {
          const r = await generate({ platform: first.platform, language: first.language, recentPosts: recent })
          if (r.ok) got = r.data
          else if (r.status >= 400 && r.status < 500) { setMessage({ type: 'error', text: r.error }); return }
        }
        if (!got) { setMessage({ type: 'error', text: 'Could not find a suitable article after 3 attempts' }); return }
        shared = got.article_id
        next[first.platform] = { ...toPost(got, first.language), crowd_favorite: !!got.crowd_favorite }
        noteExclusions(got.article_labels)
      }
      // the rest, forced to the shared article, 3 at a time, each echo-checked
      while (queue.length) {
        const batch = queue.splice(0, 3)
        const settled = await Promise.all(batch.map(async p => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const r = await generate({ platform: p.platform, language: p.language, recentPosts: recent, article_id: shared! })
            if (r.ok && r.data.article_id === shared) return { p, data: r.data }
            if (r.ok) return { p, mismatch: r.data.article_title ?? r.data.article_id }
            if (r.status >= 400 && r.status < 500) return { p, error: r.error }
            await new Promise(res => setTimeout(res, 1000))
          }
          return { p, error: 'failed twice' }
        }))
        for (const s of settled) {
          if ('data' in s && s.data) {
            next[s.p.platform] = { ...toPost(s.data, s.p.language), crowd_favorite: locked?.crowdFavorite || !!s.data.crowd_favorite }
            noteExclusions(s.data.article_labels)
          } else {
            failedNow.push(s.p.platform)
            if ('mismatch' in s) setMessage({ type: 'error', text: `${s.p.platform} came back for another article ("${s.mismatch}") — not kept` })
          }
        }
        if (queue.length) await new Promise(res => setTimeout(res, 500))
      }
      setPosts(next)
      setFailed(failedNow)
      if (!activeTab || !next[activeTab]) setActiveTab(POSTING_PLATFORMS.find(p => next[p.derivedFrom ?? p.platform])?.platform ?? '')
      const made = Object.keys(next).length
      setMessage(prev => prev?.type === 'error' && failedNow.length ? prev : {
        type: failedNow.length ? 'error' : 'success',
        text: `${failedNow.length ? '⚠️' : '✅'} ${made}/${GENERATED_PLATFORMS.length} posts for one article${failedNow.length ? ` — failed: ${failedNow.join(', ')}` : ''} (Telegram follows WhatsApp)`,
      })
    } finally {
      setBusy(null)
    }
  }

  const regenerateAll = async () => {
    if (!ready || marking || posted.size > 0) return
    setPosts({}); setImage(null)
    await generateAll(false)
  }

  // Rewrite / regenerate one card, always for the day's article, echo-checked
  const rewrite = async (platform: string, instruction?: string) => {
    const info = platformInfo(platform)
    const current = posts[platform]
    if (!info || !articleId) return
    setBusy(`rewrite:${platform}`)
    try {
      let abstractOverride: string | undefined
      if (instruction === TIGHTEN_INSTRUCTION) {
        const { data } = await createClient().from('articles').select('summary, clinical_bottom_line').eq('id', articleId).single()
        abstractOverride = data?.summary || data?.clinical_bottom_line || undefined
        if (!abstractOverride) { setMessage({ type: 'error', text: 'No study summary available for this article' }); return }
      }
      const r = await generate({
        platform, language: info.language, article_id: articleId,
        ...(instruction && current ? { style_instruction: instruction, existing_post: current.post_content } : {}),
        ...(abstractOverride ? { abstract_override: abstractOverride } : {}),
      })
      if (!r.ok) { setMessage({ type: 'error', text: r.error }); return }
      if (r.data.article_id !== articleId) { setMessage({ type: 'error', text: `Came back for another article ("${r.data.article_title}") — not kept` }); return }
      const next = { ...posts, [platform]: { ...toPost(r.data, info.language), crowd_favorite: current?.crowd_favorite } }
      setPosts(next)
      setFailed(f => f.filter(p => p !== platform))
    } finally {
      setBusy(null)
    }
  }

  // ─── Posting ────────────────────────────────────────────────────────────────────────────────────────────────
  // One write per platform + article in this page (double clicks); the server keeps one row per day across reloads
  const guard = useRef(onceGuard<string>(async key => {
    const [platform, article, hook] = JSON.parse(key) as [string, string, string | undefined]
    try {
      const res = await fetch('/api/growth/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article, platform, language: platformInfo(platform)?.language ?? 'en', outcome: 'approved', hook_line: hook ?? null }),
      })
      const data = await res.json().catch(() => ({}))
      return res.ok && data.id ? String(data.id) : null
    } catch { return null }
  }))

  const copyAndMark = async (platform: string) => {
    const text = textFor(platform)
    if (!text || !articleId) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setCopyFailed(platform)
      setMessage({ type: 'error', text: `Copy failed — nothing was marked. Select the text and copy it by hand${posted.has(platform) ? '' : ', then press "I copied it by hand"'}` })
      return
    }
    setCopyFailed(null)
    setCopiedTab(platform); setTimeout(() => setCopiedTab(t => (t === platform ? null : t)), 2000)
    await markPosted(platform, text)
  }

  // the approval write — never while the article can still change (Generate All / Retry running), never before
  // today's posted state loaded, never across midnight
  const markPosted = async (platform: string, text: string) => {
    if (!articleId || posted.has(platform)) return
    if (!ready) { setMessage({ type: 'error', text: "Copied — but NOT marked posted: today's posted state didn't load. Press Retry loading, then mark again." }); return }
    if (busy === 'all') { setMessage({ type: 'error', text: 'Copied — but NOT marked posted while posts are generating. Mark it once they are done.' }); return }
    if (dayChanged()) return
    setCopyFailed(null)
    setMarking(platform)
    const id = await guard.current(JSON.stringify([platform, articleId, hookOf(text)]))
    setMarking(null)
    if (!id) {
      setMessage({ type: 'error', text: `⚠️ ${platformInfo(platform)?.name}: copied, but NOT marked as posted — try again${platform === 'facebook_il' ? ' (vetree.app/il would open the previous article)' : ''}` })
      return
    }
    setRows(prev => prev.some(r => r.id === id) ? prev : [...prev, { id, article_id: articleId, platform, created_at: new Date().toISOString(), posted_url: null }])
    if (!dayArticle) setDayArticle({ id: articleId, title: articleTitle ?? articleId })
    setMessage({ type: 'success', text: `✅ ${platformInfo(platform)?.name}: copied and marked posted${platform === 'facebook_il' ? ' — vetree.app/il opens this article' : ''}` })
  }

  const skip = async (platform: string) => {
    if (!articleId) return
    fetch('/api/growth/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId, platform, language: platformInfo(platform)?.language ?? 'en', outcome: 'skipped' }),
    }).catch(() => { /* a lost skip only weakens the agent's learning */ })
    const next = { ...posts }
    delete next[platform]
    setPosts(next)
    setMessage({ type: 'success', text: `Skipped ${platformInfo(platform)?.name}` })
  }

  // LinkedIn URL — saved by the approval row's id (never by date: midnight / time zones)
  const saveRowUrl = async (rowId: string, url: string) => {
    const clean = url.trim()
    if (!clean) return
    setUrlSaving(p => ({ ...p, [rowId]: true }))
    try {
      const res = await fetch('/api/admin/growth/memory/posted-url', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rowId, posted_url: clean }) })
      if (res.ok) {
        setRows(prev => prev.map(r => (r.id === rowId ? { ...r, posted_url: clean } : r)))
        setMissingUrls(prev => prev.filter(r => r.id !== rowId))
        setUrlDrafts(p => { const n = { ...p }; delete n[rowId]; return n })
      } else {
        setMessage({ type: 'error', text: "LinkedIn URL wasn't saved — try again" })
      }
    } catch {
      setMessage({ type: 'error', text: "LinkedIn URL wasn't saved — try again" })
    } finally {
      setUrlSaving(p => ({ ...p, [rowId]: false }))
    }
  }

  const generateImage = async () => {
    const first = GENERATED_PLATFORMS.find(p => posts[p.platform])
    if (!first || !articleId) return
    setBusy('img')
    try {
      const { data: article } = await createClient().from('articles').select('abstract, summary, clinical_bottom_line').eq('id', articleId).single()
      const res = await fetch('/api/growth/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Source abstract first; the AI summary only for the few articles without one
        body: JSON.stringify({ post_text: posts[first.platform].post_content, article_id: articleId, abstract_text: article?.abstract || article?.summary || article?.clinical_bottom_line || null }),
      })
      const data = await res.json()
      if (data.image) setImage(data.image)
      else setMessage({ type: 'error', text: data.error || 'Image generation failed' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate image' })
    } finally {
      setBusy(null)
    }
  }

  // ─── View ───────────────────────────────────────────────────────────────────────────────────────────────────
  const hasPosts = Object.keys(posts).length > 0
  const allPosted = POSTING_PLATFORMS.every(p => posted.has(p.platform))
  const linkedinRow = rows.find(r => r.platform === 'linkedin' && r.article_id === articleId)
  const chip = (on: boolean) => `px-3 py-1 text-xs rounded-full transition ${on ? 'bg-emerald-700 text-white' : 'bg-zinc-700 dark:bg-zinc-800 text-zinc-300 hover:bg-zinc-600 dark:hover:bg-zinc-700'}`

  return (
    <div className="space-y-6">
      {/* Missing LinkedIn post URLs — from the database, survives reloads */}
      {missingUrls.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-700/50 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1">🔗 Missing LinkedIn post URLs ({missingUrls.length})</h3>
          <p className="text-xs text-amber-700/80 dark:text-amber-500/70 mb-3">
            These were marked posted but never got a URL saved — without it they can only match to metrics via slug/date/AI, not the more reliable activity_id.
          </p>
          <div className="space-y-2">
            {missingUrls.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#1A1A1A] rounded-md p-2.5">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm text-[#1A1A1A] dark:text-[#E8E8E8] truncate">{row.article_title || row.article_id}</div>
                  <div className="text-xs text-zinc-500">{row.date}</div>
                </div>
                <input
                  type="text" value={urlDrafts[row.id] || ''} placeholder="https://www.linkedin.com/posts/..."
                  onChange={e => setUrlDrafts(p => ({ ...p, [row.id]: e.target.value }))}
                  onPaste={e => {
                    const pasted = e.clipboardData.getData('text').trim()
                    if (pasted.startsWith('https://www.linkedin.com/')) { e.preventDefault(); setUrlDrafts(p => ({ ...p, [row.id]: pasted })); saveRowUrl(row.id, pasted) }
                  }}
                  className="flex-1 min-w-[220px] text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                />
                <button type="button" disabled={urlSaving[row.id] || !(urlDrafts[row.id] || '').trim()} onClick={() => saveRowUrl(row.id, urlDrafts[row.id] || '')}
                  className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-50 transition">
                  {urlSaving[row.id] ? 'Saving…' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`bg-white dark:bg-[#1A1A1A] border-2 rounded-lg p-6 transition-colors ${allPosted ? 'border-green-500 dark:border-green-600' : 'border-zinc-200 dark:border-zinc-800'}`} data-testid="daily-posts">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">Today&apos;s Posts</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {today} · one article, every platform{streak && ` · 🔥 ${streak.days}${streak.capped ? '+' : ''}-day streak`}
            </p>
          </div>
          <div className="text-sm text-zinc-500" data-testid="posted-count">{posted.size}/{POSTING_PLATFORMS.length} posted</div>
        </div>

        {loadError && (
          <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 flex flex-wrap items-center gap-3" data-testid="load-error">
            <span className="flex-1">{loadError}</span>
            <button type="button" onClick={onReload} className="px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white">↻ Retry loading</button>
          </div>
        )}
        {message && (
          <div data-testid="daily-message" className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* The day's article */}
        {articleId && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-700/50" data-testid="day-article">
            <span className="text-emerald-400 text-xs font-medium">{dayArticle ? 'Today\'s article (posted — fixed for the day)' : busy === 'all' ? 'Generating for:' : 'Generated for:'}</span>
            <a href={`/article/${articleId}`} target="_blank" rel="noopener noreferrer" className="block text-white text-sm truncate mt-0.5 hover:text-emerald-300">{articleTitle ?? articleId}</a>
            <p className="text-zinc-500 text-xs mt-0.5">{articleId}</p>
          </div>
        )}
        {exclusionNote && <div className="mb-3 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/50"><span className="text-amber-400 text-xs">⚠ {exclusionNote}</span></div>}

        {/* Choosing the article — only before anything is posted or generated */}
        {!articleId && !hasPosts && (
          <>
            <div className="mb-4">
              <button type="button" onClick={loadRecommendations} disabled={loadingRecs} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition">
                {loadingRecs ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><span>✨</span> Show recommended articles to post</>}
              </button>
              {showRecs && (
                <div className="mt-3">
                  {recsError && <p className="mb-2 text-xs text-red-400">{recsError}</p>}
                  {!recsError && recommendations.length === 0 && <p className="mb-2 text-xs text-gray-500">No eligible articles right now — everything recent is posted, dismissed or skipped.</p>}
                  {eligibleCount !== null && recommendations.length > 0 && (
                    <p className="mb-2 text-xs text-gray-600">
                      {recommendations.some(r => r.wildcard) ? `${recommendations.length - 1} top picks + 1 wildcard` : `Top ${recommendations.length}`} of {eligibleCount} eligible
                      {recsMeta && ` · ${recsMeta.scored} scored for practice / talk-worthiness / WOW`}
                      {recsMeta?.degraded && ' · scores unavailable, ranked by evidence + recency'}
                      {recsMeta && !recsMeta.degraded && recsMeta.errors > 0 && ' · some new articles couldn\'t be scored this time'}
                    </p>
                  )}
                  <div className="space-y-2">
                    {recommendations.map((a, i) => (
                      <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-emerald-700 transition group">
                        <span className="text-lg font-bold text-gray-600 w-6 shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelected({ id: a.id, title: a.title, crowdFavorite: !!a.crowdFavorite }); setShowRecs(false) }}>
                          <p className="text-sm text-white font-medium truncate group-hover:text-emerald-300">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.scores?.reason || a.clinical_bottom_line}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <div className="flex gap-1 flex-wrap">
                              {(a.labels || []).filter((l: string) => !['Small Animal', 'Large Animal'].includes(l)).slice(0, 2).map((l: string) => (
                                <span key={l} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{l}</span>
                              ))}
                            </div>
                            {a.wildcard && <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs shrink-0" title="Deliberately low-ranked — room for serendipity. Dismiss it if it's bad: that's data too.">🎲 Wildcard</span>}
                            {a.scores?.wow >= 7 && <span className="px-1.5 py-0.5 bg-pink-900/40 text-pink-300 rounded text-xs shrink-0">⚡ WOW</span>}
                            {a.scores?.practice >= 7 && <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 rounded text-xs shrink-0">Practice</span>}
                            {a.scores?.talk >= 7 && <span className="px-1.5 py-0.5 bg-sky-900/40 text-sky-300 rounded text-xs shrink-0">Talk-worthy</span>}
                            {!a.scores && <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs shrink-0">Not yet scored</span>}
                            {a.crowdFavorite && <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 rounded text-xs shrink-0" title={`${a.socialClicks} social clicks when first posted`}>⭐ Crowd favorite</span>}
                            <span className="text-xs text-gray-600 truncate">{a.source_journal}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button type="button" title="Already published" onClick={e => { e.stopPropagation(); dismiss(a.id, 'already_published') }} className="text-xs text-gray-600 hover:text-emerald-400 transition px-1.5 py-0.5 rounded hover:bg-gray-700">✓ posted</button>
                          <button type="button" title="Not relevant — never recommend again" onClick={e => { e.stopPropagation(); dismiss(a.id, 'irrelevant') }} className="text-xs text-gray-600 hover:text-red-400 transition px-1.5 py-0.5 rounded hover:bg-gray-700">✕ not relevant</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowRecs(false)} className="mt-2 text-xs text-gray-600 hover:text-gray-400">Hide recommendations</button>
                </div>
              )}
            </div>

            <div className="relative mb-3">
              {selected ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 border border-emerald-700 rounded-lg text-sm">
                  <span className="text-emerald-300">📄</span>
                  <span className="text-emerald-200 flex-1 truncate">{selected.title}</span>
                  <button onClick={() => { setSelected(null); setSearch(''); setExclusionNote(null) }} className="text-gray-400 hover:text-white transition-colors text-lg leading-none" aria-label="Clear selection">×</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" value={search} placeholder="🔍 Search for specific article (optional)"
                    onChange={e => { setSearch(e.target.value); searchArticles(e.target.value) }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-600" />
                  {showResults && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                      {results.map(a => (
                        <button key={a.id} type="button" onClick={() => { setSelected({ id: a.id, title: a.title }); setSearch(''); setShowResults(false) }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-700 transition border-b border-gray-700 last:border-0">
                          <p className="text-sm text-white truncate">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{a.source_journal}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={`w-full mb-3 px-3 py-2 rounded-lg border text-sm ${selected ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-zinc-800/60 border-zinc-700'}`}>
              {selected
                ? <><span className="text-emerald-400 text-xs font-medium">Forced selection</span><p className="text-white truncate mt-0.5 text-sm">{selected.title}</p><p className="text-zinc-500 text-xs mt-0.5">{selected.id}</p></>
                : <span className="text-zinc-500 text-xs">Article will be auto-selected — or pick a recommendation / search above to force one</span>}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-4">
          {!hasPosts ? (
            <button type="button" onClick={() => generateAll(false)} disabled={!ready || !!busy || !!marking} data-testid="generate-all"
              className="px-6 py-3 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2">
              {busy === 'all' ? <><Loader2 size={14} className="animate-spin" /> Generating all...</>
                : dayArticle ? `⚡ Generate All — ${dayArticle.title.slice(0, 40)}${dayArticle.title.length > 40 ? '…' : ''}`
                : selected ? `⚡ Generate All — ${selected.title.slice(0, 40)}${selected.title.length > 40 ? '…' : ''}`
                : '⚡ Generate All Platforms'}
            </button>
          ) : (
            <>
              <button type="button" onClick={regenerateAll} disabled={!ready || !!busy || !!marking || posted.size > 0} title={posted.size > 0 ? 'Some posts are already out — regenerate single cards instead' : undefined}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {busy === 'all' ? <><Loader2 size={14} className="animate-spin" /> Regenerating...</> : '🔄 Regenerate All'}
              </button>
              {failed.length > 0 && (
                <button type="button" onClick={() => generateAll(true)} disabled={!ready || !!busy || !!marking}
                  className="px-4 py-3 bg-orange-700 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  🔁 Retry Failed ({failed.length})
                </button>
              )}
            </>
          )}
        </div>

        {/* One tab per platform + AI Photos */}
        {hasPosts && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1 mb-3" role="tablist">
              {POSTING_PLATFORMS.map(p => {
                const has = !!textFor(p.platform)
                if (!has && !failed.includes(p.platform)) return null
                return (
                  <button key={p.platform} type="button" role="tab" aria-selected={activeTab === p.platform} onClick={() => setActiveTab(p.platform)} className={chip(activeTab === p.platform)} data-testid={`tab-${p.platform}`}>
                    {p.icon} {p.name}{posted.has(p.platform) ? ' ✅' : !has ? ' ⚠️' : ''}
                  </button>
                )
              })}
              <button type="button" role="tab" aria-selected={activeTab === 'ai_photos'} onClick={() => setActiveTab('ai_photos')} className={chip(activeTab === 'ai_photos')}>🎨 AI Photos</button>
            </div>

            {activeTab && activeTab !== 'ai_photos' && (() => {
              const info = platformInfo(activeTab)
              const text = textFor(activeTab)
              if (!info) return null
              if (!text) return <div className="p-4 rounded-lg border border-zinc-700 text-sm text-zinc-400">No post for {info.name} — use Retry Failed{info.derivedFrom ? ` (Telegram follows ${platformInfo(info.derivedFrom)?.name})` : ''}.</div>
              const isPosted = posted.has(activeTab)
              return (
                <div className="relative bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 border border-zinc-700 dark:border-zinc-800" data-testid={`card-${activeTab}`}>
                  {busy === `rewrite:${activeTab}` && (
                    <div className="absolute inset-0 bg-zinc-900/80 rounded-lg flex items-center justify-center z-10">
                      <div className="flex items-center gap-2 text-zinc-300"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Rewriting...</span></div>
                    </div>
                  )}
                  {info.derivedFrom && <p className="text-xs text-zinc-500 mb-2">The {platformInfo(info.derivedFrom)?.name} post with Telegram tracking — edit it on the {platformInfo(info.derivedFrom)?.name} card.</p>}
                  <pre className="whitespace-pre-wrap text-sm font-mono text-zinc-200 dark:text-zinc-300" data-testid="post-text">{text}</pre>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button type="button" onClick={() => copyAndMark(activeTab)} disabled={marking === activeTab || busy === 'all'} data-testid="copy-mark"
                      className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-md transition font-medium ${isPosted ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-green-600 hover:bg-green-700 text-white'} disabled:opacity-60`}>
                      {copiedTab === activeTab ? <Check size={14} /> : <Copy size={14} />}
                      {marking === activeTab ? 'Marking…' : isPosted ? 'Copy again (posted ✅)' : 'Copy & mark posted'}
                    </button>
                    {copyFailed === activeTab && !isPosted && (
                      <button type="button" onClick={() => markPosted(activeTab, text)} disabled={marking === activeTab || busy === 'all'} data-testid="mark-manual"
                        className="text-sm px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-md transition disabled:opacity-50">I copied it by hand — mark posted</button>
                    )}
                    {!isPosted && !info.derivedFrom && (
                      <button type="button" onClick={() => skip(activeTab)} disabled={!!busy} className="text-sm px-3 py-2 bg-zinc-700 text-zinc-300 rounded-md hover:bg-zinc-600 transition disabled:opacity-50">⏭ Skip</button>
                    )}
                  </div>

                  {/* LinkedIn: the post's URL, saved on the approval row (by id) */}
                  {activeTab === 'linkedin' && linkedinRow && !linkedinRow.posted_url && (
                    <div className="mt-3 flex flex-col gap-2 p-3 rounded-md bg-amber-950/30 border border-amber-700/40">
                      <p className="text-xs text-amber-400">Paste the LinkedIn post URL to enable exact metrics matching:</p>
                      <div className="flex gap-2">
                        <input type="text" autoFocus value={urlDrafts[linkedinRow.id] || ''} placeholder="https://www.linkedin.com/posts/..."
                          onChange={e => setUrlDrafts(p => ({ ...p, [linkedinRow.id]: e.target.value }))}
                          onPaste={e => {
                            const pasted = e.clipboardData.getData('text').trim()
                            if (pasted.startsWith('https://www.linkedin.com/')) { e.preventDefault(); setUrlDrafts(p => ({ ...p, [linkedinRow.id]: pasted })); saveRowUrl(linkedinRow.id, pasted) }
                          }}
                          className="flex-1 text-xs bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500" />
                        <button type="button" disabled={urlSaving[linkedinRow.id] || !(urlDrafts[linkedinRow.id] || '').trim()} onClick={() => saveRowUrl(linkedinRow.id, urlDrafts[linkedinRow.id] || '')}
                          className="text-xs px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50 transition">
                          {urlSaving[linkedinRow.id] ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                  {activeTab === 'linkedin' && linkedinRow?.posted_url && (
                    <div className="mt-3 px-3 py-2 rounded-md bg-green-950/30 border border-green-700/40 flex items-center gap-2">
                      <span className="text-xs text-green-400 font-medium">✓ URL saved</span>
                      <span className="text-xs text-zinc-500 truncate">{linkedinRow.posted_url}</span>
                    </div>
                  )}

                  {/* Rewrites — not on Telegram (it follows WhatsApp) */}
                  {!info.derivedFrom && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {Object.entries(STYLE_PROMPTS).map(([key, instruction]) => (
                        <button key={key} type="button" onClick={() => rewrite(activeTab, instruction)} disabled={!!busy}
                          className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-full transition capitalize disabled:opacity-50">✏️ {key}</button>
                      ))}
                      <button type="button" onClick={() => rewrite(activeTab, TIGHTEN_INSTRUCTION)} disabled={!!busy}
                        className="px-3 py-1 text-xs bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded-full transition disabled:opacity-50">📄 Tighten to abstract</button>
                      <button type="button" onClick={() => rewrite(activeTab)} disabled={!!busy}
                        className="px-3 py-1 text-xs bg-blue-900 hover:bg-blue-800 text-blue-200 rounded-full transition disabled:opacity-50">🔄 Regenerate</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* AI Photos — the prompt for ChatGPT from the source abstract, and Generate Images */}
            {activeTab === 'ai_photos' && (
              <div className="bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 border border-zinc-700 dark:border-zinc-800">
                {photo && !photo.abstract && <p className="text-xs text-amber-400 mb-2">⚠️ This article has no source abstract — the prompt uses the AI summary instead.</p>}
                <p className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap mb-3" data-testid="ai-photos-prompt">
                  {photo ? buildPhotoPrompt(photo.abstract || photo.summary || photo.clinical_bottom_line || '') : (photoError ?? 'Loading article abstract...')}
                </p>
                <div className="flex gap-2 mb-4">
                  <button type="button" disabled={!photo}
                    onClick={async () => {
                      if (!photo) return
                      try {
                        await navigator.clipboard.writeText(buildPhotoPrompt(photo.abstract || photo.summary || photo.clinical_bottom_line || ''))
                        setPhotoError(null); setPhotoCopied(true); setTimeout(() => setPhotoCopied(false), 2000)
                      } catch { setPhotoError('Copy failed — select the prompt text above and copy it manually.') }
                    }}
                    className="flex items-center gap-1.5 text-sm text-zinc-900 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-md transition disabled:opacity-50">
                    {photoCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy prompt for ChatGPT</>}
                  </button>
                </div>
                {photo && photoError && <p className="text-xs text-red-400 -mt-2 mb-4">{photoError}</p>}
                <button type="button" onClick={generateImage} disabled={!!busy || !photo}
                  className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-md transition disabled:opacity-50">
                  {busy === 'img' ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : '🎨 Generate Images'}
                </button>
                {image && (
                  <div className="mt-4 space-y-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Generated image" className="rounded-lg w-full border border-zinc-700 object-cover" />
                    <div className="flex justify-end">
                      <a href={image} download={`vetree-ai-photos-${today}.jpg`} className="text-xs text-zinc-400 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded transition">⬇️ Download</a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
