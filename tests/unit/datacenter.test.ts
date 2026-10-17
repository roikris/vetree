// lib/analytics/datacenter.ts — hosting-network lookup for traffic_class (analytics-001); lib/analytics/readAll.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ranges from '../../lib/analytics/datacenter-ranges.json'
import { datacenterProvider, parseIPv4, parseIPv6, trafficClassForIP } from '../../lib/analytics/datacenter'
import { readAll, isLikelyAutomated } from '../../lib/analytics/readAll'
import { detectBotName } from '../../lib/bot-detection'

const v4 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
const v6 = (hex: string) => hex.match(/.{4}/g)!.join(':')

test('IPv4 parsing', () => {
  assert.equal(parseIPv4('0.0.0.0'), 0)
  assert.equal(parseIPv4('255.255.255.255'), 4294967295)
  assert.equal(parseIPv4('1.2.3.4'), 16909060)
  for (const bad of ['1.2.3', '1.2.3.256', '1.2.3.4.5', 'a.b.c.d', '', '1..2.3']) assert.equal(parseIPv4(bad), null, bad)
})

test('IPv6 parsing: compression, case, zone, embedded IPv4, malformed', () => {
  assert.equal(parseIPv6('::'), '0'.repeat(32))
  assert.equal(parseIPv6('::1'), '0'.repeat(31) + '1')
  assert.equal(parseIPv6('2001:DB8::1'), '20010db8' + '0'.repeat(23) + '1')
  assert.equal(parseIPv6('fe80::1%eth0'), 'fe80' + '0'.repeat(27) + '1')
  assert.equal(parseIPv6('::ffff:1.2.3.4'), '0'.repeat(20) + 'ffff01020304')
  assert.equal(parseIPv6('1:2:3:4:5:6:7:8'), '00010002000300040005000600070008')
  for (const bad of ['1::2::3', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9', 'g::1', '12345::1', '1:2:3:4:5:6:7::8']) {
    assert.equal(parseIPv6(bad), null, bad)
  }
})

test('the generated ranges are sorted and non-overlapping', () => {
  const r4 = ranges.v4 as [number, number, number][]
  const r6 = ranges.v6 as [string, string, number][]
  assert.ok(r4.length > 1000 && r6.length > 1000)
  for (let i = 0; i < r4.length; i++) {
    assert.ok(r4[i][0] <= r4[i][1])
    if (i) assert.ok(r4[i - 1][1] < r4[i][0], `v4 overlap at ${i}`)
  }
  for (let i = 0; i < r6.length; i++) {
    assert.ok(r6[i][0].length === 32 && r6[i][0] <= r6[i][1])
    if (i) assert.ok(r6[i - 1][1] < r6[i][0], `v6 overlap at ${i}`)
  }
})

test('boundaries: first and last address of a range match, the neighbours outside do not', () => {
  const r4 = ranges.v4 as [number, number, number][]
  const providers = ranges.providers as string[]
  // a range with a gap on both sides
  const i = r4.findIndex((r, k) => k > 0 && k < r4.length - 1 && r4[k - 1][1] < r[0] - 1 && r[1] + 1 < r4[k + 1][0])
  const [start, end, p] = r4[i]
  assert.equal(datacenterProvider(v4(start)), providers[p])
  assert.equal(datacenterProvider(v4(end)), providers[p])
  assert.equal(datacenterProvider(v4(start - 1)), null)
  assert.equal(datacenterProvider(v4(end + 1)), null)
  // the same address written as IPv4-mapped IPv6
  assert.equal(datacenterProvider(`::ffff:${v4(start)}`), providers[p])
  assert.equal(trafficClassForIP(v4(start)), `datacenter:${providers[p]}`)
})

test('IPv6 boundaries', () => {
  const r6 = ranges.v6 as [string, string, number][]
  const providers = ranges.providers as string[]
  const [start, end, p] = r6[Math.floor(r6.length / 2)]
  assert.equal(datacenterProvider(v6(start)), providers[p])
  assert.equal(datacenterProvider(v6(end)), providers[p])
})

test('private, loopback, unknown and malformed addresses are not a datacenter', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '::1', 'unknown', '', null, undefined, 'not-an-ip', '999.1.1.1']) {
    assert.equal(trafficClassForIP(ip as string), null, String(ip))
  }
})

test('provider names fit the traffic_class CHECK of migration 084', () => {
  for (const p of ranges.providers as string[]) assert.match(`datacenter:${p}`, /^datacenter:[a-z0-9_-]{1,40}$/)
})

test('readAll pages until a short page and throws on error (never a partial total)', async () => {
  const calls: [number, number][] = []
  const rows = await readAll('t', (from, to) => {
    calls.push([from, to])
    const n = from === 0 ? 1000 : 5
    return Promise.resolve({ data: Array.from({ length: n }, (_, k) => from + k), error: null })
  })
  assert.equal(rows.length, 1005)
  assert.deepEqual(calls, [[0, 999], [1000, 1999]])
  await assert.rejects(
    readAll('label', from => Promise.resolve(from === 0 ? { data: Array(1000).fill(0), error: null } : { data: null, error: { message: 'boom' } })),
    /label: boom/,
  )
})

test('isLikelyAutomated: estimates yes, suspected test traffic and NULL no', () => {
  assert.equal(isLikelyAutomated('datacenter:aws'), true)
  assert.equal(isLikelyAutomated('suspected_fleet'), true)
  assert.equal(isLikelyAutomated('suspected_test'), false)
  assert.equal(isLikelyAutomated(null), false)
})

test('HeadlessChrome is a confirmed bot', () => {
  assert.equal(detectBotName('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36'), 'headless')
  assert.equal(detectBotName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'), null)
})
