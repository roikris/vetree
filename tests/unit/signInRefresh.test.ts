import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSignInRefresher, hasSessionCookie } from '../../lib/auth/signInRefresh'

function setup(hadSessionAtLoad: boolean) {
  let refreshes = 0
  const on = createSignInRefresher({ hadSessionAtLoad, refresh: () => { refreshes++ } })
  return { on, count: () => refreshes }
}

test('signed-in page start: the stored-session SIGNED_IN does not refresh', () => {
  const r = setup(true)
  r.on('SIGNED_IN', 'u1')          // _recoverAndRefresh on load
  r.on('INITIAL_SESSION', 'u1')
  assert.equal(r.count(), 0)
})

test('tab refocus SIGNED_IN for the same user does not refresh', () => {
  const r = setup(true)
  r.on('INITIAL_SESSION', 'u1')
  r.on('SIGNED_IN', 'u1')
  r.on('TOKEN_REFRESHED', 'u1')
  r.on('SIGNED_IN', 'u1')
  assert.equal(r.count(), 0)
})

test('signed-out page, sign-in finishes in the page (code exchange): one refresh', () => {
  const r = setup(false)
  r.on('SIGNED_IN', 'u1')
  r.on('INITIAL_SESSION', 'u1')
  r.on('SIGNED_IN', 'u1')          // later refocus
  assert.equal(r.count(), 1)
})

test('signed-out page: INITIAL_SESSION null, then a sign-in → one refresh', () => {
  const r = setup(false)
  r.on('INITIAL_SESSION', null)
  r.on('SIGNED_IN', 'u1')
  assert.equal(r.count(), 1)
})

test('sign out then sign in again in the same page → refresh', () => {
  const r = setup(true)
  r.on('INITIAL_SESSION', 'u1')
  r.on('SIGNED_OUT', null)
  r.on('SIGNED_IN', 'u1')
  assert.equal(r.count(), 1)
})

test('a different user signs in (another tab) → refresh', () => {
  const r = setup(true)
  r.on('INITIAL_SESSION', 'u1')
  r.on('SIGNED_IN', 'u2')
  assert.equal(r.count(), 1)
})

test('a session cookie that turned out invalid: the sign-in after it refreshes', () => {
  const r = setup(true)
  r.on('INITIAL_SESSION', null)    // cookie present but no valid session
  r.on('SIGNED_IN', 'u1')
  assert.equal(r.count(), 1)
})

test('only SIGNED_IN refreshes', () => {
  const r = setup(false)
  for (const e of ['INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY', 'SIGNED_OUT']) r.on(e, 'u1')
  assert.equal(r.count(), 0)
})

test('hasSessionCookie: the session cookie or its first chunk, never the code verifier', () => {
  assert.equal(hasSessionCookie('sb-gnykidzijppxvrvvchxq-auth-token=base64-abc'), true)
  assert.equal(hasSessionCookie('a=1; sb-gnykidzijppxvrvvchxq-auth-token.0=base64-abc; sb-gnykidzijppxvrvvchxq-auth-token.1=x'), true)
  assert.equal(hasSessionCookie('sb-gnykidzijppxvrvvchxq-auth-token-code-verifier=xyz'), false)
  assert.equal(hasSessionCookie('vetree_consent=1; xsb-gnykidzijppxvrvvchxq-auth-token=1'), false)
  assert.equal(hasSessionCookie(''), false)
})
