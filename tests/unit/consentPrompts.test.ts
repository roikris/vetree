// components/ConsentGate.tsx + components/DigestConsentPrompt.tsx — re-check on every change of signed-in user, and
// a request that resolves after a different user signed in leaves the new user's prompt alone (analytics-001, #146).
// Renders the real components in happy-dom; Supabase, fetch and the auth events are fakes, and the auth events go
// through the real createUserWatcher (lib/auth/userWatcher.ts).
import { test, before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import Module from 'node:module'
import { Window } from 'happy-dom'

// ---- DOM ------------------------------------------------------------------------------------------------------
const win = new Window({ url: 'https://vetree.app/' })
const g = globalThis as Record<string, unknown>
for (const key of ['window', 'document', 'localStorage', 'HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MouseEvent', 'getComputedStyle']) {
  g[key] = key === 'window' ? win : (win as unknown as Record<string, unknown>)[key]
}
g.IS_REACT_ACT_ENVIRONMENT = true
// Node 20 (CI) has no global navigator; React DOM reads it
if (typeof g.navigator === 'undefined') g.navigator = win.navigator

// ---- Fakes ----------------------------------------------------------------------------------------------------
type U = { id: string; email: string }
const A: U = { id: 'user-a', email: 'a@example.test' }
const B: U = { id: 'user-b', email: 'b@example.test' }

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

// user_consents rows per user id; a test may hold a user's query open with `hold`
let consentRows: Record<string, { marketing_opted_in: boolean; consent_source: string | null }[]> = {}
let hold: Record<string, Promise<void>> = {}
let queries = 0                          // user_consents reads, to catch a duplicate re-check
let sessionUser: U | null = null         // what auth.getUser() reports (ConsentGate's 403 fallback)
function fakeSupabase() {
  return {
    from: () => {
      queries++
      let userId = ''
      const result = async () => {
        await hold[userId]
        return { data: consentRows[userId] ?? [], error: null }
      }
      const chain = {
        select: () => chain,
        eq: (col: string, v: string) => { if (col === 'user_id') userId = v; return chain },
        or: () => chain,
        limit: () => chain,
        // ConsentGate asks for an accepted-terms row: one exists when the user has any row with a showing source
        maybeSingle: async () => {
          const { data } = await result()
          return { data: data.find(r => r.consent_source === null || r.consent_source === 'signup') ? { id: 1 } : null, error: null }
        },
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad),
      }
      return chain
    },
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }
}

// The auth source the components' watchSignedInUser listens to
let emit: (event: string, user: U | null) => void = () => {}
let initialUser: Promise<U | null> = Promise.resolve(null)

// fetch('/api/auth/save-consent') calls, each answered when the test says: answer(ok), respond(status, json) with
// a body that may itself be pending, or fail() (network error)
type Save = { body: Record<string, unknown>; answer: (ok: boolean) => void; respond: (status: number, json: Promise<unknown>) => void; fail: () => void }
let saves: Save[] = []
g.fetch = (_url: string, init: { body: string }) => new Promise((resolve, reject) => {
  const respond = (status: number, json: Promise<unknown>) => resolve({ ok: status < 300, status, json: () => json })
  saves.push({ body: JSON.parse(init.body), respond, answer: ok => respond(ok ? 200 : 500, Promise.resolve({})), fail: () => reject(new TypeError('Failed to fetch')) })
})

const abs = (p: string) => path.join(process.cwd(), p)
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// The tests run as CommonJS (tsx), so the fakes go straight into require.cache before the components are required —
// works on CI's Node 20, which has no mock.module (Node ≥ 22.3)
function fakeModule(filename: string, exports: Record<string, unknown>) {
  const m = new Module(filename)
  m.filename = filename
  m.loaded = true
  m.exports = exports
  require.cache[filename] = m
}
let React: any, act: any, createRoot: any, ConsentGate: any, DigestConsentPrompt: any
let PENDING_SIGNUP_CONSENT_KEY: string, CURRENT_CONSENT_VERSION: string, COPY: any
before(() => {
  const { createUserWatcher } = require(abs('lib/auth/userWatcher.ts'))
  fakeModule(abs('lib/supabase/client.ts'), { createClient: fakeSupabase })
  fakeModule(abs('lib/hooks/useAuth.ts'), {
    watchSignedInUser: (onUser: (u: U | null, isCurrent: () => boolean) => void) => createUserWatcher({
      initial: initialUser,
      subscribe: (listener: (event: string, user: U | null) => void) => { emit = listener; return () => { emit = () => {} } },
      onUser,
    }),
  })
  fakeModule(require.resolve('next/navigation'), { usePathname: () => '/' })
  React = require('react')
  act = React.act
  createRoot = require('react-dom/client').createRoot
  ConsentGate = require(abs('components/ConsentGate.tsx')).ConsentGate
  DigestConsentPrompt = require(abs('components/DigestConsentPrompt.tsx')).DigestConsentPrompt
  ;({ PENDING_SIGNUP_CONSENT_KEY, CURRENT_CONSENT_VERSION } = require(abs('lib/constants/consent.ts')))
  COPY = require(abs('lib/consent/copy.ts')).CONSENT_COPY.en
})

// ---- Helpers --------------------------------------------------------------------------------------------------
let container: HTMLElement
let unmount: () => void
beforeEach(() => {
  consentRows = {}; hold = {}; saves = []; queries = 0; sessionUser = null; initialUser = Promise.resolve(null)
  win.localStorage.clear()
  container = win.document.createElement('div') as unknown as HTMLElement
  win.document.body.appendChild(container as never)
})
afterEach(async () => { await act(async () => unmount()); container.remove() })

async function render(component: unknown) {
  const r = createRoot(container)
  await act(async () => { r.render(React.createElement(component as never)) })
  unmount = () => r.unmount()
  await settle()
}
// Let queued deliveries (setTimeout 0), queries and React updates finish
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0)) })
const signIn = async (event: string, user: U | null) => { await act(async () => emit(event, user)); await settle() }
const gateOpen = () => container.textContent!.includes('🌿')
const digestOpen = () => !!container.querySelector('[data-testid="digest-consent-prompt"]')
const click = async (el: Element | null) => {
  assert.ok(el, 'element to click')
  await act(async () => { (el as unknown as { click(): void }).click() })
  await settle()
}
// Buttons by their visible (English) wording
const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text) ?? null
const submitGate = async () => {
  await click(container.querySelector('input[type="checkbox"]'))
  await click(button(COPY.gateSubmit))
}

// ---- ConsentGate ----------------------------------------------------------------------------------------------
test('gate: opens for a user without accepted terms, closes when they sign out', async () => {
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  assert.equal(gateOpen(), true)
  await signIn('SIGNED_OUT', null)
  assert.equal(gateOpen(), false)
})

test('gate: a reset-link sign-in (PASSWORD_RECOVERY) is checked too', async () => {
  await render(ConsentGate)
  assert.equal(gateOpen(), false)
  await signIn('PASSWORD_RECOVERY', A)
  assert.equal(gateOpen(), true)
})

test('gate: a user who already accepted is not asked after switching to them', async () => {
  initialUser = Promise.resolve(A)
  consentRows[B.id] = [{ marketing_opted_in: false, consent_source: 'signup' }]
  await render(ConsentGate)
  assert.equal(gateOpen(), true)
  await signIn('SIGNED_IN', B)
  assert.equal(gateOpen(), false)
})

test("gate: the previous user's slow query cannot open the gate after they signed out", async () => {
  const slow = deferred<void>()
  hold[A.id] = slow.promise
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await signIn('SIGNED_OUT', null)
  slow.resolve(); await settle()
  assert.equal(gateOpen(), false)
})

test("gate: A's submit resolving after B signed in leaves B's gate open (success and failure)", async () => {
  for (const ok of [true, false]) {
    initialUser = Promise.resolve(A)
    saves = []
    await render(ConsentGate)
    await submitGate()
    assert.equal(saves.length, 1)
    assert.equal(saves[0].body.userId, A.id)
    await signIn('SIGNED_IN', B)
    assert.equal(gateOpen(), true, 'B is asked')
    await act(async () => saves[0].answer(ok)); await settle()
    assert.equal(gateOpen(), true, `B's gate survives A's ${ok ? 'success' : 'failure'}`)
    assert.equal(container.querySelector('p.text-red-600'), null, "A's error is not shown to B")
    await act(async () => unmount())
  }
  unmount = () => {}
})

const errorShown = () => container.querySelector('p.text-red-600') !== null

test("gate: A's failed submit whose error body arrives after B signed in shows B nothing", async () => {
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await submitGate()
  const body = deferred<unknown>()
  await act(async () => saves[0].respond(500, body.promise)); await settle()   // A still current: now reading the body
  await signIn('SIGNED_IN', B)
  await act(async () => body.resolve({ error: 'boom' })); await settle()
  assert.equal(gateOpen(), true)
  assert.equal(errorShown(), false)
})

test("gate: A's submit failing at the network after B signed in shows B nothing", async () => {
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await submitGate()
  await signIn('SIGNED_IN', B)
  await act(async () => saves[0].fail()); await settle()
  assert.equal(gateOpen(), true)
  assert.equal(errorShown(), false)
})

const pendingFor = (email: string) => JSON.stringify({ terms: true, marketing: true, version: CURRENT_CONSENT_VERSION, email, at: Date.now() })

test("gate: A's stored signup choice saved after B signed in leaves B's gate and this browser's choices alone", async () => {
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, pendingFor(A.email))
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  assert.equal(saves.length, 1)
  await signIn('SIGNED_IN', B)
  assert.equal(gateOpen(), true, 'B is asked')
  win.localStorage.setItem('vetree_pending_digest_consent', '{"left":"by B"}')
  await act(async () => saves[0].answer(true)); await settle()
  assert.equal(gateOpen(), true)
  assert.equal(win.localStorage.getItem('vetree_pending_digest_consent'), '{"left":"by B"}', 'not cleared for A')
})

test("gate: a refused (403) stored-choice save after sign-out doesn't reopen the gate, even if getUser lags", async () => {
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, pendingFor(A.email))
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await signIn('SIGNED_OUT', null)
  sessionUser = A                       // the auth check still reports the old session
  await act(async () => saves[0].respond(403, Promise.resolve({}))); await settle()
  assert.equal(gateOpen(), false)
})

test("gate: a failed stored-choice save after sign-out doesn't open the gate for the signed-out user", async () => {
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, pendingFor(A.email))
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await signIn('SIGNED_OUT', null)
  await act(async () => saves[0].answer(false)); await settle()
  assert.equal(gateOpen(), false)
})

test('gate: the stored signup choice is removed only if it is still the one that was sent', async () => {
  const stored = (email: string) => JSON.stringify({ terms: true, marketing: true, version: CURRENT_CONSENT_VERSION, email, at: Date.now() })
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, stored(A.email))
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  assert.equal(saves.length, 1, 'the pending choice is recorded for A')
  const replacement = stored('someone-else@example.test')
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, replacement)   // another signup in this browser meanwhile
  await act(async () => saves[0].answer(true)); await settle()
  assert.equal(win.localStorage.getItem(PENDING_SIGNUP_CONSENT_KEY), replacement)
})

test('gate: the stored signup choice is removed after it was recorded, unchanged', async () => {
  win.localStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, JSON.stringify({ terms: true, marketing: false, version: CURRENT_CONSENT_VERSION, email: A.email, at: Date.now() }))
  initialUser = Promise.resolve(A)
  await render(ConsentGate)
  await act(async () => saves[0].answer(true)); await settle()
  assert.equal(win.localStorage.getItem(PENDING_SIGNUP_CONSENT_KEY), null)
  assert.equal(gateOpen(), false)
})

// ---- DigestConsentPrompt --------------------------------------------------------------------------------------
const neverAsked = [{ marketing_opted_in: false, consent_source: null }]

test('digest: asks an eligible user after switching to them; not on a token refresh', async () => {
  consentRows[B.id] = neverAsked
  await render(DigestConsentPrompt)
  assert.equal(digestOpen(), false)
  await signIn('SIGNED_IN', B)
  assert.equal(digestOpen(), true)
  const shows = JSON.parse(win.localStorage.getItem('vetree_digest_prompt_state')!).count
  const reads = queries
  await signIn('SIGNED_IN', B)          // re-emitted on tab focus
  await signIn('USER_UPDATED', B)
  await signIn('TOKEN_REFRESHED', B)
  assert.equal(queries, reads, 'same user: no re-check')
  assert.equal(digestOpen(), true, 'and the open prompt stays')
  assert.equal(JSON.parse(win.localStorage.getItem('vetree_digest_prompt_state')!).count, shows, 'no extra show counted')
})

test("digest: the previous user's slow query cannot show or count a prompt after they signed out", async () => {
  const slow = deferred<void>()
  consentRows[A.id] = neverAsked
  hold[A.id] = slow.promise
  initialUser = Promise.resolve(A)
  await render(DigestConsentPrompt)
  await signIn('SIGNED_OUT', null)
  slow.resolve(); await settle()
  assert.equal(digestOpen(), false)
  assert.equal(win.localStorage.getItem('vetree_digest_prompt_state'), null)
})

test("digest: A's answer resolving after B signed in leaves B's prompt open", async () => {
  consentRows[A.id] = neverAsked
  consentRows[B.id] = neverAsked
  initialUser = Promise.resolve(A)
  await render(DigestConsentPrompt)
  assert.equal(digestOpen(), true)
  await click(button(COPY.digestYes))
  assert.equal(saves.length, 1)
  assert.equal(saves[0].body.userId, A.id)
  // The show cap is per browser, not per user (A's show would hold B off for 30 days): start B's count afresh
  win.localStorage.removeItem('vetree_digest_prompt_state')
  await signIn('SIGNED_IN', B)
  assert.equal(digestOpen(), true, 'B is asked')
  await act(async () => saves[0].answer(true)); await settle()
  assert.equal(digestOpen(), true, "B's prompt survives A's answer")
})
