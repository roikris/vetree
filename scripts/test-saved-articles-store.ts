/**
 * Deterministic ordering tests for lib/hooks/savedArticlesStore.ts (the shared bookmark store).
 * Each network response is held until the test releases it, so every race Codex identified in
 * review (2026-09-28) is reproduced in a fixed order.
 *
 *   npx tsx scripts/test-saved-articles-store.ts
 */
import assert from 'node:assert/strict'
import { syncUser, getSnapshot, toggleSaveFor } from '../lib/hooks/savedArticlesStore'

type Held = { url: string; body?: string; resolve: (r: Response) => void }
const held: Held[] = []
globalThis.fetch = ((url: string, init?: RequestInit) =>
  new Promise<Response>(resolve => held.push({ url: String(url), body: init?.body as string | undefined, resolve }))) as typeof fetch

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const tick = () => new Promise(r => setTimeout(r, 0))
const take = (match: string) => {
  const i = held.findIndex(h => h.url.includes(match))
  assert.ok(i >= 0, `expected a pending request to ${match}; pending: ${held.map(h => h.url).join(', ')}`)
  return held.splice(i, 1)[0]
}
const ids = () => [...getSnapshot().ids].sort()
let passed = 0
async function scenario(name: string, fn: () => Promise<void>) {
  held.length = 0
  await fn()
  passed++
  console.log(`✓ ${name}`)
}

async function main() {
  await scenario('save during the first lookup survives the stale lookup (round-2 race)', async () => {
    syncUser('u1')
    const get1 = take('/api/saved-articles')
    const save = toggleSaveFor('u1', 'X')
    assert.deepEqual(ids(), ['X'])                 // optimistic
    take('/api/save-article').resolve(json({ success: true }))
    await save
    const get2 = take('/api/saved-articles')        // save succeeded while loading → fresh lookup
    get1.resolve(json({ articleIds: [] }))          // stale, pre-save data
    await tick()
    assert.deepEqual(ids(), ['X'], 'stale lookup must not erase the save')
    get2.resolve(json({ articleIds: ['X'] }))
    await tick()
    assert.deepEqual(ids(), ['X'])
    assert.equal(getSnapshot().loading, false)
  })

  await scenario('a lookup started before a save is re-layered with the pending save', async () => {
    syncUser('u2')
    const get1 = take('/api/saved-articles')
    const save = toggleSaveFor('u2', 'Y')
    get1.resolve(json({ articleIds: ['A'] }))       // arrives while the save is still in flight
    await tick()
    assert.deepEqual(ids(), ['A', 'Y'])
    take('/api/save-article').resolve(json({ success: true }))
    await save
    assert.deepEqual(ids(), ['A', 'Y'])
  })

  await scenario('a failed save reverts only its own article', async () => {
    syncUser('u3')
    take('/api/saved-articles').resolve(json({ articleIds: [] }))
    await tick()
    const sx = toggleSaveFor('u3', 'X')
    const sy = toggleSaveFor('u3', 'Y')
    assert.deepEqual(ids(), ['X', 'Y'])
    const px = take('/api/save-article'), py = take('/api/save-article')
    py.resolve(json({ success: true }))
    await sy
    px.resolve(json({ error: 'boom' }, 500))
    const rx = await sx
    assert.ok(rx.error)
    assert.deepEqual(ids(), ['Y'], 'Y must survive X failing')
  })

  await scenario('a save completing after a user switch never touches the new user', async () => {
    syncUser('u4')
    take('/api/saved-articles').resolve(json({ articleIds: ['P'] }))
    await tick()
    const s = toggleSaveFor('u4', 'Q')
    syncUser('u5')
    take('/api/saved-articles').resolve(json({ articleIds: ['Z'] }))
    await tick()
    take('/api/save-article').resolve(json({ error: 'boom' }, 500))
    await s
    assert.equal(getSnapshot().userId, 'u5')
    assert.deepEqual(ids(), ['Z'], "u4's failed save must not write into u5's bookmarks")
  })

  await scenario('an older lookup cannot overwrite a newer one', async () => {
    syncUser('u6')
    const g1 = take('/api/saved-articles')
    syncUser(null)
    syncUser('u6')
    const g2 = take('/api/saved-articles')
    g2.resolve(json({ articleIds: ['NEW'] }))
    await tick()
    g1.resolve(json({ articleIds: ['OLD'] }))
    await tick()
    assert.deepEqual(ids(), ['NEW'])
  })

  await scenario('a failed lookup is retried on the next sync for the same user', async () => {

    syncUser('u8')

    take('/api/saved-articles').resolve(json({ error: 'down' }, 500))

    await tick()

    assert.equal(getSnapshot().failed, true)

    syncUser('u8')                                  // e.g. the next batch of rows mounting

    take('/api/saved-articles').resolve(json({ articleIds: ['K'] }))

    await tick()

    assert.deepEqual(ids(), ['K'])

    assert.equal(getSnapshot().failed, false)

  })


  await scenario('same user again does not refetch (one lookup shared by every row)', async () => {
    syncUser('u7')
    take('/api/saved-articles').resolve(json({ articleIds: [] }))
    await tick()
    syncUser('u7'); syncUser('u7'); syncUser('u7')   // e.g. 50 rows mounting
    assert.equal(held.length, 0)
  })

  console.log(`\n${passed} scenarios passed`)
}

main().catch(e => { console.error(e); process.exit(1) })
