'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { normalizeQuery } from '@/lib/utils/normalizeQuery'

type SynthesisPanelProps = {
  query: string
  onClose?: () => void
  isLoggedIn?: boolean
}

type StudyBreakdown = {
  systematic_reviews: number
  rct: number
  retrospective: number
  case_reports: number
  total: number
}

type ArticlePacket = {
  citation_id: number
  id: string
  title: string
  journal: string
  year: number
  clinical_bottom_line: string
  labels: string
}

type SynthesisData = {
  synthesis_html: string
  synthesis_text?: string
  article_ids: string[]
  articles?: ArticlePacket[]
  study_type_breakdown: StudyBreakdown
  from_cache: boolean
  model_used?: string
  generation_time_ms?: number
  cache_hits?: number
}

export function SynthesisPanel({ query, onClose, isLoggedIn }: SynthesisPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SynthesisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [showFeedbackNote, setShowFeedbackNote] = useState(false)
  const [feedbackNote, setFeedbackNote] = useState('')
  const [showSources, setShowSources] = useState(false)

  // BUG 3 FIX: sessionStorage key for persistence
  const SYNTHESIS_KEY = `vetree_synthesis_${normalizeQuery(query)}`

  // BUG 3 FIX: On mount, check sessionStorage for saved synthesis
  useEffect(() => {
    const saved = sessionStorage.getItem(SYNTHESIS_KEY)
    if (saved) {
      try {
        const savedData = JSON.parse(saved)
        setData(savedData)
        setLoading(false)
        return // Don't fetch if we have cached data
      } catch (e) {
        console.error('[SynthesisPanel] Failed to parse saved data:', e)
      }
    }

    // If no saved data, fetch from API
    async function fetchSynthesis() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/synthesis/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate synthesis')
        }

        const result = await response.json()
        setData(result)

        // BUG 3 FIX: Save to sessionStorage
        sessionStorage.setItem(SYNTHESIS_KEY, JSON.stringify(result))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (query && query.trim().length >= 3) {
      fetchSynthesis()
    }
  }, [query, SYNTHESIS_KEY])

  const submitFeedback = async (feedback: 'helpful' | 'not_relevant') => {
    try {
      await fetch('/api/synthesis/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          feedback,
          feedback_note: feedbackNote || null
        })
      })

      setFeedbackSubmitted(true)
      setShowFeedbackNote(false)

      // Auto-hide feedback confirmation after 3 seconds
      setTimeout(() => setFeedbackSubmitted(false), 3000)
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }

  const handleNotRelevant = () => {
    setShowFeedbackNote(true)
  }

  const handleSubmitNote = () => {
    submitFeedback('not_relevant')
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🔬</div>
          <div className="flex-1">
            <div className="h-6 bg-blue-200 dark:bg-blue-800 rounded w-48 mb-2"></div>
            <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-64"></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-full"></div>
          <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-5/6"></div>
          <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-4/6"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚠️</div>
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
              Failed to generate synthesis
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.synthesis_html) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔬</div>
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              No synthesis available
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Not enough matching studies found to generate a synthesis for this query. Try a broader search term.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const breakdown = data.study_type_breakdown
  const hasConflictingEvidence = data.synthesis_html.toLowerCase().includes('conflicting evidence')

  // BUG 1 FIX: Extract plain text from synthesis_html (remove <a> tags for markdown rendering)
  const synthesisText = data.synthesis_html.replace(/<a[^>]*>(\[(\d+)\])<\/a>/g, '[$2]')

  // BUG 2 FIX: Get articles from API response
  const synthesisArticles = data.articles || []

  // BUG 1 FIX: Custom markdown components with citation link handler
  const CitationLink = (props: any) => {
    const { href, children } = props
    const citationMatch = children?.toString().match(/\[(\d+)\]/)
    if (citationMatch) {
      const citationId = parseInt(citationMatch[1])
      const article = synthesisArticles.find(a => a.citation_id === citationId)
      if (article) {
        return (
          <a
            href={`/article/${article.id}`}
            className="citation-link text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
            title={article.title}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        )
      }
    }

    return (
      <a
        href={href}
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-8 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-2xl">🔬</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                  Evidence Synthesis
                </h2>
                {data.from_cache ? (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                    ⚡ Cached
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                    🔄 Live synthesis
                  </span>
                )}
                {hasConflictingEvidence && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded">
                    ⚠️ Conflicting evidence
                  </span>
                )}
              </div>

              {/* Evidence quality badges */}
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="px-2 py-1 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded">
                  Based on {breakdown.total} studies
                </span>
                {breakdown.systematic_reviews > 0 && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    🟢 {breakdown.systematic_reviews} Systematic Review{breakdown.systematic_reviews > 1 ? 's' : ''}
                  </span>
                )}
                {breakdown.rct > 0 && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                    🟢 {breakdown.rct} RCT{breakdown.rct > 1 ? 's' : ''}
                  </span>
                )}
                {breakdown.retrospective > 0 && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                    🟡 {breakdown.retrospective} Retrospective
                  </span>
                )}
                {breakdown.case_reports > 0 && (
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                    🔴 {breakdown.case_reports} Case Report{breakdown.case_reports > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Collapse/Close buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-5 h-5 text-blue-700 dark:text-blue-300 transition-transform ${expanded ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-blue-700 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          {/* BUG 1 FIX: Synthesis content with ReactMarkdown */}
          <div className="prose prose-blue dark:prose-invert max-w-none mb-6">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mt-6 mb-3 first:mt-0 border-b border-blue-200 dark:border-blue-800 pb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mt-4 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-zinc-700 dark:text-zinc-300">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="ml-4 leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                    {children}
                  </strong>
                ),
                a: CitationLink,
              }}
            >
              {synthesisText}
            </ReactMarkdown>
          </div>

          {/* Disclaimer */}
          <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-4 text-sm text-blue-800 dark:text-blue-200">
            <strong>ℹ️ AI-generated synthesis.</strong> Always verify with original sources. Click citation numbers to read full articles.
          </div>

          {/* BUG 2 FIX: View source articles button with toggle */}
          {synthesisArticles.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-blue-700 dark:text-blue-300 hover:underline text-sm font-medium flex items-center gap-1"
              >
                📚 {showSources ? 'Hide' : 'View'} source articles ({synthesisArticles.length})
                <svg className={`w-4 h-4 transition-transform ${showSources ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* BUG 2 FIX: Show articles from synthesis API response */}
              {showSources && (
                <div className="mt-3 space-y-2">
                  {synthesisArticles.map((article) => (
                    <a
                      key={article.id}
                      href={`/article/${article.id}`}
                      className="block p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="text-[#3D7A5F] dark:text-[#4E9A78] text-sm font-mono font-semibold">
                        [{article.citation_id}]
                      </span>
                      <span className="text-zinc-900 dark:text-zinc-100 text-sm ml-2">
                        {article.title}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-xs ml-2">
                        · {article.journal} ({article.year})
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback buttons */}
          {!feedbackSubmitted && !showFeedbackNote && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Was this synthesis helpful?</span>
              <button
                onClick={() => submitFeedback('helpful')}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                👍 Helpful
              </button>
              <button
                onClick={handleNotRelevant}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                👎 Not relevant
              </button>
            </div>
          )}

          {/* Feedback note input */}
          {showFeedbackNote && (
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                What was wrong with this synthesis?
              </label>
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Optional: Help us improve..."
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleSubmitNote}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Submit Feedback
                </button>
                <button
                  onClick={() => setShowFeedbackNote(false)}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Feedback confirmation */}
          {feedbackSubmitted && (
            <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 mb-4">
              ✓ Thank you for your feedback!
            </div>
          )}

          {/* Soft sign-up nudge for anonymous users */}
          {!isLoggedIn && (
            <div className="mt-4 flex items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                📌 Save this synthesis to your profile
              </p>
              <a
                href="/signup"
                className="shrink-0 px-4 py-1.5 bg-[#3D7A5F] hover:bg-[#2F5F4A] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Sign up free →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
