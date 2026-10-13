// Facebook IL (social-001): Meta lets some business / creator Pages attach only two external links a month, and the
// Facebook IL Page posts every day — so its posts must carry no link at all. Readers use the Page's action button,
// which points at vetree.app/il (app/il/route.ts).

export const PAGE_BUTTON_LINE = '👆 הקישור למאמר המלא — בכפתור בראש העמוד'

// A URL, a www. address, or any bare domain with a real top-level domain (2–24 letters), with or without a path:
// https://…, www.…, vetree.app/…, pubmed.ncbi.nlm.nih.gov/…, bit.ly/…, vetmed.ucdavis.edu/…
const LINKISH = /\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}\b(?:\/\S*)?/gi

// …except an abbreviated organism name written without a space (E.coli, S.aureus, P.multocida): a capital initial, a
// dot and a lowercase word, nothing after it. A short or common ending (X.com, T.co, A.io) still counts as a link.
const ORGANISM = /^[A-Z]\.[a-z]{3,}$/
const COMMON_TLD = new Set(['com', 'net', 'org', 'app', 'edu', 'gov', 'info', 'link', 'site', 'online', 'page'])
const isLink = (match: string) =>
  !(ORGANISM.test(match) && !COMMON_TLD.has(match.slice(2)))

/** True when the text still contains anything Facebook could treat as a link. */
export function hasLink(text: string): boolean {
  return Array.from(text.matchAll(LINKISH), m => m[0]).some(isLink)
}

/**
 * Make a generated post link-free whatever the model wrote: drop 🔗 / 💾 lines, strip any remaining link, and end
 * with exactly one page-button line.
 */
export function makeLinkFree(post: string): string {
  const body = post
    .split('\n')
    .filter(line => !/^\s*(🔗|💾)/.test(line) && line.trim() !== PAGE_BUTTON_LINE)
    .map(line => line.replace(LINKISH, m => (isLink(m) ? '' : m)).replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return `${body}\n${PAGE_BUTTON_LINE}`
}
