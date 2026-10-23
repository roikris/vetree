import { test } from 'node:test'
import assert from 'node:assert/strict'
import { META_PREVIEW_UA } from '../../lib/metaPreview'

// next.config.ts `has` header values are full-match regexes, like this anchored form
const matches = (ua: string) => new RegExp(`^${META_PREVIEW_UA}$`).test(ua)

test('Meta link-preview fetchers match (user agents from the production request log)', () => {
  assert.equal(matches('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'), true)
  assert.equal(matches('facebookcatalog/1.0'), true)
})

test('browsers, Meta search indexer and other crawlers do not match', () => {
  for (const ua of [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-webindexer/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'WhatsApp/2.23.20.0',
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  ]) assert.equal(matches(ua), false, ua)
})
