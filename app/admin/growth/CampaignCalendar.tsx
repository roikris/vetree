'use client'

import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { getCurrentCampaignDay, getWeekSchedule, getTodaysPlatform, CAMPAIGN_TOTAL_DAYS, PLATFORM_ROTATION } from '@/lib/growth-campaign'
import { getTodaysTask, createTodaysTask, markTaskComplete, getCampaignStats } from '@/app/actions/admin'

type Task = {
  id: string
  day_number: number
  scheduled_date: string
  platform: string
  language: string
  status: 'pending' | 'done' | 'skipped'
  content: string | null
  article_id: string | null
}

type CampaignStats = {
  totalDone: number
  streak: number
  platformsThisWeek: string[]
}

type SavedPost = {
  post_content: string
  article_id: string
  article_title?: string
  labels?: string[]
  platform: string
  language: string
  generated_at: string
}

export function CampaignCalendar() {
  const [todaysTask, setTodaysTask] = useState<Task | null>(null)
  const [generatedPost, setGeneratedPost] = useState<string | null>(null)
  const [savedPostData, setSavedPostData] = useState<SavedPost | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [approvedPosts, setApprovedPosts] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  const currentDay = getCurrentCampaignDay()
  const todaysPlatform = getTodaysPlatform()
  const weekSchedule = getWeekSchedule()
  const today = new Date().toISOString().split('T')[0]

  // Cleanup old localStorage keys (>3 days)
  const cleanupOldPosts = () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0]

    Object.keys(localStorage)
      .filter(k => k.startsWith('vetree_campaign_post_') || k.startsWith('vetree_campaign_approved_'))
      .filter(k => k < `vetree_campaign_post_${threeDaysAgoStr}` || k < `vetree_campaign_approved_${threeDaysAgoStr}`)
      .forEach(k => localStorage.removeItem(k))
  }

  // Load approved posts from localStorage
  const loadApprovedPosts = () => {
    console.log('[loadApprovedPosts] Loading approved posts from localStorage...')
    const approved: Record<string, boolean> = {}

    Object.keys(localStorage)
      .filter(k => k.startsWith('vetree_campaign_approved_'))
      .forEach(key => {
        const dateKey = key.replace('vetree_campaign_approved_', '')
        approved[dateKey] = localStorage.getItem(key) === 'true'
      })

    console.log('[loadApprovedPosts] Loaded approved posts:', approved)
    setApprovedPosts(approved)
  }

  // Mark post as approved in localStorage
  const markAsApproved = (dateKey: string) => {
    console.log('[markAsApproved] Marking post as approved:', dateKey)
    localStorage.setItem(`vetree_campaign_approved_${dateKey}`, 'true')
    setApprovedPosts(prev => ({ ...prev, [dateKey]: true }))
  }

  // Load saved post from localStorage for today
  const loadSavedPost = () => {
    const today = new Date().toISOString().split('T')[0]
    const saved = localStorage.getItem(`vetree_campaign_post_${today}`)

    if (saved) {
      try {
        const data: SavedPost = JSON.parse(saved)
        setGeneratedPost(data.post_content)
        setSavedPostData(data)
      } catch (e) {
        console.error('Failed to parse saved post', e)
      }
    }
  }

  // Save post to localStorage
  const savePostToStorage = (postData: SavedPost) => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(`vetree_campaign_post_${today}`, JSON.stringify(postData))
    setSavedPostData(postData)
  }

  // Clear today's saved post
  const clearSavedPost = () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.removeItem(`vetree_campaign_post_${today}`)
    setSavedPostData(null)
  }

  useEffect(() => {
    cleanupOldPosts()
    loadApprovedPosts()
    loadSavedPost()
    loadTodaysTask()
    loadStats()
  }, [])

  // Debug: Log whenever approvedPosts changes
  useEffect(() => {
    console.log('[CampaignCalendar] approvedPosts changed:', approvedPosts)
    console.log('[CampaignCalendar] today:', today)
    console.log('[CampaignCalendar] approvedPosts[today]:', approvedPosts[today])
  }, [approvedPosts, today])

  const loadTodaysTask = async () => {
    console.log('[loadTodaysTask] Checking for existing task...')
    console.log('[loadTodaysTask] Current day:', currentDay, 'Platform:', todaysPlatform)
    console.log('[loadTodaysTask] Today\'s date:', today)

    // Try to get existing task from DB (only for checking status)
    const { task } = await getTodaysTask()
    console.log('[loadTodaysTask] Received task from DB:', task)

    if (task) {
      console.log('[loadTodaysTask] Task found with status:', task.status)
      setTodaysTask(task)
      if (task.content) {
        setGeneratedPost(task.content)
      }
    } else {
      console.log('[loadTodaysTask] No task in DB - operating without DB persistence')
      // Don't create a task in DB - just use platform info from rotation
      // The task will be created only when the user approves the post
      setTodaysTask(null)
    }
  }

  const loadStats = async () => {
    const { stats: campaignStats } = await getCampaignStats()
    if (campaignStats) {
      setStats(campaignStats)
    }
  }

  const handleGenerate = async () => {
    if (!todaysPlatform?.platform || !todaysPlatform?.language) {
      setMessage({ type: 'error', text: 'Platform information not available' })
      return
    }

    setIsGenerating(true)
    setMessage(null)

    try {
      const response = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: todaysPlatform.platform,
          language: todaysPlatform.language
        })
      })

      const data = await response.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setGeneratedPost(data.post_content)

      // Save to localStorage
      const postData: SavedPost = {
        post_content: data.post_content,
        article_id: data.article_id,
        article_title: data.article_title,
        labels: data.article_labels,
        platform: todaysPlatform.platform,
        language: todaysPlatform.language,
        generated_at: new Date().toISOString()
      }
      savePostToStorage(postData)

      setMessage({ type: 'success', text: 'Post generated successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate post' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRedesign = async (platform: string, language: string) => {
    if (!savedPostData?.article_id) return

    setIsGenerating(true)
    setMessage(null)

    try {
      const response = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          language,
          article_id: savedPostData.article_id
        })
      })

      const data = await response.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setGeneratedPost(data.post_content)

      // Update localStorage with redesigned post
      const postData: SavedPost = {
        post_content: data.post_content,
        article_id: data.article_id,
        article_title: data.article_title,
        labels: data.article_labels,
        platform,
        language,
        generated_at: new Date().toISOString()
      }
      savePostToStorage(postData)

      setMessage({ type: 'success', text: `Post redesigned for ${platform}!` })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to redesign post' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async () => {
    // Only require generatedPost, not todaysTask
    if (!generatedPost) {
      console.log('[handleApprove] Missing generatedPost')
      return
    }

    console.log('[handleApprove] Starting approval. todaysTask:', todaysTask ? todaysTask.id : 'null')
    setIsApproving(true)
    setMessage(null)

    // Optimistic update: mark as approved immediately in localStorage
    markAsApproved(today)

    try {
      let taskId = todaysTask?.id

      // Create task if it doesn't exist yet
      if (!taskId && todaysPlatform?.platform && todaysPlatform?.language) {
        console.log('[handleApprove] Creating task for approval...')
        const { task: newTask, error: createError } = await createTodaysTask(
          currentDay,
          todaysPlatform.platform,
          todaysPlatform.language
        )

        if (createError || !newTask) {
          console.error('[handleApprove] Failed to create task:', createError)
          // Continue with localStorage-only approval
        } else {
          taskId = newTask.id
          setTodaysTask(newTask)
        }
      }

      // Update database if we have a task ID
      if (taskId) {
        const result = await markTaskComplete(taskId, generatedPost)
        console.log('[handleApprove] markTaskComplete result:', result)

        if (result.error) {
          console.error('[handleApprove] Error from markTaskComplete:', result.error)
          // Revert optimistic update on error
          localStorage.removeItem(`vetree_campaign_approved_${today}`)
          setApprovedPosts(prev => {
            const updated = { ...prev }
            delete updated[today]
            return updated
          })
          setMessage({ type: 'error', text: result.error })
          return
        }

        await loadTodaysTask()
        await loadStats()
      } else {
        console.log('[handleApprove] No task ID - localStorage-only approval')
      }

      console.log('[handleApprove] Success! Post approved.')
      setMessage({ type: 'success', text: '✅ Post approved and marked as done!' })
      clearSavedPost() // Clear localStorage on approve

    } catch (error) {
      console.error('[handleApprove] Exception caught:', error)
      // Revert optimistic update on error
      localStorage.removeItem(`vetree_campaign_approved_${today}`)
      setApprovedPosts(prev => {
        const updated = { ...prev }
        delete updated[today]
        return updated
      })
      setMessage({ type: 'error', text: 'Failed to approve post' })
    } finally {
      setIsApproving(false)
      console.log('[handleApprove] Finished approval flow')
    }
  }

  const handleSkip = async () => {
    if (!todaysTask) return

    const result = await markTaskComplete(todaysTask.id, 'SKIPPED')
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }

    setMessage({ type: 'success', text: 'Task skipped' })
    clearSavedPost() // Clear localStorage on skip
    await loadTodaysTask()
  }

  const handleCopy = async () => {
    if (!generatedPost) return

    await navigator.clipboard.writeText(generatedPost)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      facebook_il: '📘',
      facebook_intl: '📘',
      whatsapp: '💬',
      reddit: '🤖',
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸',
      telegram: '✈️'
    }
    return icons[platform] || '📱'
  }

  // Debug: Log render state
  console.log('[CampaignCalendar] Rendering with:', {
    today,
    approvedPostsForToday: approvedPosts[today],
    taskStatus: todaysTask?.status,
    hasGeneratedPost: !!generatedPost,
    shouldShowActions: !approvedPosts[today] && todaysTask?.status !== 'done'
  })

  return (
    <div className="space-y-6">
      {/* Campaign Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Campaign Progress</div>
            <div className="text-2xl font-bold text-[#3D7A5F] dark:text-[#4E9A78]">
              Day {currentDay}/{CAMPAIGN_TOTAL_DAYS}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Posts Published</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
              {stats.totalDone}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Current Streak</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">
              {stats.streak} days ✅
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Platforms This Week</div>
            <div className="text-lg">
              {stats.platformsThisWeek.map(p => getPlatformIcon(p)).join(' ')}
            </div>
          </div>
        </div>
      )}

      {/* Today's Task */}
      <div className={`bg-white dark:bg-[#1A1A1A] border-2 rounded-lg p-6 transition-colors ${
        approvedPosts[today] || todaysTask?.status === 'done'
          ? 'border-green-500 dark:border-green-600'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Today's Post
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Day {currentDay} - {todaysPlatform?.name ?? 'Campaign'} ({(todaysPlatform?.language ?? 'en').toUpperCase()})
            </p>
          </div>
          <div className="text-4xl">
            {todaysPlatform?.icon ?? '📱'}
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            approvedPosts[today] || todaysTask?.status === 'done'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : generatedPost
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
            {approvedPosts[today] || todaysTask?.status === 'done' ? '✅ Approved' : generatedPost ? '📝 Generated - Pending Approval' : '⏳ Not generated yet'}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Generated Post */}
        {generatedPost && (
          <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 relative">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Generated Post:</div>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 z-10 pointer-events-auto"
              title="Copy to clipboard"
              type="button"
            >
              {copied ? <Check size={16} className="text-green-500 dark:text-green-400" /> : <Copy size={16} />}
            </button>
            <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-mono pr-8">
              {generatedPost}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!approvedPosts[today] && (!todaysTask || todaysTask.status !== 'done') && (
            <>
              {!generatedPost ? (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isGenerating ? 'Generating...' : '✨ Generate Today\'s Post'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isApproving ? 'Approving...' : '✅ Approve & Mark Done'}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔄 Regenerate
                  </button>

                  {/* Redesign for platform dropdown */}
                  <div className="relative group">
                    <button
                      disabled={isGenerating || !savedPostData?.article_id}
                      className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      🔄 Redesign for...
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      {PLATFORM_ROTATION
                        .filter(p => p.platform !== todaysPlatform.platform)
                        .map(platform => (
                          <button
                            key={platform.platform}
                            onClick={() => handleRedesign(platform.platform, platform.language)}
                            disabled={isGenerating}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors first:rounded-t-lg last:rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="mr-2">{platform.icon}</span>
                            {platform.name}
                          </button>
                        ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSkip}
                    className="px-4 py-3 bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
                  >
                    ⏭ Skip
                  </button>
                </>
              )}
            </>
          )}
          {(approvedPosts[today] || (todaysTask && todaysTask.status === 'done')) && (
            <button
              disabled
              className="px-6 py-3 bg-green-600 text-white rounded-lg opacity-75 cursor-not-allowed font-medium"
            >
              ✅ Approved
            </button>
          )}
        </div>
      </div>

      {/* This Week's Schedule */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          This Week's Schedule
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekSchedule.map((day) => (
            <div
              key={day.dayNumber}
              className={`p-3 rounded-lg border-2 transition-colors ${
                day.isToday
                  ? 'border-[#3D7A5F] dark:border-[#4E9A78] bg-[#3D7A5F]/5 dark:bg-[#4E9A78]/5'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                Day {day.dayNumber}
              </div>
              <div className="text-2xl mb-1">{day.icon}</div>
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {day.name}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {day.language.toUpperCase()}
              </div>
              {day.isToday && (
                <div className="mt-2 text-xs font-semibold text-[#3D7A5F] dark:text-[#4E9A78]">
                  TODAY
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
