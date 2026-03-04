'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function DownloadFailedCSV() {
  const [isDownloading, setIsDownloading] = useState(false)
  const supabase = createClient()

  const handleDownload = async () => {
    setIsDownloading(true)

    try {
      // Fetch all articles where enrichment_attempts >= 3
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, pubmed_id, title, authors, source_journal, publication_date, doi, article_url, enrichment_attempts, created_at, needs_enrichment')
        .gte('enrichment_attempts', 3)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching failed articles:', error)
        alert('Failed to fetch articles. Please try again.')
        return
      }

      if (!articles || articles.length === 0) {
        alert('No failed enrichment articles found.')
        return
      }

      // Define CSV headers
      const headers = [
        'id',
        'pubmed_id',
        'title',
        'authors',
        'source_journal',
        'publication_date',
        'doi',
        'article_url',
        'enrichment_attempts',
        'created_at',
        'needs_enrichment'
      ]

      // Convert articles to CSV rows
      const rows = articles.map(article => {
        return headers.map(header => {
          const value = article[header as keyof typeof article]
          // Escape double quotes and wrap in quotes if contains comma or newline
          if (value === null || value === undefined) return ''
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }).join(',')
      })

      // Create CSV content
      const csv = [headers.join(','), ...rows].join('\n')

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `failed_enrichment_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error downloading CSV:', error)
      alert('An error occurred while downloading. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <span>⬇️</span>
      {isDownloading ? 'Downloading...' : 'Download CSV'}
    </button>
  )
}
