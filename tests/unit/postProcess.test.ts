// lib/growth/postProcess.ts — what generate-post does with the model's reply, for a new post and a rewrite alike.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processModelPost, hookLineOf, isLinkFreePlatform } from '../../lib/growth/postProcess'
import { CLOSING_LINES, hasLink } from '../../lib/growth/linkFree'

const CLOSE = CLOSING_LINES.join('\n')

test('a large-animal refusal is an error, never post content', () => {
  assert.deepEqual(processModelPost('facebook_il', 'SKIP_LARGE_ANIMAL'), { ok: false, reason: 'large_animal' })
  assert.deepEqual(processModelPost('linkedin', 'text… SKIP_LARGE_ANIMAL'), { ok: false, reason: 'large_animal' })
})

test('facebook_il: generated post → link-free with the closing lines; hook line = the finding', () => {
  const reply = 'כלבים עם CKD חיו יותר\n\nפרטים.\n\n📄 Title\n🔗 https://vetree.app/article/a?utm_source=facebook'
  const r = processModelPost('facebook_il', reply)
  assert.ok(r.ok)
  assert.ok(r.post.endsWith(`\n\n${CLOSE}`))
  assert.equal(hasLink(r.post.slice(0, -CLOSE.length)), false)
  assert.equal(hookLineOf(r.post), 'כלבים עם CKD חיו יותר')
})

test('facebook_il: a rewrite that keeps the old ending and a link → one ending, hook line unchanged', () => {
  const rewrite = 'ממצא חדש\n\n📄 Title\n👆 הקישור למאמר המלא — בכפתור בראש העמוד\nwww.vetree.app/article/a'
  const r = processModelPost('facebook_il', rewrite)
  assert.ok(r.ok)
  assert.equal(r.post, `ממצא חדש\n\n📄 Title\n\n${CLOSE}`)
  assert.equal(hookLineOf(r.post), 'ממצא חדש')
})

test('every other platform keeps its links untouched', () => {
  for (const p of ['linkedin', 'facebook_intl', 'whatsapp', 'telegram', 'twitter']) {
    assert.equal(isLinkFreePlatform(p), false)
    const reply = `Hook\n\n📄 Title\n🔗 https://vetree.app/article/a?utm_source=${p}`
    assert.deepEqual(processModelPost(p, reply), { ok: true, post: reply })
  }
})
