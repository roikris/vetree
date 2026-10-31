// lib/analytics/searchConsole.ts — Admin → Analytics → Google Search helpers (analytics-001, migration 088).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isGoogleReferrer, pacificMidnightUtc, median, articleIdFromPath, addDays, LOCAL_HOSTS } from '../../lib/analytics/searchConsole'

test('Google referrer by hostname, not substring', () => {
  for (const yes of ['https://www.google.com/', 'https://www.google.co.il/', 'https://google.de/search?q=x',
    'https://www.google.com.hk/', 'android-app://com.google.android.googlequicksearchbox/']) assert.equal(isGoogleReferrer(yes), true, yes)
  for (const no of ['', null, undefined, 'https://accounts.google.com/', 'https://mail.google.com/', 'https://notgoogle.com/',
    'https://evil.com/?r=www.google.com', 'https://www.google.com.evil.io/', 'android-app://com.google.android.gm/', 'not a url'])
    assert.equal(isGoogleReferrer(no), false, String(no))
})

test('Pacific midnight in UTC across the DST change', () => {
  assert.equal(pacificMidnightUtc('2026-10-31'), '2026-10-31T07:00:00.000Z')   // PDT
  assert.equal(pacificMidnightUtc('2026-11-01'), '2026-11-01T07:00:00.000Z')   // still PDT at midnight
  assert.equal(pacificMidnightUtc('2026-11-02'), '2026-11-02T08:00:00.000Z')   // PST
  assert.equal(pacificMidnightUtc('2027-03-14'), '2027-03-14T08:00:00.000Z')   // PST at midnight, PDT from 02:00
  assert.equal(pacificMidnightUtc('2027-03-15'), '2027-03-15T07:00:00.000Z')
})

test('median, article ids, day arithmetic, local hosts', () => {
  assert.equal(median([]), null)
  assert.equal(median([5]), 5)
  assert.equal(median([9, 1, 5]), 5)
  assert.equal(median([1, 2, 3, 10]), 2.5)
  assert.equal(articleIdFromPath('/article/pubmed-42908201'), 'pubmed-42908201')
  assert.equal(articleIdFromPath('/article/pubmed-42908201/'), 'pubmed-42908201')
  assert.equal(articleIdFromPath('/articles'), null)
  assert.equal(articleIdFromPath('/article/a/b'), null)
  assert.equal(addDays('2026-10-31', -27), '2026-10-04')
  assert.ok(LOCAL_HOSTS.has('vetree.app') && LOCAL_HOSTS.has('www.vetree.app') && !LOCAL_HOSTS.has('blog.vetree.app'))
})
