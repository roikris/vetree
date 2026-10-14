// proxy.ts — the proxy runs only for requests carrying a Supabase session cookie (perf-001).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '../../proxy'

// This project's session cookie, named the way @supabase/ssr names it (default storage key), independent of the config
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = url
  ? new URL(url).hostname.split('.')[0]
  : readFileSync('CLAUDE.md', 'utf8').match(/- Supabase: `([a-z0-9]+)`/)?.[1]
const keys = [`sb-${ref}-auth-token`, `sb-${ref}-auth-token.0`]
const runs = (url: string, cookies?: Record<string, string>) =>
  unstable_doesMiddlewareMatch({ config, url, cookies })

test('the project ref is known', () => assert.match(ref ?? '', /^[a-z0-9]{20}$/))

test('no session cookie: the proxy does not run (readers, crawlers)', () => {
  for (const path of ['/', '/article/pubmed-1', '/login', '/verify-email', '/auth/callback?code=x', '/library'])
    assert.equal(runs(path), false, path)
  // the PKCE verifier alone is not a session: /auth/callback sets the session itself
  assert.equal(runs('/auth/callback?code=x', { [`${keys[0]}-code-verifier`]: 'v' }), false)
  // another site's / project's cookie
  assert.equal(runs('/', { 'sb-otherproject-auth-token': 't' }), false)
})

test('a whole or a split session cookie: the proxy runs on pages', () => {
  for (const cookies of [{ [keys[0]]: 't' }, { [keys[1]]: 'a', [`${keys[0]}.1`]: 'b' }])
    for (const path of ['/', '/article/pubmed-1', '/library', '/profile', '/verify-email', '/admin'])
      assert.equal(runs(path, cookies), true, `${path} ${Object.keys(cookies)}`)
})

test('with a session, the old exclusions still apply', () => {
  const cookies = { [keys[0]]: 't' }
  for (const path of ['/api/save-article', '/_next/static/x.js', '/_next/image', '/favicon.ico', '/robots.txt',
    '/sitemap.xml', '/sitemaps/1.xml', '/manifest.json', '/sw.js', '/article/pubmed-1/opengraph-image', '/logo.png'])
    assert.equal(runs(path, cookies), false, path)
})
