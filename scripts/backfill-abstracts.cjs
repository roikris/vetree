// Backfill articles.abstract (migration 057) from PubMed.
//
// Why: until 057, ingestion kept the abstract only in `summary`, and enrichment overwrote
// it — so for enriched articles the source text exists nowhere in the database. PubMed is
// the source of truth, re-fetched by pubmed_id and parsed by the SAME code ingestion uses
// (.github/workflows/scripts/pubmed-abstract.js), so backfilled and newly ingested
// abstracts are identical in form. Note it is PubMed's CURRENT text (abstract_fetched_at
// records when), which may differ from what was originally ingested.
//
// Writes ONLY abstract + abstract_fetched_at, and only where abstract is still null (never
// clobbers a value written by ingestion meanwhile). Summaries, bottom lines, labels
// untouched. Never copies `summary` into `abstract`: summary can't be reliably told apart
// from AI text. Rows PubMed can't supply are listed at the end for a manual decision.
// Idempotent: re-running resumes with whatever is still null.
//
// Run:
//   node --env-file=.env.local scripts/backfill-abstracts.cjs --dry-run
//   node --env-file=.env.local scripts/backfill-abstracts.cjs
// NCBI_API_KEY is optional: with it NCBI allows 10 req/s, without it 3 req/s.

const { createClient } = require('@supabase/supabase-js')
const { extractAbstractsFromXml } = require('../.github/workflows/scripts/pubmed-abstract')

const DRY_RUN = process.argv.includes('--dry-run')
const EFETCH_BATCH = 200
const PAGE = 1000
const WRITE_CONCURRENCY = 10
const WRITE_PAUSE_MS = 100 // between groups of concurrent writes: ~100 writes/s ceiling
const EFETCH_DELAY_MS = process.env.NCBI_API_KEY ? 120 : 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function efetch(pmids) {
  const body = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml' })
  if (process.env.NCBI_API_KEY) body.set('api_key', process.env.NCBI_API_KEY)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt)
    try {
      const res = await fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
        method: 'POST', // POST: 200 ids overflow a GET URL
        body,
        headers: { 'User-Agent': 'Vetree/1.0 (abstract backfill)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()
      if (!xml.includes('<PubmedArticleSet')) throw new Error('response is not a PubmedArticleSet')
      return extractAbstractsFromXml(xml)
    } catch (e) {
      if (attempt === 3) throw e
      console.warn(`  efetch retry ${attempt + 1}: ${e.message}`)
    }
  }
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const stats = { scanned: 0, written: 0, wouldWrite: 0, noAbstractOnPubmed: 0, notReturned: 0, noPmid: 0, alreadyFilled: 0, writeErrors: 0 }
  const samples = []

  let lastId = null
  for (;;) {
    let q = supabase.from('articles').select('id, pubmed_id').is('abstract', null).order('id').limit(PAGE)
    if (lastId !== null) q = q.gt('id', lastId)
    const { data: rows, error } = await q
    if (error) throw new Error(`select failed after ${stats.scanned} rows: ${error.message}`)
    if (!rows.length) break
    lastId = rows[rows.length - 1].id
    stats.scanned += rows.length

    const withPmid = rows.filter((r) => /^\d+$/.test(r.pubmed_id || ''))
    stats.noPmid += rows.length - withPmid.length

    for (let i = 0; i < withPmid.length; i += EFETCH_BATCH) {
      const batch = withPmid.slice(i, i + EFETCH_BATCH)
      const abstracts = await efetch(batch.map((r) => r.pubmed_id))
      await sleep(EFETCH_DELAY_MS)

      const writes = []
      for (const r of batch) {
        if (!abstracts.has(r.pubmed_id)) { stats.notReturned++; continue }
        const text = abstracts.get(r.pubmed_id)
        if (!text) { stats.noAbstractOnPubmed++; continue }
        if (samples.length < 3) samples.push({ id: r.id, pmid: r.pubmed_id, chars: text.length, start: text.slice(0, 140) })
        writes.push({ id: r.id, text })
      }
      if (DRY_RUN) { stats.wouldWrite += writes.length; continue }

      const fetchedAt = new Date().toISOString()
      for (let j = 0; j < writes.length; j += WRITE_CONCURRENCY) {
        await Promise.all(writes.slice(j, j + WRITE_CONCURRENCY).map(async (w) => {
          const { data, error } = await supabase
            .from('articles')
            .update({ abstract: w.text, abstract_fetched_at: fetchedAt })
            .eq('id', w.id)
            .is('abstract', null) // never clobber
            .select('id')
          if (error) { stats.writeErrors++; console.error(`  write ${w.id}: ${error.message}`) }
          else if (!data.length) stats.alreadyFilled++
          else stats.written++
        }))
        await sleep(WRITE_PAUSE_MS)
      }
    }
    console.log(`scanned ${stats.scanned} | ${DRY_RUN ? `would write ${stats.wouldWrite}` : `written ${stats.written}`} | no abstract on PubMed ${stats.noAbstractOnPubmed} | not returned ${stats.notReturned} | no PMID ${stats.noPmid}`)
  }

  console.log('\n' + (DRY_RUN ? 'DRY RUN — nothing written' : 'DONE'))
  console.log(stats)
  console.log('samples:', samples)

  if (!DRY_RUN) {
    // What is still without a source, split by what it means for enrichment
    const base = () => supabase.from('articles').select('id', { count: 'exact', head: true }).is('abstract', null)
    const [all, queued, queuedPublished] = await Promise.all([
      base(),
      base().eq('needs_enrichment', true),
      base().eq('needs_enrichment', true).not('clinical_bottom_line', 'is', null),
    ])
    const countErr = [all, queued, queuedPublished].find((r) => r.error || r.count == null)
    if (countErr) throw new Error(`residual count failed: ${countErr.error?.message ?? 'null count'}`)
    console.log('still without abstract:', {
      total: all.count,
      queuedUnpublished_waitForever: (queued.count ?? 0) - (queuedPublished.count ?? 0),
      queuedPublished_willBeReleased: queuedPublished.count,
    })
  }
  if (stats.writeErrors) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
