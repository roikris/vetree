// analytics-003: search analytics leave out crawlers, suggestion-chip searches and (by default) the signed-out
// likely-automated estimate. Covers the chip decision (lib/search/chips.ts), the reader filter and the logging-gap
// rule (lib/analytics/searchFilters.ts), migration 092's frozen backfill, and the payload ProgressiveResults really
// posts after a chip / typed / repeated search (rendered in happy-dom; next/navigation and the list are fakes).
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import Module from 'node:module'
import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { SEARCH_CHIPS, chipHref, searchVia } from '../../lib/search/chips'
import { searchDemand, searchLoggingGap } from '../../lib/analytics/searchFilters'
import { LIKELY_HUMAN_OR } from '../../lib/analytics/readAll'

test('chipHref: every chip link carries via=chip and round-trips its text', () => {
  for (const chip of SEARCH_CHIPS) {
    const href = chipHref(chip)
    const p = new URLSearchParams(href.slice(href.indexOf('?')))
    assert.equal(p.get('search'), chip)
    assert.equal(p.get('via'), 'chip')
    assert.equal(searchVia(href.slice(1), chip), 'chip')
  }
})

test('searchVia: chip only when the URL says so, for that very query, and the query is a chip', () => {
  assert.equal(searchVia('?search=TPLO+outcomes&via=chip', 'TPLO outcomes'), 'chip')
  assert.equal(searchVia('?search=TPLO+outcomes&via=chip', ' TPLO outcomes '), 'chip')
  assert.equal(searchVia('?search=TPLO+outcomes', 'TPLO outcomes'), undefined)                 // typed
  assert.equal(searchVia('?search=TPLO+outcomes&via=chip', 'TPLO complications'), undefined)   // changed query
  assert.equal(searchVia('?search=cats&via=chip', 'cats'), undefined)                          // not a chip
  assert.equal(searchVia('?search=TPLO+outcomes&via=other', 'TPLO outcomes'), undefined)
  assert.equal(searchVia('', 'TPLO outcomes'), undefined)
})

test('searchDemand: user exclusion, no crawlers, no chips; likely-automated hidden unless included', () => {
  const calls: string[] = []
  const q = { or(f: string) { calls.push(`or:${f}`); return q }, is(c: string, v: null) { calls.push(`is:${c}:${v}`); return q } }
  searchDemand(q)
  assert.ok(calls.includes('is:bot_name:null'))
  assert.ok(calls.includes('is:via:null'))
  assert.ok(calls.includes(`or:${LIKELY_HUMAN_OR}`))
  assert.ok(calls.some(c => c.startsWith('or:user_id.')), 'admin/test exclusion applied')
  calls.length = 0
  searchDemand(q, true)
  assert.ok(calls.includes('is:via:null'), 'chips are never demand, in either mode')
  assert.ok(calls.includes('is:bot_name:null'))
  assert.ok(!calls.includes(`or:${LIKELY_HUMAN_OR}`))
})

test('searchLoggingGap: only zero RECORDED rows is a gap — a chip/bot-only week (demand 0) is not', () => {
  assert.equal(searchLoggingGap(0), true)
  assert.equal(searchLoggingGap(5), false)   // e.g. 5 chip-crawler rows, 0 typed demand: logging works
})

test('migration 092: frozen backfill list = the chips of 2026-11-25, fixed cutoff, signed out only', () => {
  const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/092_search_logs_traffic.sql'), 'utf8')
  const list = sql.match(/query IN \(([^)]*)\)/)?.[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''))
  assert.deepEqual(list, ['canine diabetes management', 'feline hypertension', 'TPLO outcomes', 'lymphoma chemotherapy'])
  assert.match(sql, /AND user_id IS NULL/)
  assert.match(sql, /created_at < timestamptz '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z'/)
  assert.doesNotMatch(sql, /now\(\)/i)
})

// ---- ProgressiveResults: the payload it posts ------------------------------------------------------------------
const win = new Window({ url: 'https://vetree.app/' })
const g = globalThis as Record<string, unknown>
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'Event', 'getComputedStyle']) {
  g[key] = key === 'window' ? win : (win as unknown as Record<string, unknown>)[key]
}
g.IS_REACT_ACT_ENVIRONMENT = true
if (typeof g.navigator === 'undefined') g.navigator = win.navigator
// happy-dom's navigator (used on Node 20, which has no global one) reports webdriver = true, and the logger
// deliberately skips automated browsers — this test plays a person
Object.defineProperty(g.navigator as object, 'webdriver', { value: false, configurable: true })
g.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} }

let posts: Record<string, unknown>[] = []
g.fetch = async (url: string, init: { body: string }) => {
  if (url === '/api/analytics/search') posts.push(JSON.parse(init.body))
  return { ok: true, status: 200, json: async () => ({}) }
}

const abs = (p: string) => path.join(process.cwd(), p)
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
function fakeModule(filename: string, exports: Record<string, unknown>) {
  const m = new Module(filename)
  m.filename = filename
  m.loaded = true
  m.exports = exports
  require.cache[filename] = m
}
let React: any, act: any, createRoot: any, ProgressiveResults: any, resetSearchLogDedup: any, parseSearchParams: any
before(() => {
  fakeModule(require.resolve('next/navigation'), { useRouter: () => ({ push() {}, replace() {}, refresh() {} }) })
  fakeModule(abs('components/articles/ArticleList.tsx'), { ArticleList: () => null })
  fakeModule(abs('components/search/SproutLoader.tsx'), { SproutLoader: () => null })
  React = require('react')
  act = React.act
  createRoot = require('react-dom/client').createRoot
  ;({ ProgressiveResults, resetSearchLogDedup } = require(abs('components/search/ProgressiveResults.tsx')))
  ;({ parseSearchParams } = require(abs('lib/utils/searchParams.ts')))
})

async function land(url: string) {
  win.happyDOM.setURL(`https://vetree.app${url}`)
  const p = new URLSearchParams(url.slice(url.indexOf('?')))
  const filters = parseSearchParams(Object.fromEntries(p.entries()))
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(React.createElement(ProgressiveResults, {
      filters, initialArticles: [{ id: 'a1' }], initialCursor: null, initialDone: true, disclosure: { kind: 'complete' },
    }))
  })
  await act(async () => { root.unmount() })
}

test('ProgressiveResults: chip arrival posts via chip; typed or changed searches post none; a repeat is not re-logged', async () => {
  posts = []; resetSearchLogDedup()
  await land(chipHref('TPLO outcomes'))
  assert.equal(posts.length, 1)
  assert.equal(posts[0].query, 'TPLO outcomes')
  assert.equal(posts[0].via, 'chip')

  // the same text again in this page session (e.g. Enter on the prefilled box): the existing dedup — not logged
  await land('/?search=TPLO%20outcomes')
  assert.equal(posts.length, 1)

  // a changed query: the app-built URL carries no via → a typed search
  await land('/?search=TPLO%20complications')
  assert.equal(posts.length, 2)
  assert.equal(posts[1].via, undefined)

  // a hand-made URL claiming via=chip for a non-chip query: not a chip
  await land('/?search=cats&via=chip')
  assert.equal(posts.length, 3)
  assert.equal(posts[2].via, undefined)

  // typed chip text without via (a person typing it) — logged as typed
  resetSearchLogDedup()
  await land('/?search=feline%20hypertension')
  assert.equal(posts[3].via, undefined)
})
