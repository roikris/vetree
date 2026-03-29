'use client'

import { useState } from 'react'

type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'
type OverallSeverity = FindingSeverity | 'clean'

type Finding = {
  id: string
  severity: FindingSeverity
  title: string
  description: string
  affected: string[]
  detected_at: string
}

type Fix = {
  finding_id: string
  fix_prompt: string
}

type SecurityReport = {
  id: string
  run_id: string
  generated_at: string
  triggered_by: string
  severity: OverallSeverity
  findings_json: Finding[]
  fixes_json: Fix[]
  summary: string
}

type HistoryItem = Pick<SecurityReport, 'id' | 'run_id' | 'generated_at' | 'severity' | 'triggered_by' | 'summary'>

const severityBadge: Record<OverallSeverity, string> = {
  critical: 'text-red-400 bg-red-400/10 border border-red-400/30',
  high: 'text-orange-400 bg-orange-400/10 border border-orange-400/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30',
  low: 'text-blue-400 bg-blue-400/10 border border-blue-400/30',
  clean: 'text-green-400 bg-green-400/10 border border-green-400/30',
}

const severityDot: Record<FindingSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
}

const severityEmoji: Record<OverallSeverity, string> = {
  critical: '🚨',
  high: '🔴',
  medium: '🟠',
  low: '🟡',
  clean: '✅',
}

export function SecurityClient({
  initialReports,
}: {
  initialReports: SecurityReport[]
}) {
  const [reports] = useState(initialReports)
  const [activeReport, setActiveReport] = useState<SecurityReport | null>(initialReports[0] ?? null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState('')

  const handleRunScan = async () => {
    setIsRunning(true)
    setRunError('')
    try {
      const res = await fetch('/api/admin/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'admin' }),
      })
      if (!res.ok) throw new Error(await res.text())
      window.location.reload()
    } catch (err) {
      setRunError('Scan failed — check browser console.')
      setIsRunning(false)
      console.error('[security] Scan error:', err)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      // fallback: select text manually
    }
  }

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const latestReport = reports[0]

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
            🔒 Security Agent
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Automated security checks — runs weekly on Thursdays at 21:00 Israel time
          </p>
          {latestReport && (
            <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
              Last scan: {new Date(latestReport.generated_at).toLocaleString()}
              {' · '}
              <span className={`font-medium uppercase text-xs px-1.5 py-0.5 rounded ${severityBadge[latestReport.severity]}`}>
                {latestReport.severity}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {runError && <p className="text-sm text-red-400">{runError}</p>}
          <button
            onClick={handleRunScan}
            disabled={isRunning}
            className="px-5 py-2.5 bg-[#3D7A5F] hover:bg-[#2F5F4A] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRunning ? (
              <><span className="animate-spin inline-block">⏳</span> Scanning…</>
            ) : (
              <>🔍 Run Scan Now</>
            )}
          </button>
        </div>
      </div>

      {/* Active Report Card */}
      {activeReport ? (
        <>
          <div className={`rounded-xl p-6 mb-8 border-2 ${severityBadge[activeReport.severity]}`}>
            <div className="flex items-center gap-5">
              <div className="text-5xl">{severityEmoji[activeReport.severity]}</div>
              <div>
                <div className="text-2xl font-bold uppercase tracking-wide">
                  {activeReport.severity === 'clean' ? 'All Clear' : activeReport.severity}
                </div>
                <div className="text-sm opacity-75 mt-0.5">
                  {activeReport.findings_json?.length ?? 0} issue
                  {(activeReport.findings_json?.length ?? 0) !== 1 ? 's' : ''} found
                  {activeReport.id !== reports[0]?.id && (
                    <span className="ml-2 opacity-60">
                      — {new Date(activeReport.generated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {activeReport.id !== reports[0]?.id && (
                <button
                  onClick={() => setActiveReport(reports[0] ?? null)}
                  className="ml-auto text-xs opacity-60 hover:opacity-100 underline"
                >
                  ← Back to latest
                </button>
              )}
            </div>
          </div>

          {/* Findings List */}
          {activeReport.findings_json && activeReport.findings_json.length > 0 ? (
            <div className="mb-10">
              <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
                Findings
              </h2>
              <div className="space-y-3">
                {activeReport.findings_json.map((finding) => {
                  const fix = activeReport.fixes_json?.find(f => f.finding_id === finding.id)
                  const isExpanded = expandedFindings.has(finding.id)
                  return (
                    <div
                      key={finding.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                    >
                      {/* Finding header */}
                      <div className="p-4 bg-white dark:bg-[#1A1A1A]">
                        <div className="flex items-start gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${severityDot[finding.severity]}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${severityBadge[finding.severity]}`}>
                                {finding.severity}
                              </span>
                              <span className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                                {finding.title}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                              {finding.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {finding.affected.map(a => (
                                <span
                                  key={a}
                                  className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fix prompt (collapsible) */}
                      {fix && fix.fix_prompt && (
                        <div className="border-t border-zinc-200 dark:border-zinc-800">
                          <button
                            onClick={() => toggleFinding(finding.id)}
                            className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                          >
                            <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                            🔧 Fix: {finding.title}
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 bg-zinc-50 dark:bg-zinc-900/50">
                              <div className="relative">
                                <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 pr-20 leading-relaxed">
                                  {fix.fix_prompt}
                                </pre>
                                <button
                                  onClick={() => handleCopy(fix.fix_prompt, finding.id)}
                                  className="absolute top-2 right-2 px-2.5 py-1 text-xs bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors font-medium"
                                >
                                  {copiedId === finding.id ? '✓ Copied!' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                Paste this into Claude Code to fix the issue
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400 mb-10">
              🎉 No security issues detected in this scan
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-zinc-500 dark:text-zinc-400 mb-10">
          No scans yet. Click &quot;Run Scan Now&quot; to perform the first security check.
        </div>
      )}

      {/* Scan History */}
      {reports.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Scan History
          </h2>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Severity</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Summary</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Triggered By</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {reports.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-zinc-200 dark:border-zinc-800 last:border-0 ${
                      activeReport?.id === item.id ? 'bg-[#3D7A5F]/5 dark:bg-[#4E9A78]/5' : ''
                    } ${idx % 2 !== 0 ? 'bg-zinc-50/50 dark:bg-zinc-900/30' : ''}`}
                  >
                    <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(item.generated_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${severityBadge[item.severity]}`}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.summary}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-500">
                      {item.triggered_by}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setActiveReport(item)}
                        className="text-xs text-[#3D7A5F] dark:text-[#4E9A78] hover:underline whitespace-nowrap"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
