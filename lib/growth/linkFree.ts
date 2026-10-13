// Facebook IL (social-001, social-002): Meta lets some business / creator Pages attach only two external links a month
// (posts AND comments), and the Facebook IL Page posts every day — so its posts carry no web link. They end with the
// CLOSING lines below, which the app appends itself (the model never writes them):
// - the short address vetree.app/il (app/il/route.ts → today's article), written so Facebook doesn't detect a link
//   (Roi's composer test, 2026-10-13: "vetree.app/il" shows the link counter) — readers type it; the Page's action
//   button points there too;
// - the Vetree WhatsApp Community: links to Meta's own apps don't count toward the limit (composer test: no counter).

// The one place to change the address form or the invite link
export const ARTICLE_LINE = '📲 המאמר המלא: vetree . app/il (הקלידו בדפדפן בלי הרווחים — או בכפתור בעמוד שלנו)'
export const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/LtqjP6AZXDa0YxncwGnml4'
export const WHATSAPP_LINE = `💬 כל מאמר חדש מגיע לקהילת הוואטסאפ שלנו: ${WHATSAPP_COMMUNITY_URL}`
export const CLOSING_LINES = [ARTICLE_LINE, WHATSAPP_LINE]

// A closing / call-to-action line the model may have copied or reworded (rewrites start from an existing post) is
// dropped whole; any other line keeps its text and loses only its links — a clinical sentence that ends with a link
// stays. Evidence is read from the line's TEXT with its links removed (the invite URL itself says "whatsapp"):
// - it names the address (…app/il), the Page button or WhatsApp, and starts with 📲 / 💬 / 👆 or has ≤ 8 words; or
// - it carried a link and almost nothing else is left (≤ 3 words: "Join:", "הצטרפו:").
// Never the 📄 title line.
const CHANNEL_WORDS = /whatsapp|וואטסאפ|בכפתור/i
const ADDRESS_MENTION = /app\s*\/\s*il/i
const CLOSING_MARK = /^\s*(?:📲|💬|👆)/
const ADDRESS = /vetree\s*(?:\.|\(\.\)|נקודה)\s*app\s*\/\s*il/gi

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

function isClosingLine(line: string): boolean {
  if (/^\s*📄/.test(line)) return false // the title line always stays (route checks it), only its links go
  const text = line.replace(LINKISH, m => (isLink(m) ? ' ' : m)).replace(ADDRESS, ' ')
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).length
  const named = CHANNEL_WORDS.test(text) || ADDRESS_MENTION.test(line)
  if (named && (CLOSING_MARK.test(line) || words <= 8)) return true
  return text !== line && words <= 3
}

/**
 * Make a generated post link-free whatever the model wrote — drop 🔗 / 💾 lines and any closing line (current, old or
 * reworded), strip every remaining link — then end with exactly the CLOSING lines (the only link: the WhatsApp Community).
 */
export function makeLinkFree(post: string): string {
  const body = post
    .split('\n')
    .filter(line => !/^\s*(🔗|💾)/.test(line) && !isClosingLine(line))
    .map(line => line.replace(LINKISH, m => (isLink(m) ? '' : m)).replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return `${body}\n\n${CLOSING_LINES.join('\n')}`
}
