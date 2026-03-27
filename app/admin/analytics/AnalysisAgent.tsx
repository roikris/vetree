'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check } from 'lucide-react'

interface Insight {
  area: string
  observation: string
  why_it_matters: string
  recommendation: string
  time_to_implement: string
  impact: string
  confidence: number
}

interface AnalysisData {
  id: string
  run_id: string
  generated_at: string
  insights_json: Insight[]
  top_3_actions: string[]
  content_roadmap: string[]
  churn_risks: string[]
  report_markdown?: string
}

interface Todo {
  insight_id: string
  index: number
  observation: string
  recommendation: string
  area: string
  added_at: string
}

export function AnalysisAgent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisData | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(new Set())
  const [reportCopied, setReportCopied] = useState(false)

  useEffect(() => {
    loadLatestAnalysis()
    loadTodos()
  }, [])

  // Restore dismissed insights from sessionStorage
  useEffect(() => {
    if (latestAnalysis?.run_id) {
      const saved = sessionStorage.getItem(`vetree_dismissed_insights_${latestAnalysis.run_id}`)
      if (saved) {
        setDismissedIndices(new Set(JSON.parse(saved)))
      }
    }
  }, [latestAnalysis?.run_id])

  // Persist dismissed insights to sessionStorage
  useEffect(() => {
    if (latestAnalysis?.run_id && dismissedIndices.size > 0) {
      sessionStorage.setItem(
        `vetree_dismissed_insights_${latestAnalysis.run_id}`,
        JSON.stringify([...dismissedIndices])
      )
    }
  }, [dismissedIndices, latestAnalysis?.run_id])

  const loadTodos = () => {
    const stored = localStorage.getItem('vetree_analysis_todos')
    if (stored) {
      setTodos(JSON.parse(stored))
    }
  }

  const saveTodos = (newTodos: Todo[]) => {
    localStorage.setItem('vetree_analysis_todos', JSON.stringify(newTodos))
    setTodos(newTodos)
  }

  const loadLatestAnalysis = async () => {
    try {
      const response = await fetch('/api/admin/analytics/latest-insights')
      if (response.ok) {
        const data = await response.json()
        setLatestAnalysis(data.analysis)
      }
    } catch (error) {
      console.error('Failed to load latest analysis:', error)
    }
  }

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/analytics/insights', {
        method: 'POST'
      })

      if (response.ok) {
        await loadLatestAnalysis()
      } else {
        const error = await response.json()
        alert(`Failed to run analysis: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to run analysis:', error)
      alert('Failed to run analysis')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (insight: Insight, index: number) => {
    if (!latestAnalysis) return

    // Save feedback to DB
    try {
      await fetch('/api/admin/analytics/insight-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight_id: latestAnalysis.id,
          insight_index: index,
          action: 'implemented'
        })
      })
    } catch (error) {
      console.error('Failed to save feedback:', error)
    }

    // Add to TODO list
    const newTodo: Todo = {
      insight_id: latestAnalysis.id,
      index,
      observation: insight.observation,
      recommendation: insight.recommendation,
      area: insight.area,
      added_at: new Date().toISOString()
    }

    saveTodos([...todos, newTodo])

    // Add to dismissed (remove from visible list)
    setDismissedIndices(prev => new Set([...prev, index]))

    // Generate and show action prompt
    const actionPrompt = `In the Vetree codebase, implement the following improvement:

INSIGHT: ${insight.observation}

ACTION REQUIRED: ${insight.recommendation}

Context: This is a Next.js app with Supabase backend.
Time budget: ${insight.time_to_implement}.
Please implement this change and commit.`

    setCurrentPrompt(actionPrompt)
    setShowPromptModal(true)
  }

  const handleReject = async (insight: Insight, index: number) => {
    if (rejectingIndex === index) {
      // Submit rejection
      if (!rejectReason.trim()) {
        alert('Please provide a reason')
        return
      }

      try {
        await fetch('/api/admin/analytics/insight-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            insight_id: latestAnalysis?.id,
            insight_index: index,
            action: 'ignored',
            note: rejectReason
          })
        })

        // Add to dismissed (remove from visible list)
        setDismissedIndices(prev => new Set([...prev, index]))
      } catch (error) {
        console.error('Failed to save feedback:', error)
      }

      setRejectingIndex(null)
      setRejectReason('')
    } else {
      // Show textarea
      setRejectingIndex(index)
    }
  }

  const completeTodo = async (todo: Todo) => {
    // Mark as implemented in DB
    try {
      await fetch('/api/admin/analytics/insight-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight_id: todo.insight_id,
          insight_index: todo.index,
          action: 'implemented'
        })
      })
    } catch (error) {
      console.error('Failed to mark as implemented:', error)
    }

    // Remove from localStorage
    saveTodos(todos.filter(t => t !== todo))
  }

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    alert('Prompt copied to clipboard!')
  }

  const getAreaColor = (area: string) => {
    const colors: Record<string, string> = {
      content: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      ux: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      growth: 'bg-green-500/10 text-green-600 border-green-500/20',
      retention: 'bg-red-500/10 text-red-600 border-red-500/20',
      feature: 'bg-purple-500/10 text-purple-600 border-purple-500/20'
    }
    return colors[area] || 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20'
  }

  const getImpactColor = (impact: string) => {
    const colors: Record<string, string> = {
      high: 'bg-green-500/10 text-green-700 dark:text-green-400',
      medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      low: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
    }
    return colors[impact] || colors.low
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2 flex items-center gap-2">
              🧠 Analysis Agent
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              AI-powered insights from your analytics data
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 text-white rounded-lg text-sm font-medium transition"
          >
            {loading ? 'Analyzing data...' : 'Run Analysis Now'}
          </button>
        </div>
      </div>

      {/* TODO List */}
      {todos.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
            📋 Implementation TODO List
          </h3>
          <div className="space-y-3">
            {todos.map((todo, index) => (
              <div key={index} className="bg-white dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAreaColor(todo.area)}`}>
                    {todo.area}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const prompt = `In the Vetree codebase, implement the following improvement:\n\nINSIGHT: ${todo.observation}\n\nACTION REQUIRED: ${todo.recommendation}\n\nContext: This is a Next.js app with Supabase backend.\nPlease implement this change and commit.`
                        copyPrompt(prompt)
                      }}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      Copy Prompt
                    </button>
                    <button
                      onClick={() => completeTodo(todo)}
                      className="text-green-600 hover:text-green-700 text-xs font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
                <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                  {todo.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 Actions */}
      {latestAnalysis && latestAnalysis.top_3_actions.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4">
            ⭐ Top 3 Actions This Week
          </h3>
          <div className="space-y-3">
            {latestAnalysis.top_3_actions.map((action, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <p className="text-green-900 dark:text-green-100 text-sm flex-1">
                  {action}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {latestAnalysis && latestAnalysis.insights_json.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Insights
          </h3>
          {latestAnalysis.insights_json
            .map((insight, originalIndex) => ({ insight, originalIndex }))
            .filter(({ originalIndex }) => !dismissedIndices.has(originalIndex))
            .map(({ insight, originalIndex }) => (
            <div
              key={originalIndex}
              className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getAreaColor(insight.area)}`}>
                    {insight.area}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getImpactColor(insight.impact)}`}>
                    {insight.impact} impact
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {insight.time_to_implement}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(insight, originalIndex)}
                    className="text-green-600 hover:text-green-700 text-lg font-bold"
                    title="Approve and add to TODO"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleReject(insight, originalIndex)}
                    className="text-zinc-400 hover:text-zinc-500 text-lg font-bold"
                    title="Reject"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-3">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Observation:</span> {insight.observation}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Why it matters:</span> {insight.why_it_matters}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  → {insight.recommendation}
                </p>
              </div>

              {/* Reject textarea */}
              {rejectingIndex === originalIndex && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Why isn't this relevant?"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-[#0F0F0F] text-zinc-900 dark:text-zinc-100"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(insight, originalIndex)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        setRejectingIndex(null)
                        setRejectReason('')
                      }}
                      className="px-3 py-1 bg-zinc-500 hover:bg-zinc-600 text-white rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Confidence bar */}
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Confidence:</span>
                  <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${insight.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {Math.round(insight.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Roadmap */}
      {latestAnalysis && (latestAnalysis.content_roadmap?.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            📚 Content Roadmap
          </h3>
          <div className="space-y-3">
            {latestAnalysis.content_roadmap.map((topic, index) => (
              <div key={index} className="flex items-center justify-between">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {topic}
                </p>
                <button
                  onClick={() => router.push(`/?q=${encodeURIComponent(topic)}&synthesize=true`)}
                  className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                >
                  Create Synthesis →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Churn Risks */}
      {latestAnalysis && latestAnalysis.churn_risks.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">
            ⚠️ Churn Risks
          </h3>
          <ul className="space-y-2">
            {latestAnalysis.churn_risks.map((risk, index) => (
              <li key={index} className="text-sm text-red-900 dark:text-red-100">
                • {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full Metrics Report */}
      {latestAnalysis?.report_markdown && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              📋 Full Metrics Report
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(latestAnalysis.report_markdown!)
                setReportCopied(true)
                setTimeout(() => setReportCopied(false), 2000)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {reportCopied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy Report
                </>
              )}
            </button>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
            Paste this into Claude.ai for a full strategic briefing
          </p>
          <pre className="text-zinc-700 dark:text-zinc-300 text-sm whitespace-pre-wrap font-mono bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
            {latestAnalysis.report_markdown}
          </pre>
        </div>
      )}

      {/* Empty state */}
      {!latestAnalysis && !loading && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            No analysis available yet. Click "Run Analysis Now" to generate insights.
          </p>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Implementation Prompt
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Here's a prompt to act on this insight:
            </p>
            <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg text-sm overflow-auto max-h-96 mb-4 whitespace-pre-wrap">
              {currentPrompt}
            </pre>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  copyPrompt(currentPrompt)
                  setShowPromptModal(false)
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                Copy Prompt
              </button>
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 bg-zinc-500 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
