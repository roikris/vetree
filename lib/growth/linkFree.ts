// Facebook IL (social-001): Meta lets some business / creator Pages attach only two external links a month, and the
// Facebook IL Page posts every day — so its posts must carry no link at all. Readers use the Page's action button,
// which points at vetree.app/il (app/il/route.ts).

export const PAGE_BUTTON_LINE = '👆 הקישור למאמר המלא — בכפתור בראש העמוד'

// A URL, a www. address, or any bare domain with a real top-level domain (2–24 letters), with or without a path:
// https://…, www.…, vetree.app/…, pubmed.ncbi.nlm.nih.gov/…, bit.ly/…, vetmed.ucdavis.edu/…
const LINKISH = /\b(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}\b(?:\/\S*)?/gi

/** True when the text still contains anything Facebook could treat as a link. */
export function hasLink(text: string): boolean {
  LINKISH.lastIndex = 0
  const found = LINKISH.test(text)
  LINKISH.lastIndex = 0
  return found
}

/**
 * Make a generated post link-free whatever the model wrote: drop 🔗 / 💾 lines, strip any remaining link, and end
 * with exactly one page-button line.
 */
export function makeLinkFree(post: string): string {
  const body = post
    .split('\n')
    .filter(line => !/^\s*(🔗|💾)/.test(line) && line.trim() !== PAGE_BUTTON_LINE)
    .map(line => line.replace(LINKISH, '').replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return `${body}\n${PAGE_BUTTON_LINE}`
}
