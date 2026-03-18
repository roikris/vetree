'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
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
  const [showRedesignMenu, setShowRedesignMenu] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [allPlatformPosts, setAllPlatformPosts] = useState<Record<string, any>>({})
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [activePlatformTab, setActivePlatformTab] = useState('')
  const [regenerating, setRegenerating] = useState(false)

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
    // Calculate stats from localStorage (source of truth)
    refreshStats()
  }, [])

  // Debug: Log whenever approvedPosts changes
  useEffect(() => {
    console.log('[CampaignCalendar] approvedPosts changed:', approvedPosts)
    console.log('[CampaignCalendar] today:', today)
    console.log('[CampaignCalendar] approvedPosts[today]:', approvedPosts[today])
  }, [approvedPosts, today])

  // Close redesign menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showRedesignMenu) {
        setShowRedesignMenu(false)
      }
    }

    if (showRedesignMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showRedesignMenu])

  // Load existing all-platform posts from localStorage on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const loaded: Record<string, any> = {}

    PLATFORM_ROTATION.forEach(({ platform }) => {
      const saved = localStorage.getItem(`vetree_campaign_post_${today}_${platform}`)
      if (saved) {
        try {
          loaded[platform] = JSON.parse(saved)
        } catch (e) {
          console.error(`Failed to parse saved post for ${platform}`)
        }
      }
    })

    if (Object.keys(loaded).length > 0) {
      setAllPlatformPosts(loaded)
      setShowAllPlatforms(true)
      setActivePlatformTab(todaysPlatform?.platform || '')
    }
  }, [])

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

  // Calculate stats from localStorage (source of truth for approvals)
  const refreshStats = () => {
    console.log('[refreshStats] Recalculating stats from localStorage...')

    // Count all approved posts from localStorage
    const approvedKeys = Object.keys(localStorage)
      .filter(k => k.startsWith('vetree_campaign_approved_'))
      .filter(k => localStorage.getItem(k) === 'true')

    const totalDone = approvedKeys.length
    console.log('[refreshStats] Total approved posts:', totalDone)

    // Calculate streak: consecutive days backwards from today
    let streak = 0
    const today = new Date()

    // Check each day going backwards from today
    for (let i = 0; i < 90; i++) { // Max 90 days (campaign length)
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const dateKey = checkDate.toISOString().split('T')[0]

      const isApproved = localStorage.getItem(`vetree_campaign_approved_${dateKey}`) === 'true'

      if (isApproved) {
        streak++
      } else if (i > 0) {
        // If we hit a day without approval (and it's not today), stop counting
        break
      }
      // If today isn't approved yet, keep checking backwards
    }

    console.log('[refreshStats] Current streak:', streak)

    // Get platforms from this week
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)

    const platformsThisWeek: string[] = []
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart)
      checkDate.setDate(checkDate.getDate() + i)
      const dateKey = checkDate.toISOString().split('T')[0]

      if (localStorage.getItem(`vetree_campaign_approved_${dateKey}`) === 'true') {
        // Get the platform for this day
        const savedPost = localStorage.getItem(`vetree_campaign_post_${dateKey}`)
        if (savedPost) {
          try {
            const data = JSON.parse(savedPost)
            if (data.platform && !platformsThisWeek.includes(data.platform)) {
              platformsThisWeek.push(data.platform)
            }
          } catch (e) {
            console.error('[refreshStats] Failed to parse saved post for', dateKey)
          }
        }
      }
    }

    console.log('[refreshStats] Platforms this week:', platformsThisWeek)

    setStats({
      totalDone,
      streak,
      platformsThisWeek
    })
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

      // Refresh stats from localStorage
      refreshStats()

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

  const handleRegenerate = async () => {
    const today = new Date().toISOString().split('T')[0]

    if (showAllPlatforms && activePlatformTab) {
      // Regenerate only the active platform's post
      setRegenerating(true)
      setMessage(null)

      try {
        // Find the platform details
        const platformInfo = PLATFORM_ROTATION.find(p => p.platform === activePlatformTab)
        if (!platformInfo) {
          setMessage({ type: 'error', text: 'Platform not found' })
          return
        }

        console.log(`[handleRegenerate] Regenerating ${activePlatformTab}...`)

        const response = await fetch('/api/growth/generate-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: platformInfo.platform,
            language: platformInfo.language
          })
        })

        const data = await response.json()

        if (data.error) {
          setMessage({ type: 'error', text: data.error })
          return
        }

        // Update the active platform's post
        const updatedPosts = {
          ...allPlatformPosts,
          [activePlatformTab]: data
        }
        setAllPlatformPosts(updatedPosts)

        // Save to localStorage
        localStorage.setItem(
          `vetree_campaign_post_${today}_${activePlatformTab}`,
          JSON.stringify(data)
        )

        // If this is today's platform, update the main post too
        if (activePlatformTab === todaysPlatform?.platform) {
          localStorage.setItem(
            `vetree_campaign_post_${today}`,
            JSON.stringify(data)
          )
          setGeneratedPost(data.post_content)
          setSavedPostData(data)
        }

        setMessage({ type: 'success', text: `✅ Regenerated ${platformInfo.name} post` })
        console.log(`[handleRegenerate] ✓ Regenerated ${activePlatformTab}`)

      } catch (error) {
        console.error('[handleRegenerate] Error:', error)
        setMessage({ type: 'error', text: 'Failed to regenerate post' })
      } finally {
        setRegenerating(false)
      }
    } else {
      // Single post regenerate - use existing handleGenerate
      handleGenerate()
    }
  }

  const handleSkip = async () => {
    const today = new Date().toISOString().split('T')[0]

    if (showAllPlatforms && activePlatformTab) {
      // Skip the active platform's post
      const postToSkip = allPlatformPosts[activePlatformTab]

      // Remove this platform's post from state
      const updated = { ...allPlatformPosts }
      delete updated[activePlatformTab]
      setAllPlatformPosts(updated)

      // Clear from localStorage
      localStorage.removeItem(`vetree_campaign_post_${today}_${activePlatformTab}`)

      // If this was the main today's platform, clear that too
      if (activePlatformTab === todaysPlatform?.platform) {
        localStorage.removeItem(`vetree_campaign_post_${today}`)
        setGeneratedPost('')
        setSavedPostData(null)
      }

      // Save to growth_agent_memory as skipped (don't await)
      if (postToSkip?.article_id) {
        fetch('/api/growth/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            article_id: postToSkip.article_id,
            platform: activePlatformTab,
            language: 'en',
            outcome: 'skipped'
          })
        }).catch(err => console.error('Failed to log skip:', err))
      }

      // Switch to next available platform
      const remaining = PLATFORM_ROTATION.filter(({ platform }) => updated[platform]).map(p => p.platform)
      if (remaining.length > 0) {
        setActivePlatformTab(remaining[0])
      } else {
        setShowAllPlatforms(false)
      }

      setMessage({ type: 'success', text: `Skipped ${activePlatformTab} post` })
    } else {
      // Single post skip - existing behavior
      if (!todaysTask) {
        // No DB task, just clear localStorage
        clearSavedPost()
        setGeneratedPost('')
        setSavedPostData(null)
        setMessage({ type: 'success', text: 'Post cleared' })
        return
      }

      const result = await markTaskComplete(todaysTask.id, 'SKIPPED')
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({ type: 'success', text: 'Task skipped' })
      clearSavedPost()
      await loadTodaysTask()
    }
  }

  const handleCopy = async () => {
    if (!generatedPost) return

    await navigator.clipboard.writeText(generatedPost)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const platformEmoji = (platform: string) => {
    const map: Record<string, string> = {
      facebook_il: '🇮🇱',
      facebook_intl: '🌍',
      whatsapp: '💬',
      reddit: '🤖',
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸',
      telegram: '✈️',
      tiktok: '🎵',
    }
    return map[platform] || '📱'
  }

  const handleGenerateAll = async () => {
    if (!todaysPlatform?.platform) {
      setMessage({ type: 'error', text: 'Platform information not available' })
      return
    }

    setGeneratingAll(true)
    setMessage(null)

    try {
      // Collect recent posts to help avoid repetition (last 7 days)
      const recentPosts: string[] = []
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date()
        checkDate.setDate(checkDate.getDate() - i)
        const dateKey = checkDate.toISOString().split('T')[0]
        const saved = localStorage.getItem(`vetree_campaign_post_${dateKey}`)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (parsed.post_content) {
              recentPosts.push(parsed.post_content.slice(0, 100))
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      console.log('[handleGenerateAll] Generating posts for all 8 platforms...')

      // STEP 1: Generate first post for today's platform to select article
      console.log('[handleGenerateAll] Step 1: Generate for today\'s platform to select article')
      const firstResponse = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: todaysPlatform.platform,
          language: todaysPlatform.language,
          recentPosts
        })
      })

      const firstData = await firstResponse.json()

      if (firstData.error || !firstData.article_id) {
        setMessage({ type: 'error', text: firstData.error || 'Failed to generate initial post' })
        setGeneratingAll(false)
        return
      }

      const sharedArticleId = firstData.article_id
      console.log('[handleGenerateAll] Selected article:', sharedArticleId)

      // Save first post
      const today = new Date().toISOString().split('T')[0]
      const allPosts: Record<string, any> = {
        [todaysPlatform.platform]: firstData
      }

      localStorage.setItem(
        `vetree_campaign_post_${today}_${todaysPlatform.platform}`,
        JSON.stringify(firstData)
      )

      // STEP 2: Generate remaining 7 platforms with same article_id
      console.log('[handleGenerateAll] Step 2: Generate remaining platforms with same article')
      const remainingPlatforms = PLATFORM_ROTATION.filter(
        ({ platform }) => platform !== todaysPlatform.platform
      )

      const results = await Promise.allSettled(
        remainingPlatforms.map(({ platform, language }) =>
          fetch('/api/growth/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform,
              language,
              recentPosts,
              article_id: sharedArticleId  // Force same article for all
            })
          })
          .then(r => r.json())
          .then(data => ({ platform, language, ...data }))
        )
      )

      // Save all results to localStorage
      let successCount = 1 // Already counted today's platform
      let errorCount = 0

      results.forEach((result, i) => {
        const platform = remainingPlatforms[i].platform

        if (result.status === 'fulfilled' && result.value.post_content) {
          allPosts[platform] = result.value

          // Save to localStorage with platform-specific key
          localStorage.setItem(
            `vetree_campaign_post_${today}_${platform}`,
            JSON.stringify(result.value)
          )
          successCount++
          console.log(`[handleGenerateAll] ✓ Generated ${platform}`)
        } else {
          errorCount++
          console.error(`[handleGenerateAll] ✗ Failed ${platform}:`, result)
        }
      })

      // Also save today's platform post as the main post
      localStorage.setItem(
        `vetree_campaign_post_${today}`,
        JSON.stringify(firstData)
      )
      setGeneratedPost(firstData.post_content)
      setSavedPostData(firstData)
      console.log('[handleGenerateAll] Set today\'s platform post:', todaysPlatform.platform)

      setAllPlatformPosts(allPosts)
      setShowAllPlatforms(true)
      setActivePlatformTab(todaysPlatform.platform)

      setMessage({
        type: 'success',
        text: `✅ Generated ${successCount}/8 posts${errorCount > 0 ? ` (${errorCount} failed)` : ''} — all using same article`
      })

    } catch (error) {
      console.error('[handleGenerateAll] Error:', error)
      setMessage({ type: 'error', text: 'Failed to generate posts' })
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleRegenerateAll = async () => {
    const today = new Date().toISOString().split('T')[0]

    // Clear all today's posts from localStorage
    PLATFORM_ROTATION.forEach(({ platform }) => {
      localStorage.removeItem(`vetree_campaign_post_${today}_${platform}`)
    })
    localStorage.removeItem(`vetree_campaign_post_${today}`)

    // Clear state
    setGeneratedPost('')
    setSavedPostData(null)
    setAllPlatformPosts({})
    setShowAllPlatforms(false)
    setActivePlatformTab('')

    // Now run Generate All (reuse existing handleGenerateAll)
    await handleGenerateAll()
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
      telegram: '✈️',
      tiktok: '🎵'
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
          <div className="mb-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Generated Post:</div>
              <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap font-mono">
                {generatedPost}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-md transition w-fit"
            >
              {copied ? <Check size={14} className="text-green-500 dark:text-green-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy post'}</span>
            </button>
          </div>
        )}

        {/* All Platforms Tabs */}
        {showAllPlatforms && Object.keys(allPlatformPosts).length > 0 && (
          <div className="mt-4 mb-4">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              All Platforms — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </h3>

            {/* Tab headers */}
            <div className="flex flex-wrap gap-1 mb-3">
              {PLATFORM_ROTATION.filter(({ platform }) => allPlatformPosts[platform]).map(({ platform, name }) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setActivePlatformTab(platform)}
                  className={`px-3 py-1 text-xs rounded-full transition ${
                    activePlatformTab === platform
                      ? 'bg-emerald-700 text-white'
                      : 'bg-zinc-700 dark:bg-zinc-800 text-zinc-300 hover:bg-zinc-600 dark:hover:bg-zinc-700'
                  }`}
                >
                  {platformEmoji(platform)} {name}
                </button>
              ))}
            </div>

            {/* Active tab content */}
            {activePlatformTab && allPlatformPosts[activePlatformTab] && (
              <div className="relative bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 border border-zinc-700 dark:border-zinc-800">
                <pre className="whitespace-pre-wrap text-sm font-mono text-zinc-200 dark:text-zinc-300 pr-8">
                  {allPlatformPosts[activePlatformTab].post_content}
                </pre>
                {/* Copy button */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(allPlatformPosts[activePlatformTab].post_content)
                    setMessage({ type: 'success', text: '✅ Copied to clipboard!' })
                    setTimeout(() => setMessage(null), 2000)
                  }}
                  className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-md transition"
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!approvedPosts[today] && (!todaysTask || todaysTask.status !== 'done') && (
            <>
              {!generatedPost ? (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || generatingAll}
                    className="px-6 py-3 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isGenerating ? 'Generating...' : '✨ Generate Today\'s Post'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAll}
                    disabled={generatingAll || isGenerating}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-md text-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingAll
                      ? <><Loader2 size={14} className="animate-spin" /> Generating all...</>
                      : '⚡ Generate All Platforms'}
                  </button>
                </>
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
                    onClick={handleRegenerate}
                    disabled={isGenerating || regenerating || generatingAll}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerating ? 'Regenerating...' : '🔄 Regenerate'}
                  </button>

                  {/* Regenerate All - only show when posts exist */}
                  {(generatedPost || Object.keys(allPlatformPosts).length > 0) && (
                    <button
                      type="button"
                      onClick={handleRegenerateAll}
                      disabled={generatingAll || isGenerating}
                      className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generatingAll
                        ? <><Loader2 size={14} className="animate-spin" /> Regenerating...</>
                        : '🔄 Regenerate All'}
                    </button>
                  )}

                  {/* Redesign for platform dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isGenerating && savedPostData?.article_id) {
                          setShowRedesignMenu(!showRedesignMenu)
                        }
                      }}
                      disabled={isGenerating || !savedPostData?.article_id}
                      className="px-4 py-3 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      🔄 Redesign for...
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {showRedesignMenu && (
                      <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50">
                        {PLATFORM_ROTATION
                          .filter(p => p.platform !== todaysPlatform.platform)
                          .map(platform => (
                            <button
                              key={platform.platform}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRedesign(platform.platform, platform.language)
                                setShowRedesignMenu(false)
                              }}
                              disabled={isGenerating}
                              className="w-full px-4 py-3 min-h-[44px] text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 active:bg-zinc-200 dark:active:bg-zinc-800 transition-colors first:rounded-t-lg last:rounded-b-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="mr-2">{platform.icon}</span>
                              {platform.name}
                            </button>
                          ))}
                      </div>
                    )}
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
