'use client'

import { useState, useEffect } from 'react'

type GeneratedPost = {
  post_content: string
  article_id: string
  article_title: string
  article_labels: string[]
  hook_line: string
  article_url: string
  source_journal: string
}

type AgentStats = {
  approved_count: number
  skipped_count: number
  preferred_specialties: string[]
  avoided_specialties: string[]
  unique_articles_count: number
}

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter 🐦' },
  { value: 'facebook_il', label: 'Facebook IL 📘' },
  { value: 'facebook_intl', label: 'Facebook International 📘' },
  { value: 'instagram', label: 'Instagram 📸' },
  { value: 'reddit', label: 'Reddit 🤖' },
  { value: 'telegram', label: 'Telegram ✈️' },
  { value: 'whatsapp', label: 'WhatsApp 💬' },
  { value: 'linkedin', label: 'LinkedIn 💼' },
]

const SKIP_REASONS = [
  'Not relevant specialty',
  'Too generic',
  'Already covered this topic',
  'Wrong audience',
  'Wrong tone',
  'Other'
]

export function ContentAgent() {
  const [platform, setPlatform] = useState('twitter')
  const [language, setLanguage] = useState<'he' | 'en'>('en')
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [showSkipModal, setShowSkipModal] = useState(false)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Fetch preferences
      const prefsResponse = await fetch('/api/growth/stats')
      if (prefsResponse.ok) {
        const data = await prefsResponse.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const generatePost = async (skipReason?: string) => {
    setIsLoading(true)
    setError(null)
    setIsEditing(false)

    try {
      const response = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          language,
          skip_reason: skipReason
        })
      })

      console.log('[ContentAgent] Response status:', response.status, response.statusText)
      console.log('[ContentAgent] Response URL:', response.url)

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response isn't JSON, use status text
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setGeneratedPost(data)
      setEditedContent(data.post_content)
    } catch (error) {
      console.error('Error generating post:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate post')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!generatedPost) return

    try {
      await fetch('/api/growth/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: generatedPost.article_id,
          outcome: 'approved',
          hook_line: generatedPost.hook_line,
          platform,
          language,
          article_labels: generatedPost.article_labels
        })
      })

      // Copy to clipboard
      await navigator.clipboard.writeText(isEditing ? editedContent : generatedPost.post_content)

      // Reload stats
      loadStats()

      // Show success message
      alert('✅ Post approved and copied to clipboard!')

      // Generate new post
      generatePost()
    } catch (error) {
      console.error('Error approving post:', error)
      alert('Failed to approve post')
    }
  }

  const handleSkip = async (reason: string) => {
    if (!generatedPost) return

    setShowSkipModal(false)

    try {
      await fetch('/api/growth/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: generatedPost.article_id,
          outcome: 'skipped',
          skip_reason: reason,
          hook_line: generatedPost.hook_line,
          platform,
          language,
          article_labels: generatedPost.article_labels
        })
      })

      // Reload stats
      loadStats()

      // Immediately generate new post
      generatePost(reason)
    } catch (error) {
      console.error('Error skipping post:', error)
      alert('Failed to skip post')
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Generate Content
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Platform Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'he' | 'en')}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              <option value="en">🇺🇸 English</option>
              <option value="he">🇮🇱 Hebrew</option>
            </select>
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <button
              onClick={() => generatePost()}
              disabled={isLoading}
              className="w-full px-6 py-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : '✨ Generate Post'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Generated Post */}
      {generatedPost && (
        <div className="bg-white dark:bg-[#1A1A1A] border-2 border-[#3D7A5F] dark:border-[#4E9A78] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Generated Post
            </h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:underline"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {/* Post Content */}
          <div className="mb-4">
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-sm min-h-[200px]"
                dir={language === 'he' ? 'rtl' : 'ltr'}
              />
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                <pre
                  className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans"
                  dir={language === 'he' ? 'rtl' : 'ltr'}
                >
                  {generatedPost.post_content}
                </pre>
              </div>
            )}
          </div>

          {/* Article Info */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm">
              <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                📄 {generatedPost.article_title}
              </div>
              {generatedPost.source_journal && (
                <div className="text-blue-700 dark:text-blue-300 text-xs mb-2">
                  {generatedPost.source_journal}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-2">
                {generatedPost.article_labels.slice(0, 5).map((label, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <a
                href={`https://${generatedPost.article_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >
                🔗 {generatedPost.article_url}
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition-colors font-medium"
            >
              ✅ Approve & Copy
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              className="px-6 py-2 bg-amber-500 dark:bg-amber-600 text-white rounded-lg hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors font-medium"
            >
              ⏭ Skip
            </button>
            {isEditing && (
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditedContent(generatedPost.post_content)
                }}
                className="px-6 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Agent Stats */}
      {stats && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            🤖 Agent Learning Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                {stats.approved_count}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Approved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                {stats.skipped_count}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                {stats.unique_articles_count}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Articles Used</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                {stats.preferred_specialties.length}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Specialties Learned</div>
            </div>
          </div>

          {stats.preferred_specialties.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Preferred Specialties:
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.preferred_specialties.slice(0, 10).map((spec, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.avoided_specialties.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Avoided Specialties:
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.avoided_specialties.slice(0, 10).map((spec, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip Modal */}
      {showSkipModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSkipModal(false)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Why are you skipping this post?
            </h3>
            <div className="space-y-2">
              {SKIP_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleSkip(reason)}
                  className="w-full px-4 py-2 text-left bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSkipModal(false)}
              className="mt-4 w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
