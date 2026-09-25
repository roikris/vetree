// Backfill articles.publication_date from PubMed's exact online date.
//
// Why: ingestion read only the journal ISSUE date, which for continuous-publication
// journals and not-yet-issued articles carries only a year (or year + month), so dates were
// pinned to YYYY-01-01 / YYYY-MM-01. On 2026-09-25: 8,590 of 20,798 public articles were
// dated Jan 1 and 15,150 the 1st of a month — wrong on the page, and sunk in the
// publication_date-sorted homepage feed. Parsed by the SAME code ingestion now uses
// (.github/workflows/scripts/pubmed-date.js).
//
// Writes ONLY publication_date, and only to replace a placeholder: the stored date is null
// or falls on the 1st, PubMed now has a day-precise date, and they differ. A stored full
// date that disagrees with PubMed (issue date vs online date, typically days apart) is
// counted and reported, never overwritten. Each write re-asserts the value it read, so a
// row changed meanwhile is skipped. Idempotent: re-running finds nothing left to replace.
//
// Sanity rule: a replacement is refused (counted as `implausible`, listed for review) if
// the new date is before 1950, after today, or more than 3 years from the stored year —
// PubMed data-entry errors exist (the first dry run proposed 2021 -> 1909).
//
// Every write is recorded in a JSONL manifest ({id, pmid, from, to, source}) — required for a
// real run, since a stored 1st-of-month date is not proof of a placeholder and rollback must
// be exact: restore each row's `from` where publication_date still equals `to`. The file is
// created exclusively BEFORE any update (a bad path aborts with nothing written), and each
// entry is written and fsynced BEFORE its update is sent. An entry whose update then failed
// or was skipped is harmless: the row never equals `to`, so rollback leaves it alone.
//
// Run:
//   node --env-file=.env.local scripts/backfill-publication-dates.cjs --dry-run
//   node --env-file=.env.local scripts/backfill-publication-dates.cjs --manifest=<path.jsonl>

const { createClient } = require('@supabase/supabase-js')
const { extractPublicationDatesFromXml } = require('../.github/workflows/scripts/pubmed-date')

const fs = require('fs')
const DRY_RUN = process.argv.includes('--dry-run')
const MANIFEST = process.argv.find((a) => a.startsWith('--manifest='))?.slice('--manifest='.length)
if (!DRY_RUN && !MANIFEST) {
  console.error('A real run needs --manifest=<path.jsonl> (full before/after record for rollback).')
  process.exit(1)
}
let manifestFd = null
if (MANIFEST) {
  try {
    manifestFd = fs.openSync(MANIFEST, 'wx') // exclusive: fails if it exists or the dir is missing
  } catch (e) {
    console.error(`Cannot create manifest ${MANIFEST}: ${e.message}. Nothing written.`)
    process.exit(1)
  }
}
const EFETCH_BATCH = 200
const PAGE = 1000
const WRITE_CONCURRENCY = 10
const WRITE_PAUSE_MS = 100
const EFETCH_DELAY_MS = process.env.NCBI_API_KEY ? 120 : 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function efetch(pmids) {
  const body = new URLSearchParams({ db: 'pubmed', id: pmids.join(','), retmode: 'xml' })
  if (process.env.NCBI_API_KEY) body.set('api_key', process.env.NCBI_API_KEY)
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt)
    try {
      const res = await fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi', {
        method: 'POST',
        body,
        headers: { 'User-Agent': 'Vetree/1.0 (publication-date backfill)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()
      if (!xml.includes('<PubmedArticleSet')) throw new Error('response is not a PubmedArticleSet')
      return extractPublicationDatesFromXml(xml)
    } catch (e) {
      if (attempt === 3) throw e
      console.warn(`  efetch retry ${attempt + 1}: ${e.message}`)
    }
  }
}

// fs.writeSync may write fewer bytes than asked; loop until the whole buffer is on disk
function writeAll(fd, text) {
  const buf = Buffer.from(text)
  let off = 0
  while (off < buf.length) {
    const n = fs.writeSync(fd, buf, off, buf.length - off)
    if (n <= 0) throw new Error(`manifest write made no progress at byte ${off}/${buf.length}`)
    off += n
  }
  fs.fsyncSync(fd)
}

const isPlaceholder = (d) => d == null || d.endsWith('-01')
const TODAY = new Date().toISOString().slice(0, 10)
function implausible(from, to) {
  if (to < '1950-01-01' || to > TODAY) return true
  return from != null && Math.abs(+to.slice(0, 4) - +from.slice(0, 4)) > 3
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const stats = {
    scanned: 0, replaced: 0, wouldReplace: 0, unchanged: 0, fullDateDisagrees: 0,
    noBetterDate: 0, implausible: 0, notReturned: 0, noPmid: 0, changedMeanwhile: 0, writeErrors: 0,
  }
  const yearShift = {} // "2026-01-01 -> 2025" style tally of cross-year corrections
  const samples = []
  const implausibleList = []

  let lastId = null
  for (;;) {
    let q = supabase.from('articles').select('id, pubmed_id, publication_date').order('id').limit(PAGE)
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
      const dates = await efetch(batch.map((r) => r.pubmed_id))
      await sleep(EFETCH_DELAY_MS)

      const writes = []
      for (const r of batch) {
        const d = dates.get(r.pubmed_id)
        if (!d) { stats.notReturned++; continue }
        if (d.date === r.publication_date) { stats.unchanged++; continue }
        if (!isPlaceholder(r.publication_date)) { stats.fullDateDisagrees++; continue }
        if (d.precision !== 'day') { stats.noBetterDate++; continue }
        if (implausible(r.publication_date, d.date)) {
          stats.implausible++
          implausibleList.push(`${r.id} (PMID ${r.pubmed_id}): ${r.publication_date} -> ${d.date} (${d.source})`)
          continue
        }
        if (r.publication_date && r.publication_date.slice(0, 4) !== d.date.slice(0, 4)) {
          const k = `${r.publication_date.slice(0, 4)} -> ${d.date.slice(0, 4)}`
          yearShift[k] = (yearShift[k] || 0) + 1
        }
        if (samples.length < 5) samples.push(`${r.id}: ${r.publication_date} -> ${d.date} (${d.source})`)
        writes.push({ id: r.id, pmid: r.pubmed_id, from: r.publication_date, to: d.date, source: d.source })
      }
      if (DRY_RUN) { stats.wouldReplace += writes.length; continue }

      for (let j = 0; j < writes.length; j += WRITE_CONCURRENCY) {
        const group = writes.slice(j, j + WRITE_CONCURRENCY)
        // Rollback record first, durably, then the updates
        writeAll(manifestFd, group.map((w) => JSON.stringify(w)).join('\n') + '\n')
        await Promise.all(group.map(async (w) => {
          let u = supabase.from('articles').update({ publication_date: w.to }).eq('id', w.id)
          // Only if the row still holds the value we read
          u = w.from == null ? u.is('publication_date', null) : u.eq('publication_date', w.from)
          const { data, error } = await u.select('id')
          if (error) { stats.writeErrors++; console.error(`  write ${w.id}: ${error.message}`) }
          else if (!data.length) stats.changedMeanwhile++
          else stats.replaced++
        }))
        await sleep(WRITE_PAUSE_MS)
      }
    }
    console.log(`scanned ${stats.scanned} | ${DRY_RUN ? `would replace ${stats.wouldReplace}` : `replaced ${stats.replaced}`} | unchanged ${stats.unchanged} | full-date disagreements (kept) ${stats.fullDateDisagrees}`)
  }

  console.log('\n' + (DRY_RUN ? 'DRY RUN — nothing written' : `DONE — manifest: ${MANIFEST}`))
  console.log(stats)
  console.log('cross-year corrections:', yearShift)
  console.log('samples:\n  ' + samples.join('\n  '))
  console.log('implausible (NOT written):\n  ' + (implausibleList.join('\n  ') || 'none'))
  if (manifestFd !== null) fs.closeSync(manifestFd)
  if (stats.writeErrors) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
