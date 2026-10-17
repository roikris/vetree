// Read every row of a query, 1,000 at a time (PostgREST's row cap). The page callback must order deterministically
// (e.g. created_at, id). Throws on the first error — a partial total is never returned.
export async function readAll<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(`${label}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

/** Hosting-network / suspected-automation estimate (traffic_class, analytics-001) — never 'suspected_test'. */
export function isLikelyAutomated(trafficClass: string | null | undefined): boolean {
  return !!trafficClass && trafficClass !== 'suspected_test'
}
