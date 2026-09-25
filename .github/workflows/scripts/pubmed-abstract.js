// Shared PubMed abstract extraction for every ingestion script (daily-sync, both
// backfills, fetch-truncated-journal) and scripts/backfill-abstracts.cjs.
//
// Reads the efetch XML text directly instead of going through xml2js. xml2js keeps only an
// element's DIRECT text in `_`, so text inside inline markup was silently dropped:
// "<i>Thymus vulgaris</i>" vanished, "<i>p</i> < 0.05" became "< 0.05", "<i>n</i> = 9"
// became "= 9" (8 of 17 abstracts sampled on 2026-09-25 had lost words). Here every
// character of text inside <AbstractText> is kept, in order.

const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m
    }
    return NAMED[e.toLowerCase()] ?? m
  })
}

// Inner XML of one AbstractText -> plain text. Order matters:
//  1. MathML: use its alttext (the human-readable form) when present, else fall through
//     to plain text of its token elements.
//  2. <sup>x</sup> -> ^x (so "10<sup>6</sup>" reads 10^6, not 106); any attribute/spacing.
//  3. Self-closing tags (<br/>) become a space so words either side don't merge.
//  4. Every other tag is dropped and its text kept (i, b, u, sub, em, strong, ...).
function innerToText(inner) {
  return decodeEntities(
    inner
      .replace(/<(?:mml:)?math\b[^>]*\balttext="([^"]*)"[^>]*>[\s\S]*?<\/(?:mml:)?math\s*>/g, ' $1 ')
      .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup\s*>/g, '^$1')
      .replace(/<[^>]*\/>/g, ' ')
      .replace(/<[^>]+>/g, '')
  ).replace(/\s+/g, ' ').trim()
}

// Map of PMID -> abstract ('' when the record has none). Structured abstracts keep their
// section labels ("METHODS: ..."), one section per paragraph.
function extractAbstractsFromXml(xml) {
  const out = new Map()
  for (const chunk of xml.split(/<PubmedArticle\b[^>]*>/).slice(1)) {
    const pmid = chunk.match(/<MedlineCitation\b[^>]*>\s*<PMID\b[^>]*>(\d+)<\/PMID>/)?.[1]
    if (!pmid) continue
    const abstractXml = chunk.match(/<Abstract>([\s\S]*?)<\/Abstract>/)?.[1] ?? ''
    const sections = [...abstractXml.matchAll(/<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText\s*>/g)]
      .map(([, attrs, inner]) => {
        const text = innerToText(inner)
        const label = attrs.match(/\bLabel="([^"]*)"/)?.[1]
        return text ? (label ? `${decodeEntities(label)}: ${text}` : text) : ''
      })
      .filter(Boolean)
    out.set(pmid, sections.join('\n\n'))
  }
  return out
}

module.exports = { extractAbstractsFromXml }
