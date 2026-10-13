// lib/growth/linkFree.ts — Facebook IL posts carry no web link (social-001 / 002). Run: npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeLinkFree, hasLink, CLOSING_LINES, WHATSAPP_COMMUNITY_URL, ARTICLE_LINE, WHATSAPP_LINE } from '../../lib/growth/linkFree'

const CLOSE = CLOSING_LINES.join('\n')
const bodyOf = (out: string) => out.slice(0, out.length - CLOSE.length)
const OLD = '👆 הקישור למאמר המלא — בכפתור בראש העמוד'

const withLinks: Record<string, string> = {
  'obeyed (no link)': `ממצא חשוב\n\n📄 Renal effects of NSAIDs in cats`,
  '🔗 + 💾 lines': `כותרת\n\n📄 Title\n🔗 https://vetree.app/article/pubmed-1?utm_source=facebook\n💾 שמרו: https://vetree.app/article/pubmed-1?intent=save`,
  'bare PubMed address': `ראו pubmed.ncbi.nlm.nih.gov/12345678 למקור\n\n📄 Title`,
  'bit.ly': `קיצור: bit.ly/study\n\n📄 Title`,
  'university address': `מחקר של vetmed.ucdavis.edu/research\n\n📄 Title`,
  'https + www mid-line': `קראו ב https://doi.org/10.1000/xyz או www.example.org\n\n📄 Title`,
  'co.il domain': `באתר vet.co.il/page\n\n📄 Title`,
}
for (const [name, input] of Object.entries(withLinks)) {
  test(`${name}: no link left, one ending, only the Community link`, () => {
    const out = makeLinkFree(input)
    assert.equal(hasLink(bodyOf(out)), false, out)
    assert.ok(out.endsWith(`\n\n${CLOSE}`) && out.split(CLOSE).length === 2, out)
    assert.equal(out.split(WHATSAPP_COMMUNITY_URL).length, 2, out)
  })
}

test('the address line is not a link to us either', () => assert.equal(hasLink(ARTICLE_LINE), false))

test('clinical text and title kept verbatim; idempotent', () => {
  const keep = 'Dose 2.5 mg/kg q12h, e.g. in CKD stage 3 — p < 0.05, n = 120. ממצא חשוב בחתולים.\n\n📄 Ovariectomy induces regression of hyperplastic uterus in female dogs'
  const out = makeLinkFree(keep)
  assert.equal(out, `${keep}\n\n${CLOSE}`)
  assert.equal(makeLinkFree(out), out)
})

test('organism names are names, not links', () => {
  const bugs = 'Treatment of E.coli infections in dogs; S.aureus ו-P.multocida בחתולים\n\n📄 E.coli and S.pseudintermedius in canine pyoderma'
  assert.equal(makeLinkFree(bugs), `${bugs}\n\n${CLOSE}`)
  assert.equal(hasLink(bugs), false)
  assert.ok(makeLinkFree('E.coli in cats\n\n📄 Title').startsWith('E.coli in cats\n'))
})

for (const d of ['X.com', 'T.co/abc', 'A.io', 'x.com', 'E.coli/path']) {
  test(`${d} is still a link`, () => {
    assert.equal(hasLink(`see ${d} now`), true)
    assert.equal(hasLink(bodyOf(makeLinkFree(`see ${d} now`))), false)
  })
}

const endings: Record<string, string> = {
  'old 👆 line': `גוף\n\n📄 Title\n${OLD}`,
  'closing lines copied': `גוף\n\n📄 Title\n\n${CLOSE}`,
  'model wrote its own WhatsApp line': `גוף\n\n📄 Title\nהצטרפו: ${WHATSAPP_COMMUNITY_URL}`,
  'address line + a period': `גוף\n\n📄 Title\n\n${ARTICLE_LINE}.\n${WHATSAPP_LINE}`,
  'WhatsApp line without https://': `גוף\n\n📄 Title\n${WHATSAPP_LINE.replace('https://', '')}`,
  'reworded address line': `גוף\n\n📄 Title\nלמאמר: vetree(.)app/il`,
  'reworded Page-button line': `גוף\n\n📄 Title\nהקישור בכפתור למעלה`,
  'bare invite URL line': `גוף\n\n📄 Title\n${WHATSAPP_COMMUNITY_URL}`,
}
for (const [name, input] of Object.entries(endings)) {
  test(`rewrite with ${name}: exactly one clean ending`, () => {
    assert.equal(makeLinkFree(input), `גוף\n\n📄 Title\n\n${CLOSE}`)
  })
}

test('clinical text before a link keeps its text and stays the hook line', () => {
  const clin = 'Mortality fell from 30% to 12% in 120 dogs given early enteral nutrition'
  const out = makeLinkFree(`${clin} ${WHATSAPP_COMMUNITY_URL}\n\n📄 Title`)
  assert.equal(out, `${clin}\n\n📄 Title\n\n${CLOSE}`)
  const short = 'טיפול מוקדם הפחית תמותה בכלבים'
  assert.equal(makeLinkFree(`${short} ${WHATSAPP_COMMUNITY_URL}\n📄 Study title`), `${short}\n📄 Study title\n\n${CLOSE}`)
})

test('a short title line with a link keeps the title', () => {
  assert.equal(makeLinkFree('גוף\n\n📄 Feline CKD https://vetree.app/article/x'), `גוף\n\n📄 Feline CKD\n\n${CLOSE}`)
})

test('a 💬 clinical line that names no channel stays', () => {
  const disc = '💬 Discussion: the effect held across breeds and ages'
  assert.ok(makeLinkFree(`${disc}\n\n📄 Title`).startsWith(disc))
})
