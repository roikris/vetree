// Shared PubMed publication-date extraction for every ingestion script and
// scripts/backfill-publication-dates.cjs.
//
// Ingestion used to read only the journal ISSUE date (JournalIssue/PubDate). For
// continuous-publication journals (Frontiers, …) and articles not yet assigned to an issue,
// PubMed gives only a year there, so the date was pinned to YYYY-01-01 — 8,590 of 20,798
// public articles on 2026-09-25 (41%), which also sank them in the publication_date-sorted
// homepage feed. PubMed carries the exact online date separately (ArticleDate
// DateType="Electronic", always Y/M/D), which is preferred here.
//
// Order: ArticleDate (Electronic) -> PubDate Year[/Month[/Day]] -> MedlineDate free text.
// Missing parts are filled with 01 as before, and `precision` says how much is real.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

function monthNumber(m) {
  if (!m) return null
  const t = m.trim().toLowerCase()
  if (/^\d{1,2}$/.test(t)) { const n = +t; return n >= 1 && n <= 12 ? n : null }
  return MONTHS[t.slice(0, 3)] ?? null
}

// YYYY-MM-DD, or null if the parts don't form a real calendar date
function iso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const tag = (xml, name) => xml.match(new RegExp(`<${name}\\b[^>]*>([^<]*)</${name}>`))?.[1]?.trim()

// Returns { date: 'YYYY-MM-DD' | null, precision: 'day' | 'month' | 'year' | null, source }
function dateFromArticleXml(chunk) {
  const electronic = chunk.match(/<ArticleDate\b[^>]*DateType="Electronic"[^>]*>([\s\S]*?)<\/ArticleDate>/)?.[1]
  if (electronic) {
    const y = +tag(electronic, 'Year'), m = monthNumber(tag(electronic, 'Month')), d = +tag(electronic, 'Day')
    const date = y && m && d ? iso(y, m, d) : null
    // Data-entry errors exist in PubMed; an implausible online date falls back to the issue date
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    if (date && date >= '1950-01-01' && date <= tomorrow) return { date, precision: 'day', source: 'article_date' }
  }

  const pub = chunk.match(/<JournalIssue\b[^>]*>[\s\S]*?<PubDate>([\s\S]*?)<\/PubDate>/)?.[1]
  if (pub) {
    const y = +tag(pub, 'Year')
    if (y) {
      const m = monthNumber(tag(pub, 'Month'))
      const d = +tag(pub, 'Day')
      if (m && d && iso(y, m, d)) return { date: iso(y, m, d), precision: 'day', source: 'pub_date' }
      if (m) return { date: iso(y, m, 1), precision: 'month', source: 'pub_date' }
      return { date: iso(y, 1, 1), precision: 'year', source: 'pub_date' }
    }
    // Free-text issue date, e.g. The Veterinary Record's "2026 May/Jun 30": no reliable day
    const medline = tag(pub, 'MedlineDate')
    const y2 = medline?.match(/(19|20)\d{2}/)?.[0]
    if (y2) {
      const m2 = monthNumber(medline.match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)?.[0])
      return { date: iso(+y2, m2 ?? 1, 1), precision: m2 ? 'month' : 'year', source: 'medline_date' }
    }
  }
  return { date: null, precision: null, source: null }
}

// Map of PMID -> { date, precision, source }
function extractPublicationDatesFromXml(xml) {
  const out = new Map()
  for (const chunk of xml.split(/<PubmedArticle\b[^>]*>/).slice(1)) {
    const pmid = chunk.match(/<MedlineCitation\b[^>]*>\s*<PMID\b[^>]*>(\d+)<\/PMID>/)?.[1]
    if (pmid) out.set(pmid, dateFromArticleXml(chunk))
  }
  return out
}

module.exports = { extractPublicationDatesFromXml }
