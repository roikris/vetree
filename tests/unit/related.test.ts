// lib/articles/related.ts — "Keep reading" on article pages (seo-002). Run: npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookupLabels, relatedScore, rankRelated } from '../../lib/articles/related'

const a = (id: string, labels: string[] | null) => ({ id, labels })

test('lookup uses the specific labels when there are any', () => {
  assert.deepEqual(lookupLabels(['Small Animal', 'Internal Medicine', 'Cardiology']), ['Cardiology'])
  assert.deepEqual(lookupLabels(['Small Animal', 'Internal Medicine']), ['Small Animal', 'Internal Medicine'])
  assert.deepEqual(lookupLabels(['Equine', 'Small Animal']), ['Small Animal'])
  assert.deepEqual(lookupLabels(null), [])
})

test('specific matches outweigh broad ones', () => {
  const mine = ['Small Animal', 'Internal Medicine', 'Cardiology']
  assert.equal(relatedScore(mine, ['Cardiology']), 3)
  assert.equal(relatedScore(mine, ['Small Animal', 'Internal Medicine']), 2)
  assert.equal(relatedScore(mine, ['Dermatology']), 0)
})

test('ranking: score first, query order on ties; drops self, large animal and no-overlap', () => {
  const mine = ['Small Animal', 'Cardiology', 'Emergency']
  const out = rankRelated(mine, 'self', [
    a('self', ['Cardiology']),
    a('newest-broad', ['Small Animal']),
    a('cardio', ['Cardiology']),
    a('horse', ['Cardiology', 'Equine']),
    a('both', ['Cardiology', 'Emergency']),
    a('none', ['Dermatology']),
    a('cardio-older', ['Cardiology', 'Small Animal']),
    a('nolabels', null),
  ], 3)
  assert.deepEqual(out.map(x => x.id), ['both', 'cardio-older', 'cardio'])
})

test('n caps the list', () => {
  const c = Array.from({ length: 10 }, (_, i) => a(`x${i}`, ['Oncology']))
  assert.equal(rankRelated(['Oncology'], 'self', c, 4).length, 4)
})
