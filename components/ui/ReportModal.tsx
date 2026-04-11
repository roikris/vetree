'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

type ReportType = 'article_issue' | 'bug' | 'other'

type ReportModalProps = {
  isOpen: boolean
  onClose: () => void
  articleId?: string
  type?: ReportType
}

export function ReportModal({ isOpen, onClose, articleId, type = 'article_issue' }: ReportModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [issueType, setIssueType] = useState<'incorrect_info' | 'missing_data' | 'other'>('incorrect_info')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      router.push('/login')
      return
    }

    setLoading(true)
    setError(null)

    // Build description with issue type for article issues
    let fullDescription = description
    if (type === 'article_issue') {
      const issueTypeLabel = {
        incorrect_info: 'Incorrect information',
        missing_data: 'Missing data',
        other: 'Other'
      }[issueType]
      fullDescription = `[${issueTypeLabel}] ${description}`
    }

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, articleId, description: fullDescription }),
    })
    const result = await res.json()

    setLoading(false)

    if (!res.ok || result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setDescription('')
        setError(null)
      }, 2000)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      setDescription('')
      setError(null)
      setSuccess(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-[#1A1A1A] rounded-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✓</div>
            <h3 className="text-xl font-semibold text-[#3D7A5F] dark:text-[#4E9A78] mb-2">
              Thank you!
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              We'll review this shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                {type === 'bug' ? 'Report a Bug' : 'Report Issue'}
              </h3>
              <button
                onClick={handleClose}
                disabled={loading}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {type === 'article_issue' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                    What's the issue?
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78]"
                  >
                    <option value="incorrect_info">Incorrect information</option>
                    <option value="missing_data">Missing data</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder={type === 'bug' ? 'Describe the bug you encountered...' : 'Please provide details about the issue...'}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 rounded-lg text-[#1A1A1A] dark:text-[#E8E8E8] focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-200 dark:border-zinc-800 text-[#1A1A1A] dark:text-[#E8E8E8] font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !description.trim()}
                  className="flex-1 px-4 py-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white font-medium rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
