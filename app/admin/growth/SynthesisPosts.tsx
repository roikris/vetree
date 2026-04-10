'use client'

import { useState, useEffect } from 'react'

type FormatKey = 'evidence_report' | 'clinical_insight' | 'myth_vs_evidence'

type FormatData = {
  content: string
  label: string
}

type SynthesisResult = {
  topic: string
  synthesis_id: string
  article_count: number
  study_type_breakdown: {
    systematic_reviews: number
    rct: number
    retrospective: number
    case_reports: number
    total: number
  }
  formats: Record<FormatKey, FormatData>
}

type Opportunity = {
  topic: string
  search_count: number
  opportunity_score: number
}

type HistoryEntry = {
  id: string
  synthesis_topic: string
  hook_line: string | null
  platform: string
  created_at: string
}

const FORMAT_KEYS: FormatKey[] = ['evidence_report', 'clinical_insight', 'myth_vs_evidence']

const FORMAT_LABELS: Record<FormatKey, string> = {
  evidence_report: 'Evidence Report',
  clinical_insight: 'Clinical Insight',
  myth_vs_evidence: 'Myth vs Evidence',
}

const WORD_TARGETS: Record<FormatKey, string> = {
  evidence_report: '200–300',
  clinical_insight: '200–300',
  myth_vs_evidence: '150–250',
}

function lsKey() {
  return `vetree_synthesis_post_${new Date().toISOString().split('T')[0]}`
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function SynthesisPosts() {
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<SynthesisResult | null>(null)
  const [editedFormats, setEditedFormats] = useState<Record<FormatKey, string>>({
    evidence_report: '',
    clinical_insight: '',
    myth_vs_evidence: '',
  })
  const [activeFormat, setActiveFormat] = useState<FormatKey>('evidence_report')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [approvedFormat, setApprovedFormat] = useState<FormatKey | null>(null)
  const [regeneratingFormat, setRegeneratingFormat] = useState<FormatKey | null>(null)
  const [isSaving, setIsSaving] = useState<FormatKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<FormatKey | null>(null)

  // Restore today's state from localStorage and load opportunities/history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey())
      if (saved) {
        const parsed: SynthesisResult = JSON.parse(saved)
        setResult(parsed)
        setTopic(parsed.topic || '')
        setEditedFormats({
          evidence_report: parsed.formats?.evidence_report?.content || '',
          clinical_insight: parsed.formats?.clinical_insight?.content || '',
          myth_vs_evidence: parsed.formats?.myth_vs_evidence?.content || '',
        })
      }
    } catch {}
    loadSideData()
  }, [])

  const loadSideData = async () => {
    try {
      const res = await fetch('/api/growth/synthesis-opportunities')
      if (res.ok) {
        const data = await res.json()
        setOpportunities(data.opportunities || [])
        setHistory(data.history || [])
      }
    } catch {}
  }

  const generate = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    setError(null)
    setApprovedFormat(null)

    try {
      const res = await fetch('/api/growth/generate-synthesis-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to generate posts')
        return
      }

      setResult(data)
      setEditedFormats({
        evidence_report: data.formats.evidence_report.content,
        clinical_insight: data.formats.clinical_insight.content,
        myth_vs_evidence: data.formats.myth_vs_evidence.content,
      })
      localStorage.setItem(lsKey(), JSON.stringify(data))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const regenerateFormat = async (formatKey: FormatKey) => {
    if (!result) return
    setRegeneratingFormat(formatKey)

    try {
      const res = await fetch('/api/growth/generate-synthesis-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: result.topic, synthesis_id: result.synthesis_id }),
      })
      const data = await res.json()
      if (!res.ok) return

      const newContent = data.formats[formatKey].content
      setEditedFormats(prev => ({ ...prev, [formatKey]: newContent }))

      // Update localStorage
      try {
        const saved = localStorage.getItem(lsKey())
        if (saved) {
          const parsed = JSON.parse(saved)
          parsed.formats[formatKey].content = newContent
          localStorage.setItem(lsKey(), JSON.stringify(parsed))
        }
      } catch {}
    } finally {
      setRegeneratingFormat(null)
    }
  }

  const approveFormat = async (formatKey: FormatKey) => {
    if (!result) return
    setIsSaving(formatKey)

    const content = editedFormats[formatKey]
    const hookLine = content.split('\n')[0].trim()

    try {
      const res = await fetch('/api/growth/save-synthesis-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          synthesis_topic: result.topic,
          hook_line: hookLine,
          platform: 'linkedin',
          language: 'en',
        }),
      })
      if (res.ok) {
        setApprovedFormat(formatKey)
        loadSideData()
      }
    } finally {
      setIsSaving(null)
    }
  }

  const copyFormat = async (formatKey: FormatKey) => {
    await navigator.clipboard.writeText(editedFormats[formatKey])
    setCopiedFormat(formatKey)
    setTimeout(() => setCopiedFormat(null), 2000)
  }

  const activeWordCount = wordCount(editedFormats[activeFormat])
  const targetRange = WORD_TARGETS[activeFormat]
  const [targetMin, targetMax] = targetRange.split('–').map(Number)
  const wordCountOk = activeWordCount >= targetMin && activeWordCount <= targetMax

  return (
    <div className="space-y-8">

      {/* Section 1 — Topic Selection */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Generate Weekly Synthesis Post
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Based on evidence from multiple studies. Best for LinkedIn.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isGenerating && generate()}
            placeholder="e.g. canine diabetes management, TPLO outcomes"
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D7A5F]"
          />

          {opportunities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Suggested topics from search analytics:
              </p>
              <div className="flex flex-wrap gap-2">
                {opportunities.map(op => (
                  <button
                    key={op.topic}
                    onClick={() => setTopic(op.topic)}
                    className="px-3 py-1 text-xs rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-[#3D7A5F] hover:text-[#3D7A5F] dark:hover:text-[#4E9A78] transition-colors"
                  >
                    {op.topic} ({op.search_count} searches)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={generate}
          disabled={isGenerating || !topic.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3D7A5F] hover:bg-[#2D6A4F] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating 3 formats…
            </>
          ) : '🔬 Generate Synthesis Posts'}
        </button>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Section 2 — Generated Posts */}
      {result && (
        <div className="space-y-4">
          {/* Synthesis metadata card */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                📊 Based on {result.article_count} studies
                {' · '}{result.study_type_breakdown.rct} RCTs
                {' · '}{result.study_type_breakdown.retrospective} retrospective
                {' · '}{result.study_type_breakdown.case_reports} case reports
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Topic: <span className="font-medium">{result.topic}</span>
              </p>
            </div>
            <a
              href={`/?q=${encodeURIComponent(result.topic)}&synthesize=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              View Full Synthesis →
            </a>
          </div>

          {/* Format editor */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            {/* Format tabs */}
            <div className="flex gap-2 flex-wrap">
              {FORMAT_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => setActiveFormat(key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeFormat === key
                      ? 'bg-[#3D7A5F] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {FORMAT_LABELS[key]}
                  {approvedFormat === key && ' ✅'}
                </button>
              ))}
            </div>

            <textarea
              value={editedFormats[activeFormat]}
              onChange={e =>
                setEditedFormats(prev => ({ ...prev, [activeFormat]: e.target.value }))
              }
              rows={13}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#3D7A5F]"
            />

            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className={`text-xs ${wordCountOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {activeWordCount} words (target: {targetRange})
              </span>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => regenerateFormat(activeFormat)}
                  disabled={regeneratingFormat === activeFormat}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {regeneratingFormat === activeFormat ? (
                    <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  ) : '🔄'}
                  Regenerate
                </button>
                <button
                  onClick={() => copyFormat(activeFormat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copiedFormat === activeFormat ? '✓ Copied' : '📋 Copy'}
                </button>
                <button
                  onClick={() => approveFormat(activeFormat)}
                  disabled={isSaving === activeFormat || approvedFormat === activeFormat}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {isSaving === activeFormat ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : approvedFormat === activeFormat ? '✅ Approved' : '✅ Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3 — History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
            Recent Approved Synthesis Posts
          </h3>
          <div className="space-y-0">
            {history.map(entry => (
              <div
                key={entry.id}
                className="flex items-start justify-between gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {entry.synthesis_topic}
                  </p>
                  {entry.hook_line && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {entry.hook_line}
                    </p>
                  )}
                </div>
                <p className="text-xs text-zinc-400 whitespace-nowrap shrink-0">
                  {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
