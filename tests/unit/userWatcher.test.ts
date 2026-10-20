// lib/auth/userWatcher.ts — the consent prompts' "re-check when a different user signs in or out" (analytics-001, #146).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createUserWatcher } from '../../lib/auth/userWatcher'

type U = { id: string }
const A: U = { id: 'a' }
const B: U = { id: 'b' }

// A controllable auth source: emit() plays an auth event, flush() runs the deferred deliveries
function harness(initial: Promise<U | null>) {
  let listener: ((event: string, user: U | null) => void) | null = null
  const queue: (() => void)[] = []
  const calls: { user: string | null; isCurrent: () => boolean }[] = []
  const stop = createUserWatcher<U>({
    initial,
    subscribe: l => { listener = l; return () => { listener = null } },
    onUser: (user, isCurrent) => calls.push({ user: user?.id ?? null, isCurrent }),
    defer: fn => queue.push(fn),
  })
  return {
    calls, stop,
    emit: (event: string, user: U | null) => listener?.(event, user),
    flush: () => { while (queue.length) queue.shift()!() },
    listening: () => listener !== null,
  }
}
const tick = () => new Promise(r => setImmediate(r))

test('delivers the initial user, then only changes of identity', async () => {
  const h = harness(Promise.resolve(A))
  await tick()
  assert.deepEqual(h.calls.map(c => c.user), ['a'])
  h.emit('TOKEN_REFRESHED', A); h.emit('SIGNED_IN', A); h.emit('USER_UPDATED', A); h.flush()
  assert.deepEqual(h.calls.map(c => c.user), ['a'], 'same user: no re-check (SIGNED_IN is re-emitted on tab focus)')
  h.emit('SIGNED_OUT', null); h.flush()
  h.emit('SIGNED_IN', B); h.flush()
  assert.deepEqual(h.calls.map(c => c.user), ['a', null, 'b'])
})

test('a recovery sign-in (PASSWORD_RECOVERY, no SIGNED_IN) counts as a change', async () => {
  const h = harness(Promise.resolve(null))
  await tick()
  h.emit('PASSWORD_RECOVERY', A); h.flush()
  assert.deepEqual(h.calls.map(c => c.user), [null, 'a'])
})

test('the previous user is invalidated the moment the event arrives, before its delivery runs', async () => {
  const h = harness(Promise.resolve(A))
  await tick()
  const forA = h.calls[0].isCurrent
  assert.equal(forA(), true)
  h.emit('SIGNED_OUT', null)
  assert.equal(forA(), false, 'a query for A finishing in this gap must not show A a prompt')
  h.flush()
  assert.deepEqual(h.calls.map(c => c.user), ['a', null])
})

test('a queued delivery superseded before it runs never runs (A → B → A)', async () => {
  const h = harness(Promise.resolve(A))
  await tick()
  h.emit('SIGNED_IN', B)
  h.emit('SIGNED_IN', A)
  h.flush()
  assert.deepEqual(h.calls.map(c => c.user), ['a', 'a'], 'B never delivered; A re-checked once')
  assert.equal(h.calls[0].isCurrent(), false)
  assert.equal(h.calls[1].isCurrent(), true)
})

test('an event that arrived before the initial answer wins (stale pre-sign-in getUser)', async () => {
  let resolve!: (u: U | null) => void
  const h = harness(new Promise(r => { resolve = r }))
  h.emit('SIGNED_IN', B); h.flush()
  resolve(null)
  await tick()
  assert.deepEqual(h.calls.map(c => c.user), ['b'])
})

test('stop: unsubscribes, invalidates, and drops queued deliveries', async () => {
  const h = harness(Promise.resolve(A))
  await tick()
  h.emit('SIGNED_IN', B)
  h.stop()
  h.flush()
  assert.equal(h.listening(), false)
  assert.equal(h.calls[0].isCurrent(), false)
  assert.deepEqual(h.calls.map(c => c.user), ['a'])
})
