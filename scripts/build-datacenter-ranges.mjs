#!/usr/bin/env node
// Builds lib/analytics/datacenter-ranges.json — the hosting-network IP ranges /api/analytics/track and
// /api/analytics/event use to set traffic_class = 'datacenter:<provider>' (analytics-001).
//
// Sources: each provider's own published list where one exists (AWS, Google Cloud, Azure, Oracle, DigitalOcean),
// else the prefixes the provider's network (ASN) announces, from RIPEstat. A match means "this request came from a
// hosting network" — a scanner, crawler or a person on a VPN / proxy; it is an estimate, never a bot verdict.
// No match means unknown, not human: provider lists are incomplete (e.g. AWS leaves out some services and BYOIP).
//
// Run: node scripts/build-datacenter-ranges.mjs   (monthly; commit the result in a PR)

import fs from 'node:fs'

const OUT = new URL('../lib/analytics/datacenter-ranges.json', import.meta.url)

const ASNS = {
  meta: [32934],
  alibaba: [45102, 37963],
  tencent: [132203, 45090],
  huawei: [136907],
  hetzner: [24940],
  ovh: [16276],
  linode: [63949],
  vultr: [20473],
  microsoft: [8075],
}

async function get(url, as = 'json') {
  const res = await fetch(url, { headers: { 'user-agent': 'vetree-datacenter-ranges/1' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return as === 'json' ? res.json() : res.text()
}

async function aws() {
  const d = await get('https://ip-ranges.amazonaws.com/ip-ranges.json')
  return [...d.prefixes.map(p => p.ip_prefix), ...d.ipv6_prefixes.map(p => p.ipv6_prefix)]
}
async function google() {
  const d = await get('https://www.gstatic.com/ipranges/cloud.json')
  return d.prefixes.map(p => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean)
}
async function azure() {
  const page = await get('https://www.microsoft.com/en-us/download/details.aspx?id=56519', 'text')
  const url = page.match(/https:\/\/download\.microsoft\.com\/download\/[^"]*ServiceTags_Public_\d+\.json/)?.[0]
  if (!url) throw new Error('azure: service tags download link not found')
  const d = await get(url)
  return d.values.flatMap(v => v.properties.addressPrefixes)
}
async function oracle() {
  const d = await get('https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json')
  return d.regions.flatMap(r => r.cidrs.map(c => c.cidr))
}
async function digitalocean() {
  const csv = await get('https://digitalocean.com/geo/google.csv', 'text')
  return csv.split('\n').map(l => l.split(',')[0].trim()).filter(Boolean)
}
async function asn(n) {
  const d = await get(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${n}`)
  return d.data.prefixes.map(p => p.prefix)
}

// ---- CIDR → [start, end] as BigInt -------------------------------------------------------------
function parseV4(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0n
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    n = (n << 8n) | BigInt(p)
  }
  return n
}
function parseV6(ip) {
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail]
  let n = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    n = (n << 16n) | BigInt(parseInt(g, 16))
  }
  return n
}
function cidr(c) {
  const [ip, lenStr] = c.trim().split('/')
  const v6 = ip.includes(':')
  const bits = v6 ? 128n : 32n
  const base = v6 ? parseV6(ip) : parseV4(ip)
  const len = BigInt(lenStr ?? bits)
  if (base === null || len < 0n || len > bits) return null
  const host = bits - len
  const start = (base >> host) << host
  return { v6, start, end: start + (1n << host) - 1n }
}

// Sort + merge into non-overlapping intervals; where providers overlap, the earlier interval's provider keeps it.
function merge(list) {
  list.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const out = []
  for (const r of list) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end + 1n) {
      if (r.p === last.p) { if (r.end > last.end) last.end = r.end; continue }
      if (r.end <= last.end) continue            // fully inside another provider's range
      r.start = last.end + 1n                    // keep only the part past it
    }
    out.push({ ...r })
  }
  return out
}

const providers = { aws, google, azure, oracle, digitalocean }
for (const [name, nums] of Object.entries(ASNS)) providers[name] = async () => (await Promise.all(nums.map(asn))).flat()

const names = Object.keys(providers)
const v4 = [], v6 = [], counts = {}
for (const [i, name] of names.entries()) {
  const prefixes = await providers[name]()
  let ok = 0
  for (const c of prefixes) {
    const r = cidr(c)
    if (!r) continue
    ok++
    ;(r.v6 ? v6 : v4).push({ start: r.start, end: r.end, p: i })
  }
  if (ok === 0) throw new Error(`${name}: no usable prefixes`)
  counts[name] = ok
}

const m4 = merge(v4), m6 = merge(v6)
const json = {
  note: 'Generated by scripts/build-datacenter-ranges.mjs — do not edit. Hosting-network ranges for traffic_class; a match is an estimate (scanner, crawler or VPN user), no match is unknown.',
  generated_at: new Date().toISOString().slice(0, 10),
  providers: names,
  prefixes_read: counts,
  // [start, end, providerIndex]; v4 as numbers, v6 as 32-digit hex strings (compare as strings: fixed width)
  v4: m4.map(r => [Number(r.start), Number(r.end), r.p]),
  v6: m6.map(r => [r.start.toString(16).padStart(32, '0'), r.end.toString(16).padStart(32, '0'), r.p]),
}
fs.writeFileSync(OUT, JSON.stringify(json) + '\n')
console.log(`v4 ${m4.length} intervals, v6 ${m6.length} intervals, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`, counts)
