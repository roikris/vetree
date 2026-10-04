/* eslint-disable @typescript-eslint/no-explicit-any -- mocking browser globals */
// Storage behaviour of components/home/PersonalizeCard.tsx (Codex review of PR #103).
// Run: npx tsx scripts/test-personalize-card.mts   (exits 1 on failure)
const store = new Map<string, string>()
let refuseWrites = false
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { if (refuseWrites) throw new Error('QuotaExceededError'); store.set(k, v) },
}
;(globalThis as any).window = { dispatchEvent: () => true }
;(globalThis as any).Event = class { constructor(public type: string) {} }
const { _storageForTests: t } = await import('../components/home/PersonalizeCard')

let failures = 0
const expect = (c: boolean, m: string) => { if (!c) { failures++; console.log('FAIL', m) } }
const hidden = (key: string) => { const s = t.read(key); return s.snoozes >= t.MAX_SNOOZES || Date.now() < s.until }

const A = t.storageKey('user-a'), B = t.storageKey('user-b'), C = t.storageKey('user-c')
expect(!hidden(A) && !hidden(B), 'new accounts see the card')
t.write(A, { until: Date.now() + t.SNOOZE_MS, snoozes: 1 })
expect(hidden(A) && !hidden(B), 'first Not now hides it for that account only')
t.write(A, { until: 0, snoozes: 1 }); expect(!hidden(A), 'comes back after 14 days')
t.write(A, { until: Date.now() + t.SNOOZE_MS, snoozes: 2 })
t.write(A, { until: 0, snoozes: 2 }); expect(hidden(A), 'gone for good after the second Not now')
expect(!hidden(B), 'another account on the same browser still sees it')
refuseWrites = true
t.write(C, { until: Date.now() + t.SNOOZE_MS, snoozes: 1 })
expect(hidden(C), 'Not now still hides it when storage refuses the write')
refuseWrites = false
store.set(B, '{"until":"x","snoozes":-1}'); expect(!hidden(B), 'malformed stored value ignored')
store.set(B, 'not json'); expect(!hidden(B), 'corrupt JSON ignored')
console.log(failures ? `${failures} failure(s)` : 'all personalize-card storage checks pass')
if (failures) process.exit(1)
