'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type SkippedArticle = {
  id: string
  sync_run_at: string
  pubmed_id: string | null
  title: string | null
  article_url: string | null
  reason: 'blacklisted' | 'no_abstract' | 'already_exists' | 'other'
  journal: string | null
}

type Tab = 'all' | 'blacklisted' | 'no_abstract' | 'other'

const REASON_BADGE: Record<string, { label: string; className: string }> = {
  blacklisted:   { label: 'Blacklisted',  className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  no_abstract:   { label: 'No Abstract',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  already_exists:{ label: 'Duplicate',    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  other:         { label: 'Other',        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
}

export function SyncSkippedArticles() {
  const [articles, setArticles] = useState<SkippedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [latestRunTime, setLatestRunTime] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [clearMsg, setClearMsg] = useState<string | null>(null)

  const fetchSkipped = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Find the latest run time
    const { data: latest } = await supabase
      .from('sync_skipped_articles')
      .select('sync_run_at')
      .order('sync_run_at', { ascending: false })
      .limit(1)
      .single()

    if (!latest) {
      setArticles([])
      setLoading(false)
      return
    }

    setLatestRunTime(latest.sync_run_at)

    const { data } = await supabase
      .from('sync_skipped_articles')
      .select('*')
      .gte('sync_run_at', latest.sync_run_at)
      .order('reason', { ascending: true })

    setArticles(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSkipped() }, [fetchSkipped])

  const handleClearOld = async () => {
    setClearing(true)
    setClearMsg(null)
    const supabase = createClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('sync_skipped_articles')
      .delete()
      .lt('sync_run_at', thirtyDaysAgo)
    setClearMsg(error ? 'Failed to clear old records.' : 'Old records cleared.')
    setClearing(false)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',         label: `All (${articles.length})` },
    { key: 'blacklisted', label: `Blacklisted (${articles.filter(a => a.reason === 'blacklisted').length})` },
    { key: 'no_abstract', label: `No Abstract (${articles.filter(a => a.reason === 'no_abstract').length})` },
    { key: 'other',       label: `Other (${articles.filter(a => a.reason !== 'blacklisted' && a.reason !== 'no_abstract').length})` },
  ]

  const filtered = activeTab === 'all'
    ? articles
    : activeTab === 'other'
      ? articles.filter(a => a.reason !== 'blacklisted' && a.reason !== 'no_abstract')
      : articles.filter(a => a.reason === activeTab)

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Last Sync — Skipped Articles
          </h2>
          {latestRunTime && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Run: {new Date(latestRunTime).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {clearMsg && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{clearMsg}</span>
          )}
          <button
            onClick={handleClearOld}
            disabled={clearing}
            className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg transition-colors disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear records > 30 days'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-700">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#3D7A5F] text-[#3D7A5F] dark:border-[#4E9A78] dark:text-[#4E9A78]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-zinc-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-zinc-400 text-sm">
          {articles.length === 0 ? 'No skipped articles recorded yet. Data appears after the next daily sync.' : 'None in this category.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Journal</th>
                <th className="pb-2 pr-4 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map(a => {
                const badge = REASON_BADGE[a.reason] || REASON_BADGE.other
                const url = a.article_url || (a.pubmed_id ? `https://pubmed.ncbi.nlm.nih.gov/${a.pubmed_id}/` : '#')
                return (
                  <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="py-2 pr-4 max-w-xs">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3D7A5F] dark:text-[#4E9A78] hover:underline line-clamp-2"
                      >
                        {a.title || `PMID: ${a.pubmed_id}`}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {a.journal || '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
