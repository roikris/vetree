import ranges from './datacenter-ranges.json'

// Hosting-network lookup for traffic_class = 'datacenter:<provider>' (analytics-001). The raw IP is only compared
// here, in memory — it is never stored or logged. A match is an estimate (link scanner, crawler, or a person on a
// VPN / proxy), so it never sets bot_name. Ranges: scripts/build-datacenter-ranges.mjs (non-overlapping, sorted).

type V4 = [number, number, number]
type V6 = [string, string, number]
const V4_RANGES = ranges.v4 as V4[]
const V6_RANGES = ranges.v6 as V6[]
const PROVIDERS = ranges.providers as string[]

export function parseIPv4(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

/** 32-digit lowercase hex of a full IPv6 address, or null. Accepts '::' compression and a trailing dotted IPv4. */
export function parseIPv6(ip: string): string | null {
  let s = ip.toLowerCase()
  const zone = s.indexOf('%')
  if (zone !== -1) s = s.slice(0, zone)
  const lastColon = s.lastIndexOf(':')
  if (s.includes('.', lastColon)) {
    const v4 = parseIPv4(s.slice(lastColon + 1))
    if (v4 === null) return null
    s = s.slice(0, lastColon + 1) + Math.floor(v4 / 65536).toString(16) + ':' + (v4 % 65536).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail]
  let out = ''
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out += g.padStart(4, '0')
  }
  return out
}

function search<T extends string | number>(list: [T, T, number][], x: T): number | null {
  let lo = 0, hi = list.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [start, end, p] = list[mid]
    if (x < start) hi = mid - 1
    else if (x > end) lo = mid + 1
    else return p
  }
  return null
}

/** The hosting provider an IP belongs to ('aws', 'meta', …), or null when unknown / not an IP. */
export function datacenterProvider(ip: string | null | undefined): string | null {
  if (!ip) return null
  const s = ip.trim()
  if (s.includes(':')) {
    const hex = parseIPv6(s)
    if (hex === null) return null
    // IPv4-mapped (::ffff:a.b.c.d) → look up as IPv4
    if (hex.startsWith('00000000000000000000ffff')) {
      const p = search(V4_RANGES, parseInt(hex.slice(24), 16))
      return p === null ? null : PROVIDERS[p]
    }
    const p = search(V6_RANGES, hex)
    return p === null ? null : PROVIDERS[p]
  }
  const n = parseIPv4(s)
  if (n === null) return null
  const p = search(V4_RANGES, n)
  return p === null ? null : PROVIDERS[p]
}

/** traffic_class for a request IP: 'datacenter:<provider>' or null. */
export function trafficClassForIP(ip: string | null | undefined): string | null {
  const provider = datacenterProvider(ip)
  return provider ? `datacenter:${provider}` : null
}
