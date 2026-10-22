import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSignInRefresher, sessionUserIdFromCookies, type RenderedUser } from '../../lib/auth/signInRefresh'

function setup(renderedAtLoad: RenderedUser) {
  let refreshes = 0
  const on = createSignInRefresher({ renderedAtLoad, refresh: () => { refreshes++ } })
  return { on, count: () => refreshes }
}

test('signed-in page start: the stored-session SIGNED_IN does not refresh', () => {
  const r = setup('A')
  r.on('SIGNED_IN', 'A')          // _recoverAndRefresh on load
  r.on('INITIAL_SESSION', 'A')
  assert.equal(r.count(), 0)
})

test('tab refocus SIGNED_IN for the same user does not refresh', () => {
  const r = setup('A')
  r.on('INITIAL_SESSION', 'A')
  r.on('SIGNED_IN', 'A')
  r.on('TOKEN_REFRESHED', 'A')
  r.on('SIGNED_IN', 'A')
  assert.equal(r.count(), 0)
})

test('signed-out page, code exchange with the listener registered early: one refresh', () => {
  const r = setup(null)
  r.on('SIGNED_IN', 'B')
  r.on('INITIAL_SESSION', 'B')
  r.on('SIGNED_IN', 'B')          // later refocus
  assert.equal(r.count(), 1)
})

test('signed-out page, exchange finished before the listener registered (INITIAL_SESSION first): one refresh', () => {
  const r = setup(null)
  r.on('INITIAL_SESSION', 'B')
  r.on('SIGNED_IN', 'B')
  assert.equal(r.count(), 1)
})

test('page rendered for A, startup exchange signs in B: one refresh (early and late listener)', () => {
  const early = setup('A')
  early.on('SIGNED_IN', 'B')
  early.on('INITIAL_SESSION', 'B')
  early.on('SIGNED_IN', 'B')
  assert.equal(early.count(), 1)
  const late = setup('A')
  late.on('INITIAL_SESSION', 'B')
  late.on('SIGNED_IN', 'B')
  assert.equal(late.count(), 1)
})

test('sign out then sign in again in the same page → refresh', () => {
  const r = setup('A')
  r.on('INITIAL_SESSION', 'A')
  r.on('SIGNED_OUT', null)
  r.on('SIGNED_IN', 'A')
  assert.equal(r.count(), 1)
})

test('a different user signs in (another tab) → refresh', () => {
  const r = setup('A')
  r.on('INITIAL_SESSION', 'A')
  r.on('SIGNED_IN', 'B')
  assert.equal(r.count(), 1)
})

test('a session cookie that turned out invalid: the sign-in after it refreshes', () => {
  const r = setup('A')
  r.on('INITIAL_SESSION', null)
  r.on('SIGNED_IN', 'A')
  assert.equal(r.count(), 1)
})

test('unreadable cookie at load: the first event naming a user refreshes once', () => {
  const r = setup(undefined)
  r.on('SIGNED_IN', 'A')
  r.on('INITIAL_SESSION', 'A')
  r.on('SIGNED_IN', 'A')
  assert.equal(r.count(), 1)
})

test('no refresh on SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY', () => {
  const r = setup(null)
  r.on('TOKEN_REFRESHED', 'A')
  r.on('USER_UPDATED', 'A')
  r.on('SIGNED_OUT', null)
  r.on('PASSWORD_RECOVERY', 'A')
  assert.equal(r.count(), 0)
  r.on('SIGNED_IN', 'A')           // the recovery sign-in already moved the page on
  assert.equal(r.count(), 0)
})

// Cookies as @supabase/ssr 0.8 writes them: "base64-" + base64url(JSON), split into .0, .1 … when long
const KEY = 'sb-gnykidzijppxvrvvchxq-auth-token'
const session = (id: string) => JSON.stringify({ access_token: 'x', refresh_token: 'y', user: { id, email_note: 'שלום ✓' } })
const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

test('sessionUserIdFromCookies: whole cookie, base64 format', () => {
  assert.equal(sessionUserIdFromCookies(`a=1; ${KEY}=base64-${b64url(session('u-1'))}; b=2`, KEY), 'u-1')
})

test('sessionUserIdFromCookies: chunked cookie joined in order', () => {
  const v = 'base64-' + b64url(session('u-2'))
  const cut = Math.floor(v.length / 2)
  const header = `${KEY}.1=${v.slice(cut)}; other=1; ${KEY}.0=${v.slice(0, cut)}`
  assert.equal(sessionUserIdFromCookies(header, KEY), 'u-2')
})

test('sessionUserIdFromCookies: raw JSON (URI-encoded) still read', () => {
  assert.equal(sessionUserIdFromCookies(`${KEY}=${encodeURIComponent(session('u-3'))}`, KEY), 'u-3')
})

test('sessionUserIdFromCookies: no session cookie = null; the code verifier or another project does not count', () => {
  assert.equal(sessionUserIdFromCookies('', KEY), null)
  assert.equal(sessionUserIdFromCookies(`${KEY}-code-verifier=abc; sb-otherref-auth-token=base64-${b64url(session('x'))}`, KEY), null)
})

test('sessionUserIdFromCookies: unreadable cookie = undefined', () => {
  assert.equal(sessionUserIdFromCookies(`${KEY}=base64-%%%not-json`, KEY), undefined)
  assert.equal(sessionUserIdFromCookies(`${KEY}=base64-${b64url('{"user":{}}')}`, KEY), undefined)
  const v = 'base64-' + b64url(session('u-4'))
  assert.equal(sessionUserIdFromCookies(`${KEY}.0=${v.slice(0, 10)}`, KEY), undefined)   // a chunk missing
})
