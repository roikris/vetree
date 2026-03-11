import { createClient } from '@supabase/supabase-js'

export default async function DiagnosticsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Query 1: Total articles
  const { count: totalArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  // Query 2: Currently visible to users
  const { count: visibleArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')

  // Query 3a: needs_enrichment = true
  const { count: needsEnrichment } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', true)

  // Query 3b: needs_enrichment = false BUT summary is null
  const { count: enrichedNoSummary } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .is('summary', null)

  // Query 3c: needs_enrichment = false BUT clinical_bottom_line is null
  const { count: enrichedNoCBL } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .is('clinical_bottom_line', null)

  // Query 3d: needs_enrichment = false, has content BUT quarantined
  const { count: quarantinedComplete } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .eq('quarantined', true)

  // Query 3e: enrichment_attempts >= 3 (permanently failed)
  const { count: permanentlyFailed } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('enrichment_attempts', 3)
    .or('force_retry.eq.false,force_retry.is.null')

  // Query 3f: never tried, incorrectly marked done
  const { count: neverTriedButDone } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_attempts', 0)
    .eq('needs_enrichment', false)
    .is('summary', null)

  // Query 3g: Sample problem articles
  const { data: sampleProblems } = await supabase
    .from('articles')
    .select('id, title, needs_enrichment, enrichment_attempts, summary, clinical_bottom_line, quarantined, last_enrichment_error')
    .eq('needs_enrichment', false)
    .is('summary', null)
    .limit(5)

  const hiddenCount = (totalArticles || 0) - (visibleArticles || 0)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
            Article Visibility Diagnostics
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Understanding why {hiddenCount.toLocaleString()} articles are not showing on the UI
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Total Articles</div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalArticles?.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Visible to Users</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">
              {visibleArticles?.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {totalArticles ? Math.round((visibleArticles! / totalArticles) * 100) : 0}% of total
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Hidden from Users</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-500">
              {hiddenCount.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {totalArticles ? Math.round((hiddenCount / totalArticles) * 100) : 0}% of total
            </div>
          </div>
        </div>

        {/* Breakdown of Hidden Articles */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Breakdown: Why Articles Are Hidden
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <div className="font-medium text-blue-900 dark:text-blue-100">
                  3a. Queued for Enrichment
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  needs_enrichment = true
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                {needsEnrichment?.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div>
                <div className="font-medium text-orange-900 dark:text-orange-100">
                  3b. Enriched Flag But No Summary
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  needs_enrichment = false AND summary IS NULL
                </div>
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                {enrichedNoSummary?.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div>
                <div className="font-medium text-orange-900 dark:text-orange-100">
                  3c. Enriched Flag But No Clinical Bottom Line
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  needs_enrichment = false AND clinical_bottom_line IS NULL
                </div>
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">
                {enrichedNoCBL?.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  3d. Complete But Quarantined
                </div>
                <div className="text-sm text-zinc-700 dark:text-zinc-300">
                  has content BUT quarantined = true
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
                {quarantinedComplete?.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div>
                <div className="font-medium text-red-900 dark:text-red-100">
                  3e. Permanently Failed
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">
                  enrichment_attempts ≥ 3 (not force_retry)
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                {permanentlyFailed?.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div>
                <div className="font-medium text-purple-900 dark:text-purple-100">
                  3f. Never Tried But Marked Done
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  enrichment_attempts = 0 AND needs_enrichment = false AND summary IS NULL
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                {neverTriedButDone?.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Sample Problem Articles */}
        {sampleProblems && sampleProblems.length > 0 && (
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Sample Problem Articles (Category 3b)
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Articles marked as enriched but missing summary
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-2 px-2 text-zinc-600 dark:text-zinc-400">ID</th>
                    <th className="text-left py-2 px-2 text-zinc-600 dark:text-zinc-400">Title</th>
                    <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400">Attempts</th>
                    <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400">Has Summary</th>
                    <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400">Has CBL</th>
                    <th className="text-center py-2 px-2 text-zinc-600 dark:text-zinc-400">Quarantined</th>
                    <th className="text-left py-2 px-2 text-zinc-600 dark:text-zinc-400">Last Error</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleProblems.map((article) => (
                    <tr key={article.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                      <td className="py-2 px-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {article.id.slice(0, 8)}...
                      </td>
                      <td className="py-2 px-2 text-zinc-900 dark:text-zinc-100">
                        {article.title?.substring(0, 60)}...
                      </td>
                      <td className="py-2 px-2 text-center text-zinc-700 dark:text-zinc-300">
                        {article.enrichment_attempts}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {article.summary ? '✅' : '❌'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {article.clinical_bottom_line ? '✅' : '❌'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {article.quarantined ? '🚫' : '-'}
                      </td>
                      <td className="py-2 px-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                        {article.last_enrichment_error || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analysis Summary */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            📊 Analysis Summary
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p><strong>Total Hidden:</strong> {hiddenCount.toLocaleString()} articles</p>
            <p><strong>Breakdown:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>{needsEnrichment?.toLocaleString()} queued for enrichment (normal)</li>
              <li>{enrichedNoSummary?.toLocaleString()} incorrectly marked as enriched (missing summary)</li>
              <li>{enrichedNoCBL?.toLocaleString()} incorrectly marked as enriched (missing clinical bottom line)</li>
              <li>{quarantinedComplete?.toLocaleString()} complete but quarantined</li>
              <li>{permanentlyFailed?.toLocaleString()} permanently failed after 3+ attempts</li>
              <li>{neverTriedButDone?.toLocaleString()} never attempted but marked done</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
