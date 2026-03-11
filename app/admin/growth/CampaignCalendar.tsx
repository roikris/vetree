'use client'

import { useState, useEffect } from 'react'
import { getCurrentCampaignDay, getWeekSchedule, getTodaysPlatform, CAMPAIGN_TOTAL_DAYS } from '@/lib/growth-campaign'
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

export function CampaignCalendar() {
  const [todaysTask, setTodaysTask] = useState<Task | null>(null)
  const [generatedPost, setGeneratedPost] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const currentDay = getCurrentCampaignDay()
  const todaysPlatform = getTodaysPlatform()
  const weekSchedule = getWeekSchedule()

  useEffect(() => {
    loadTodaysTask()
    loadStats()
  }, [])

  const loadTodaysTask = async () => {
    // Try to get existing task
    const { task } = await getTodaysTask()

    if (task) {
      setTodaysTask(task)
      if (task.content) {
        setGeneratedPost(task.content)
      }
    } else {
      // Create today's task if it doesn't exist
      const { task: newTask } = await createTodaysTask(
        currentDay,
        todaysPlatform.platform,
        todaysPlatform.language
      )
      if (newTask) {
        setTodaysTask(newTask)
      }
    }
  }

  const loadStats = async () => {
    const { stats: campaignStats } = await getCampaignStats()
    if (campaignStats) {
      setStats(campaignStats)
    }
  }

  const handleGenerate = async () => {
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
      setMessage({ type: 'success', text: 'Post generated successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate post' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async () => {
    if (!todaysTask || !generatedPost) return

    setIsApproving(true)
    setMessage(null)

    try {
      const result = await markTaskComplete(todaysTask.id, generatedPost)

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({ type: 'success', text: '✅ Post approved and marked as done!' })
      await loadTodaysTask()
      await loadStats()
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve post' })
    } finally {
      setIsApproving(false)
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
    await loadTodaysTask()
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
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Today's Post
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Day {currentDay} - {todaysPlatform.name} ({todaysPlatform.language.toUpperCase()})
            </p>
          </div>
          <div className="text-4xl">
            {todaysPlatform.icon}
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            todaysTask?.status === 'done'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : generatedPost
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
            {todaysTask?.status === 'done' ? '✅ Done' : generatedPost ? '📝 Generated - Pending Approval' : '⏳ Not generated yet'}
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
          <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Generated Post:</div>
            <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-mono">
              {generatedPost}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {todaysTask?.status !== 'done' && (
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
                  <button
                    onClick={handleSkip}
                    className="px-4 py-3 bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Skip
                  </button>
                </>
              )}
            </>
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
