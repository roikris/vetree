'use client'

import { useState } from 'react'

type PreviewUser = {
  email: string
  tags: string[]
  article_count: number
  titles: string[]
}

type DryRunResult = {
  dry_run: true
  would_send: PreviewUser[]
  would_skip: number
  total_users: number
}

function buildReport(result: DryRunResult): string {
  const lines: string[] = []
  lines.push(`DIGEST DRY-RUN REPORT`)
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push(`─────────────────────────────────────────`)
  lines.push(`Total users:   ${result.total_users}`)
  lines.push(`Would send:    ${result.would_send.length}`)
  lines.push(`Would skip:    ${result.would_skip}`)
  lines.push(``)
  lines.push(`─────────────────────────────────────────`)
  lines.push(`RECIPIENTS (${result.would_send.length})`)
  lines.push(`─────────────────────────────────────────`)

  for (const user of result.would_send) {
    lines.push(``)
    lines.push(`• ${user.email}`)
    lines.push(`  Tags:     ${user.tags.length > 0 ? user.tags.join(', ') : '(none — general feed)'}`)
    lines.push(`  Articles: ${user.article_count}`)
    for (const title of user.titles) {
      lines.push(`    - ${title}`)
    }
  }

  return lines.join('\n')
}

export function DigestDryRun() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')

  async function runDryRun() {
    setLoading(true)
    setError('')
    setReport('')

    try {
      const res = await fetch('/api/admin/trigger-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`)
        return
      }

      if (!data.dry_run) {
        setError('Unexpected response — dry_run flag not returned. The digest may have been sent for real.')
        return
      }

      setReport(buildReport(data as DryRunResult))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Digest Dry Run</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Simulate this week&apos;s digest send — see who would receive it, with which articles. No emails sent, no DB writes.
          </p>
        </div>
        <button
          onClick={runDryRun}
          disabled={loading}
          className="shrink-0 px-4 py-2 bg-[#3D7A5F] hover:bg-[#2e6049] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Running…' : '▶ Run Dry Run'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {report && (
        <textarea
          readOnly
          value={report}
          className="w-full h-[520px] font-mono text-xs bg-zinc-950 text-green-400 border border-zinc-700 rounded-lg p-4 resize-y focus:outline-none"
        />
      )}

      {!report && !error && !loading && (
        <div className="flex items-center justify-center h-40 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-400">
          Press &quot;Run Dry Run&quot; to generate a preview report.
        </div>
      )}
    </div>
  )
}
