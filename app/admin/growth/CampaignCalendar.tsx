'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { getCurrentCampaignDay, getWeekSchedule, getTodaysPlatform, CAMPAIGN_TOTAL_DAYS, PLATFORM_ROTATION } from '@/lib/growth-campaign'
import { getTodaysTask, createTodaysTask, markTaskComplete, getCampaignStats } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

const STYLE_PROMPTS: Record<string, string> = {
  factual: 'Rewrite this post to be more factual and precise. Stay extremely close to what the study actually found. Remove any interpretive language.',
  engaging: 'Rewrite this post to be more engaging and compelling for a veterinary professional audience. Keep all facts accurate.',
  concise: 'Rewrite this post to be 30% shorter while keeping the key clinical finding.',
  clinical: 'Rewrite this post with more clinical terminology appropriate for specialist DVMs.',
}

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
  const [markedPosted, setMarkedPosted] = useState(false)
  const [memoryWriteFailed, setMemoryWriteFailed] = useState(false)
  const [linkedinTabMarked, setLinkedinTabMarked] = useState(false)
  const [linkedinTabPostedUrl, setLinkedinTabPostedUrl] = useState('')
  const [linkedinTabSavedUrl, setLinkedinTabSavedUrl] = useState<string | null>(null)
  const [linkedinTabSavingUrl, setLinkedinTabSavingUrl] = useState(false)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [approvedPosts, setApprovedPosts] = useState<Record<string, boolean>>({})
  const [postedUrl, setPostedUrl] = useState('')
  const [savedPostedUrl, setSavedPostedUrl] = useState<string | null>(null)
  const [savingPostedUrl, setSavingPostedUrl] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showRedesignMenu, setShowRedesignMenu] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [allPlatformPosts, setAllPlatformPosts] = useState<Record<string, any>>({})
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [activePlatformTab, setActivePlatformTab] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [failedPlatforms, setFailedPlatforms] = useState<string[]>([])
  const [articleSearch, setArticleSearch] = useState('')
  const [articleResults, setArticleResults] = useState<any[]>([])
  const [selectedArticle, setSelectedArticle] = useState<{id: string, title: string} | null>(null)
  const [manualSelectionLocked, setManualSelectionLocked] = useState(false)
  const [generatingAllForArticle, setGeneratingAllForArticle] = useState<{id: string, title: string} | null>(null)
  const [articleExclusionNote, setArticleExclusionNote] = useState<string | null>(null)
  const [showArticleDropdown, setShowArticleDropdown] = useState(false)
  const [rewritingPlatform, setRewritingPlatform] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({})
  const [photoArticle, setPhotoArticle] = useState<{summary?: string, clinical_bottom_line?: string} | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [insights, setInsights] = useState<any>(null)

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

  // Close article dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showArticleDropdown) {
        setShowArticleDropdown(false)
      }
    }

    if (showArticleDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showArticleDropdown])

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

  // Load AI-powered article recommendations
  const loadRecommendations = async () => {
    setLoadingRecs(true)
    try {
      const res = await fetch('/api/admin/growth/recommendations')
      const data = await res.json()
      setRecommendations(data.recommendations || [])
      setInsights(data.insights || null)
      setShowRecommendations(true)
    } catch (e) {
      console.error('[recommendations] Failed:', e)
    } finally {
      setLoadingRecs(false)
    }
  }

  // Dismiss a recommendation permanently (irrelevant or already_published)
  const dismissRecommendation = async (articleId: string, outcome: 'irrelevant' | 'already_published') => {
    // Optimistic: remove from list immediately
    setRecommendations(prev => prev.filter(a => a.id !== articleId))
    try {
      await fetch('/api/admin/growth/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, outcome }),
      })
    } catch (e) {
      console.error('[recommendations] dismiss failed:', e)
    }
  }

  // Search articles (debounced)
  const searchArticles = async (query: string) => {
    if (query.length < 3) {
      setArticleResults([])
      setShowArticleDropdown(false)
      return
    }

    try {
      const res = await fetch(`/api/articles/search-quick?q=${encodeURIComponent(query)}&limit=5`)
      const data = await res.json()
      setArticleResults(data.articles || [])
      setShowArticleDropdown(true)
    } catch (error) {
      console.error('[searchArticles] Error:', error)
      setArticleResults([])
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
      console.log('[handleGenerate] selectedArticle:', selectedArticle?.id, selectedArticle?.title?.slice(0, 60))
      const response = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: todaysPlatform.platform,
          language: todaysPlatform.language,
          article_id: selectedArticle?.id || undefined
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        setMessage({ type: 'error', text: data.error || `Server error ${response.status}` })
        return
      }

      // Echo-assertion: if we forced an article, the server must echo back the same ID
      if (selectedArticle?.id && data.article_id && data.article_id !== selectedArticle.id) {
        console.error('[handleGenerate] MISMATCH — sent:', selectedArticle.id, 'got:', data.article_id)
        setMessage({ type: 'error', text: `Generated for wrong article — expected "${selectedArticle.title}" but got "${data.article_title}". Please retry.` })
        return
      }

      setGeneratedPost(data.post_content)

      // Soft-inform: if the generated article has normally-excluded labels, show a notice
      const NORMALLY_EXCLUDED = ['Equine', 'equine', 'Large Animal', 'large animal', 'Livestock', 'livestock', 'Poultry', 'poultry', 'Food Animal', 'food animal']
      const excludedLabels = (data.article_labels || []).filter((l: string) => NORMALLY_EXCLUDED.includes(l))
      setArticleExclusionNote(excludedLabels.length > 0 ? `Labeled: ${excludedLabels.join(', ')} — normally excluded from auto-rotation` : null)

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

  // Copy post text to clipboard AND write memory row + mark approved in one action.
  // savedPostData is intentionally NOT cleared here so the URL input that follows
  // can read article_id from it. clearSavedPost() is called after URL is saved.
  const handleCopyAndMark = async () => {
    if (!generatedPost || !savedPostData?.article_id) return

    await navigator.clipboard.writeText(generatedPost)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    // Extract hook line (first non-empty line) for slug matching later
    const hookLine = generatedPost.split('\n').find(l => l.trim()) ?? undefined

    // Write memory row with hook_line — must succeed before marking posted
    const ok = await recordToMemory(savedPostData.article_id, todaysPlatform?.platform || '', 'approved', undefined, hookLine)
    if (!ok) {
      setMemoryWriteFailed(true)
      return
    }

    markAsApproved(today)
    setMarkedPosted(true)
    setMemoryWriteFailed(false)
    refreshStats()

    // Update growth_tasks in background (non-blocking)
    ;(async () => {
      let taskId = todaysTask?.id
      if (!taskId && todaysPlatform?.platform && todaysPlatform?.language) {
        const { task: newTask } = await createTodaysTask(currentDay, todaysPlatform.platform, todaysPlatform.language)
        if (newTask) { taskId = newTask.id; setTodaysTask(newTask) }
      }
      if (taskId) {
        await markTaskComplete(taskId, generatedPost)
        await loadTodaysTask()
        await loadStats()
      }
    })()
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

      // Record skip to growth_agent_memory
      if (postToSkip?.article_id) {
        recordToMemory(postToSkip.article_id, activePlatformTab, 'skipped')
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
      // Single post skip
      if (!todaysTask) {
        // Record skip to growth_agent_memory (non-blocking)
        if (savedPostData?.article_id) {
          recordToMemory(savedPostData.article_id, todaysPlatform?.platform || '', 'skipped')
        }
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

      // Record skip to growth_agent_memory
      if (savedPostData?.article_id) {
        recordToMemory(savedPostData.article_id, todaysPlatform?.platform || '', 'skipped')
      }

      setMessage({ type: 'success', text: 'Task skipped' })
      clearSavedPost()
      await loadTodaysTask()
    }
  }

  // Copy for all-platforms tab view; marks posted when it's the LinkedIn tab.
  const handleCopyPlatformTab = async (platform: string) => {
    const post = allPlatformPosts[platform]
    if (!post) return
    await navigator.clipboard.writeText(post.post_content)
    setMessage({ type: 'success', text: '✅ Copied to clipboard!' })
    setTimeout(() => setMessage(null), 2000)
    if (platform === 'linkedin' && post.article_id) {
      const hookLine = (post.post_content as string).split('\n').find((l: string) => l.trim()) ?? undefined
      const ok = await recordToMemory(post.article_id, 'linkedin', 'approved', undefined, hookLine)
      if (!ok) {
        setMessage({ type: 'error', text: '⚠️ Memory write failed — try again' })
        return
      }
      markAsApproved(today)
      setLinkedinTabMarked(true)
      refreshStats()
    }
  }

  // Save URL for the LinkedIn tab (all-platforms view). article_id comes from
  // allPlatformPosts rather than savedPostData, so this is independent of todaysPlatform.
  const handleSaveLinkedinTabUrl = async (url?: string) => {
    const urlToSave = url ?? linkedinTabPostedUrl
    const articleId = allPlatformPosts['linkedin']?.article_id
    if (!urlToSave.trim() || !articleId) return
    setLinkedinTabSavingUrl(true)
    try {
      const res = await fetch('/api/admin/growth/memory/posted-url', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          platform: 'linkedin',
          date: today,
          posted_url: urlToSave.trim(),
        }),
      })
      if (res.ok) {
        setLinkedinTabSavedUrl(urlToSave.trim())
        setLinkedinTabPostedUrl('')
      }
    } catch {
      // non-blocking
    } finally {
      setLinkedinTabSavingUrl(false)
    }
  }

  const platformEmoji = (platform: string) => {
    const map: Record<string, string> = {
      facebook_il: '🇮🇱',
      facebook_intl: '🌍',
      whatsapp: '💬',
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸',
      telegram: '✈️',
    }
    return map[platform] || '📱'
  }

  const handleGenerateAll = async () => {
    if (!todaysPlatform?.platform) {
      setMessage({ type: 'error', text: 'Platform information not available' })
      return
    }

    // ─── ONE article, chosen once ─────────────────────────────────────────────
    // Snapshot the selection at call time. Explicit manual selection wins;
    // server picks randomly only when no selection exists.
    const lockedArticle = selectedArticle  // null = let server pick
    console.log('[handleGenerateAll] Locked article:', lockedArticle?.id ?? '(server will pick)')
    setGeneratingAllForArticle(lockedArticle)  // pre-flight indicator in UI
    // ─────────────────────────────────────────────────────────────────────────

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

      console.log('[handleGenerateAll] Generating posts for all platforms...')

      // STEP 1: Generate first post for today's platform to lock the article
      // Retry up to 3 times if we get SKIP_LARGE_ANIMAL
      console.log('[handleGenerateAll] Step 1: Generate for today\'s platform to lock article')
      let firstData = null
      let attempts = 0

      while (attempts < 3) {
        const firstResponse = await fetch('/api/growth/generate-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: todaysPlatform.platform,
            language: todaysPlatform.language,
            recentPosts,
            article_id: lockedArticle?.id || undefined  // use snapshot, not live state
          })
        })

        const data = await firstResponse.json()

        // 4xx from server = actionable error (not found, excluded) — surface immediately, don't retry
        if (!firstResponse.ok && firstResponse.status >= 400 && firstResponse.status < 500) {
          setMessage({ type: 'error', text: data.error || `Server error ${firstResponse.status}` })
          setGeneratingAllForArticle(null)
          setGeneratingAll(false)
          return
        }

        if (data.post_content && !data.post_content.includes('SKIP_LARGE_ANIMAL') && data.article_id) {
          firstData = data
          break
        }

        attempts++
        console.log(`[handleGenerateAll] Attempt ${attempts} failed, retrying...`)
      }

      if (!firstData) {
        setMessage({ type: 'error', text: 'Could not find suitable article after 3 attempts' })
        setGeneratingAllForArticle(null)
        setGeneratingAll(false)
        return
      }

      // Echo-assert Step 1: server must echo back the article we forced (if any)
      if (lockedArticle?.id && firstData.article_id !== lockedArticle.id) {
        console.error('[handleGenerateAll] Step 1 MISMATCH — sent:', lockedArticle.id, 'got:', firstData.article_id)
        setMessage({ type: 'error', text: `Generated for wrong article — expected "${lockedArticle.title}" but got "${firstData.article_title}". Please retry.` })
        setGeneratingAllForArticle(null)
        setGeneratingAll(false)
        return
      }

      const sharedArticleId = firstData.article_id
      const sharedArticleTitle = firstData.article_title ?? sharedArticleId
      console.log('[handleGenerateAll] Confirmed article:', sharedArticleId, sharedArticleTitle?.slice(0, 60))

      // Update header to server-confirmed article (covers the "server picks" case)
      setGeneratingAllForArticle({ id: sharedArticleId, title: sharedArticleTitle })

      // Save first post
      const today = new Date().toISOString().split('T')[0]
      const allPosts: Record<string, any> = {
        [todaysPlatform.platform]: firstData
      }

      localStorage.setItem(
        `vetree_campaign_post_${today}_${todaysPlatform.platform}`,
        JSON.stringify(firstData)
      )

      // STEP 2: Generate remaining platforms with the SAME sharedArticleId
      // Use batching to avoid rate limits - 3 platforms at a time with 500ms delay
      console.log('[handleGenerateAll] Step 2: Generate remaining platforms for', sharedArticleId)
      const remainingPlatforms = PLATFORM_ROTATION.filter(
        ({ platform }) => platform !== todaysPlatform.platform
      )

      // Helper: generate for one platform with retry and per-platform echo-assertion
      const generateForPlatform = async (platformInfo: any, articleId: string, recentPostsList: string[]) => {
        const makeRequest = () => fetch('/api/growth/generate-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: platformInfo.platform,
            language: platformInfo.language,
            recentPosts: recentPostsList,
            article_id: articleId  // always the shared snapshot
          })
        })

        try {
          const data = await (await makeRequest()).json()

          if (!data.post_content || data.post_content.includes('SKIP_LARGE_ANIMAL')) {
            throw new Error('Invalid post content')
          }
          // Per-platform echo-assertion
          if (data.article_id && data.article_id !== articleId) {
            console.error(`[handleGenerateAll] ${platformInfo.platform} MISMATCH — sent:`, articleId, 'got:', data.article_id)
            throw new Error(`Article mismatch on ${platformInfo.platform}`)
          }

          return { platform: platformInfo.platform, language: platformInfo.language, ...data }
        } catch (error) {
          // Retry once after 1 second delay
          console.log(`[handleGenerateAll] Retrying ${platformInfo.platform} after error`)
          await new Promise(r => setTimeout(r, 1000))

          const data = await (await makeRequest()).json()
          if (data.article_id && data.article_id !== articleId) {
            throw new Error(`Article mismatch on ${platformInfo.platform} (retry)`)
          }
          return { platform: platformInfo.platform, language: platformInfo.language, ...data }
        }
      }

      // Process platforms in batches of 3 to avoid rate limits
      const batches = [
        remainingPlatforms.slice(0, 3),
        remainingPlatforms.slice(3, 6),
        remainingPlatforms.slice(6)
      ]

      const allResults = []
      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(platformInfo => generateForPlatform(platformInfo, sharedArticleId, recentPosts))
        )
        allResults.push(...batchResults)

        // Add delay between batches (except after last batch)
        if (batch !== batches[batches.length - 1]) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      const results = allResults

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

      // Track which platforms failed for retry button
      const failed = PLATFORM_ROTATION.filter(p => !allPosts[p.platform]).map(p => p.platform)
      setFailedPlatforms(failed)

      setMessage({
        type: 'success',
        text: `✅ Generated ${successCount}/${PLATFORM_ROTATION.length} posts${errorCount > 0 ? ` (${errorCount} failed)` : ''} — all using same article`
      })

    } catch (error) {
      console.error('[handleGenerateAll] Error:', error)
      setMessage({ type: 'error', text: 'Failed to generate posts' })
      setGeneratingAllForArticle(null)
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
    setFailedPlatforms([])
    setGeneratingAllForArticle(null)  // reset so pre-flight shows fresh snapshot

    // Now run Generate All (reuse existing handleGenerateAll)
    await handleGenerateAll()
  }

  const handleRetryFailed = async () => {
    if (failedPlatforms.length === 0) return

    setGeneratingAll(true)
    setMessage(null)

    try {
      // Get the article_id from an existing successful post
      const existingPost = Object.values(allPlatformPosts)[0] as any
      console.log('[handleRetryFailed] existingPost keys:', existingPost ? Object.keys(existingPost) : 'null')

      // Try all possible nesting paths for article_id
      const sharedArticleId =
        existingPost?.article_id ||
        existingPost?.data?.article_id ||
        existingPost?.post?.article_id

      console.log('[handleRetryFailed] Resolved article_id:', sharedArticleId)

      if (!sharedArticleId) {
        setMessage({ type: 'error', text: 'Could not find article ID from existing posts' })
        setGeneratingAll(false)
        return
      }

      console.log('[handleRetryFailed] Retrying failed platforms with article:', sharedArticleId)

      // Collect recent posts for context
      const recentPosts = PLATFORM_ROTATION
        .filter(p => allPlatformPosts[p.platform])
        .map(p => (allPlatformPosts[p.platform] as any).post_content?.slice(0, 100))

      // Helper function to generate for a platform with retry logic
      const generateForPlatform = async (platform: string, articleId: string, recentPostsList: string[]) => {
        const platformInfo = PLATFORM_ROTATION.find(p => p.platform === platform)
        if (!platformInfo) throw new Error(`Platform ${platform} not found`)

        console.log('[retry] Attempting platform:', platform)
        console.log('[retry] Using article_id:', articleId)

        try {
          const res = await fetch('/api/growth/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: platformInfo.platform,
              language: platformInfo.language,
              recentPosts: recentPostsList,
              article_id: articleId
            })
          })
          const data = await res.json()
          console.log('[retry] Response for', platform, ':', data.post_content ? '✓ has content' : `✗ error: ${data.error}`)

          if (!data.post_content || data.post_content.includes('SKIP_LARGE_ANIMAL')) {
            throw new Error(data.error || 'Invalid post content')
          }

          return { platform: platformInfo.platform, language: platformInfo.language, ...data }
        } catch (error) {
          // Retry once after 1 second delay
          console.log(`[retry] Retrying ${platformInfo.platform} after error:`, error)
          await new Promise(r => setTimeout(r, 1000))

          const res = await fetch('/api/growth/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: platformInfo.platform,
              language: platformInfo.language,
              recentPosts: recentPostsList,
              article_id: articleId
            })
          })
          const data = await res.json()
          console.log('[retry] Retry response for', platform, ':', data.post_content ? '✓ has content' : `✗ error: ${data.error}`)
          return { platform: platformInfo.platform, language: platformInfo.language, ...data }
        }
      }

      // Retry in batches of 3
      const batches = []
      for (let i = 0; i < failedPlatforms.length; i += 3) {
        batches.push(failedPlatforms.slice(i, i + 3))
      }

      const today = new Date().toISOString().split('T')[0]
      const newPosts = { ...allPlatformPosts }
      const stillFailed: string[] = []
      let newSuccessCount = 0

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(platform => generateForPlatform(platform, sharedArticleId, recentPosts))
        )

        results.forEach((result, i) => {
          const platform = batch[i]

          if (result.status === 'fulfilled' && result.value.post_content) {
            newPosts[platform] = result.value

            // Save to localStorage with platform-specific key
            localStorage.setItem(
              `vetree_campaign_post_${today}_${platform}`,
              JSON.stringify(result.value)
            )
            newSuccessCount++
            console.log(`[handleRetryFailed] ✓ Generated ${platform}`)
          } else {
            stillFailed.push(platform)
            console.error(`[handleRetryFailed] ✗ Failed ${platform}:`, result)
          }
        })

        // Add delay between batches (except after last batch)
        if (batch !== batches[batches.length - 1]) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      setAllPlatformPosts(newPosts)
      setFailedPlatforms(stillFailed)

      if (stillFailed.length === 0) {
        setMessage({
          type: 'success',
          text: `✅ Retry successful! Generated ${newSuccessCount}/${failedPlatforms.length} missing posts`
        })
      } else {
        setMessage({
          type: 'success',
          text: `⚠️ Generated ${newSuccessCount}/${failedPlatforms.length} posts (${stillFailed.length} still failed)`
        })
      }

    } catch (error) {
      console.error('[handleRetryFailed] Error:', error)
      setMessage({ type: 'error', text: 'Failed to retry posts' })
    } finally {
      setGeneratingAll(false)
    }
  }

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      facebook_il: '📘',
      facebook_intl: '📘',
      whatsapp: '💬',
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸',
      telegram: '✈️',
    }
    return icons[platform] || '📱'
  }

  // Helper: record outcome to growth_agent_memory via /api/growth/feedback
  const recordToMemory = async (
    articleId: string,
    platform: string,
    outcome: 'approved' | 'skipped',
    skipReason?: string,
    hookLine?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/growth/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          platform,
          language: 'en',
          outcome,
          skip_reason: skipReason || null,
          hook_line: hookLine || null
        })
      })
      return res.ok
    } catch (e) {
      console.warn('[growth] Failed to record memory:', e)
      return false
    }
  }

  // Save LinkedIn posted URL to growth_agent_memory for activity_id matching.
  // Accepts an optional url param so onPaste can pass the pasted value directly,
  // avoiding stale-closure issues with the postedUrl state variable.
  // savedPostData is kept alive until this point (not cleared on mark-posted).
  const handleSavePostedUrl = async (url?: string) => {
    const urlToSave = url ?? postedUrl
    if (!urlToSave.trim() || !savedPostData?.article_id || !todaysPlatform) return
    setSavingPostedUrl(true)
    try {
      const res = await fetch('/api/admin/growth/memory/posted-url', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: savedPostData.article_id,
          platform: todaysPlatform.platform,
          date: today,
          posted_url: urlToSave.trim(),
        }),
      })
      if (res.ok) {
        setSavedPostedUrl(urlToSave.trim())
        setPostedUrl('')
        clearSavedPost() // Safe to clear now — URL is persisted in DB
      }
    } catch {
      // non-blocking
    } finally {
      setSavingPostedUrl(false)
    }
  }

  // Style rewrite: regenerate active platform's post with a tone instruction
  const handleStyleRewrite = async (platform: string, _style: string, instruction: string) => {
    const currentPost = allPlatformPosts[platform]
    if (!currentPost) return

    setRewritingPlatform(platform)

    try {
      const res = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: currentPost.article_id,
          platform,
          language: currentPost.language || 'en',
          style_instruction: instruction,
          existing_post: currentPost.post_content
        })
      })
      const data = await res.json()
      if (data.post_content) {
        const updated = { ...allPlatformPosts, [platform]: { ...currentPost, post_content: data.post_content } }
        setAllPlatformPosts(updated)
        localStorage.setItem(`vetree_campaign_post_${today}_${platform}`, JSON.stringify(updated[platform]))
      } else if (data.error) {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to rewrite post' })
    } finally {
      setRewritingPlatform(null)
    }
  }

  // Tighten to study summary: rewrite staying faithful to actual study findings
  const handleTightenToAbstract = async (platform: string) => {
    const currentPost = allPlatformPosts[platform]
    if (!currentPost?.article_id) return

    setRewritingPlatform(platform)

    try {
      const supabase = createClient()
      const { data: article } = await supabase
        .from('articles')
        .select('summary, clinical_bottom_line, title')
        .eq('id', currentPost.article_id)
        .single()

      const studyText = article?.summary || article?.clinical_bottom_line
      if (!studyText) {
        setMessage({ type: 'error', text: 'No study summary available for this article' })
        setRewritingPlatform(null)
        return
      }

      const res = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: currentPost.article_id,
          platform,
          language: currentPost.language || 'en',
          style_instruction: 'Rewrite this post staying strictly faithful to the following original study summary. Every factual claim must be directly supported by the summary text. Do not add interpretation beyond what the summary states.',
          abstract_override: studyText,
          existing_post: currentPost.post_content
        })
      })
      const data = await res.json()
      if (data.post_content) {
        const updated = { ...allPlatformPosts, [platform]: { ...currentPost, post_content: data.post_content } }
        setAllPlatformPosts(updated)
        localStorage.setItem(`vetree_campaign_post_${today}_${platform}`, JSON.stringify(updated[platform]))
      } else if (data.error) {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to tighten post' })
    } finally {
      setRewritingPlatform(null)
    }
  }

  // Fetch article summary when AI Photos tab is opened
  useEffect(() => {
    if (activePlatformTab !== 'ai_photos') return
    const firstPost = Object.values(allPlatformPosts)[0] as any
    if (!firstPost?.article_id) return
    setPhotoArticle(null)
    const supabase = createClient()
    ;(async () => {
      try {
        const { data } = await supabase
          .from('articles')
          .select('summary, clinical_bottom_line')
          .eq('id', firstPost.article_id)
          .single()
        if (data) setPhotoArticle(data)
      } catch { /* ignore */ }
    })()
  }, [activePlatformTab, allPlatformPosts])

  // Generate image for a platform post using Gemini Imagen
  const handleGenerateImage = async (platform: string, storeKey?: string) => {
    const currentPost = allPlatformPosts[platform]
    if (!currentPost?.article_id) return

    const key = storeKey ?? platform
    setRewritingPlatform(`img_${key}`)

    try {
      const supabase = createClient()
      const { data: article } = await supabase
        .from('articles')
        .select('summary, clinical_bottom_line')
        .eq('id', currentPost.article_id)
        .single()

      const res = await fetch('/api/growth/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_text: currentPost.post_content,
          article_id: currentPost.article_id,
          abstract_text: article?.summary || article?.clinical_bottom_line || null
        })
      })
      const data = await res.json()
      if (data.image) {
        setGeneratedImages(prev => ({ ...prev, [key]: data.image }))
      } else {
        setMessage({ type: 'error', text: data.error || 'Image generation failed' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to generate image' })
    } finally {
      setRewritingPlatform(null)
    }
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            approvedPosts[today] || todaysTask?.status === 'done'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : generatedPost
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
            {approvedPosts[today] || todaysTask?.status === 'done' ? '✅ Posted' : generatedPost ? '📝 Ready to post' : '⏳ Not generated yet'}
          </div>
          {markedPosted && todaysPlatform?.platform === 'linkedin' && (
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
              savedPostedUrl
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              🔗 {savedPostedUrl ? 'URL saved' : 'URL missing'}
            </div>
          )}
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
            {savedPostData?.article_id && savedPostData?.article_title && (
              <a
                href={`/article/${savedPostData.article_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 mb-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <span>📄</span>
                <span className="truncate">Based on: {savedPostData.article_title}</span>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {!markedPosted ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyAndMark}
                  className="flex items-center gap-1.5 text-sm text-white cursor-pointer bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md transition font-medium w-fit"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy & mark posted'}</span>
                </button>
                {memoryWriteFailed && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-400">
                    ⚠️ Memory write failed —{' '}
                    <button
                      type="button"
                      onClick={() => { setMemoryWriteFailed(false); handleCopyAndMark() }}
                      className="underline font-medium"
                    >
                      retry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="mt-2 flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Check size={14} /> Marked posted
              </span>
            )}
          </div>
        )}

        {/* All Platforms Tabs */}
        {showAllPlatforms && Object.keys(allPlatformPosts).length > 0 && (
          <div className="mt-4 mb-4">
            {/* Locked-article header — shown throughout generate-all and after */}
            {generatingAllForArticle && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-700/50">
                <span className="text-emerald-400 text-xs font-medium">
                  {generatingAll ? 'Generating all platforms for:' : 'Generated for:'}
                </span>
                <p className="text-white text-sm truncate mt-0.5">{generatingAllForArticle.title}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{generatingAllForArticle.id}</p>
              </div>
            )}
            {articleExclusionNote && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/50">
                <span className="text-amber-400 text-xs">⚠ {articleExclusionNote}</span>
              </div>
            )}
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
              <button
                type="button"
                onClick={() => setActivePlatformTab('ai_photos')}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  activePlatformTab === 'ai_photos'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-zinc-700 dark:bg-zinc-800 text-zinc-300 hover:bg-zinc-600 dark:hover:bg-zinc-700'
                }`}
              >
                🎨 AI Photos
              </button>
            </div>

            {/* Active tab content */}
            {activePlatformTab && allPlatformPosts[activePlatformTab] && (
              <div className="relative bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 border border-zinc-700 dark:border-zinc-800">
                {/* Loading overlay for style rewrites */}
                {rewritingPlatform === activePlatformTab && (
                  <div className="absolute inset-0 bg-zinc-900/80 rounded-lg flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Rewriting...</span>
                    </div>
                  </div>
                )}

                <pre className="whitespace-pre-wrap text-sm font-mono text-zinc-200 dark:text-zinc-300">
                  {allPlatformPosts[activePlatformTab].post_content}
                </pre>

                {/* Action row: Copy (+ mark posted for LinkedIn) */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyPlatformTab(activePlatformTab)}
                    className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-md transition"
                  >
                    <Copy size={14} />
                    {activePlatformTab === 'linkedin' ? 'Copy & mark posted' : 'Copy'}
                  </button>
                  {/* Image generation hidden — requires separate Google AI API billing */}
                </div>

                {/* LinkedIn tab: posted-URL input + badge (independent of todaysPlatform) */}
                {activePlatformTab === 'linkedin' && linkedinTabMarked && !linkedinTabSavedUrl && (
                  <div className="mt-3 flex flex-col gap-2 p-3 rounded-md bg-amber-950/30 border border-amber-700/40">
                    <p className="text-xs text-amber-400">Paste the LinkedIn post URL to enable future matching:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={linkedinTabPostedUrl}
                        onChange={e => setLinkedinTabPostedUrl(e.target.value)}
                        onPaste={e => {
                          const pasted = e.clipboardData.getData('text').trim()
                          if (pasted.startsWith('https://www.linkedin.com/')) {
                            setLinkedinTabPostedUrl(pasted)
                            handleSaveLinkedinTabUrl(pasted)
                          }
                        }}
                        placeholder="https://www.linkedin.com/posts/..."
                        className="flex-1 text-xs bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        disabled={linkedinTabSavingUrl || !linkedinTabPostedUrl.trim()}
                        onClick={() => handleSaveLinkedinTabUrl()}
                        className="text-xs px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50 transition"
                      >
                        {linkedinTabSavingUrl ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    <span className="text-xs text-amber-500/80 font-medium">⚠️ URL missing</span>
                  </div>
                )}
                {activePlatformTab === 'linkedin' && linkedinTabSavedUrl && (
                  <div className="mt-3 px-3 py-2 rounded-md bg-green-950/30 border border-green-700/40 flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">✓ URL saved</span>
                    <span className="text-xs text-zinc-500 truncate">{linkedinTabSavedUrl}</span>
                  </div>
                )}

                {/* Style rewrite buttons */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {Object.entries(STYLE_PROMPTS).map(([key, instruction]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleStyleRewrite(activePlatformTab, key, instruction)}
                      disabled={!!rewritingPlatform}
                      className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-full transition capitalize disabled:opacity-50"
                    >
                      ✏️ {key}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleTightenToAbstract(activePlatformTab)}
                    disabled={!!rewritingPlatform}
                    className="px-3 py-1 text-xs bg-emerald-900 hover:bg-emerald-800 text-emerald-300 rounded-full transition disabled:opacity-50"
                  >
                    📄 Tighten to abstract
                  </button>
                </div>

                {/* Generated image */}
                {generatedImages[activePlatformTab] && (
                  <div className="mt-4">
                    <div className="space-y-1.5">
                      <img
                        src={generatedImages[activePlatformTab]}
                        alt="Generated image"
                        className="rounded-lg w-full border border-zinc-700 object-cover"
                      />
                      <div className="flex justify-end">
                        <a
                          href={generatedImages[activePlatformTab]}
                          download={`vetree-${activePlatformTab}-${today}.jpg`}
                          className="text-xs text-zinc-400 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded transition"
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Photos tab panel */}
            {activePlatformTab === 'ai_photos' && (
              <div className="bg-zinc-900 dark:bg-zinc-950 rounded-lg p-4 border border-zinc-700 dark:border-zinc-800">
                <p className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap mb-4">
                  {`craft 3-4 images that will pair well with the following professional oriented content on social media networks. make one in normal ratio and one in a 4:5 ratio:\n\n`}
                  {photoArticle
                    ? (photoArticle.summary || photoArticle.clinical_bottom_line || 'No summary available.')
                    : 'Loading article summary...'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const firstPlatform = PLATFORM_ROTATION.find(p => allPlatformPosts[p.platform])?.platform
                    if (firstPlatform) handleGenerateImage(firstPlatform, 'ai_photos')
                  }}
                  disabled={!!rewritingPlatform || !photoArticle}
                  className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded-md transition disabled:opacity-50"
                >
                  {rewritingPlatform === 'img_ai_photos'
                    ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                    : '🎨 Generate Images'}
                </button>
                {generatedImages['ai_photos'] && (
                  <div className="mt-4 space-y-1.5">
                    <img
                      src={generatedImages['ai_photos']}
                      alt="Generated image"
                      className="rounded-lg w-full border border-zinc-700 object-cover"
                    />
                    <div className="flex justify-end">
                      <a
                        href={generatedImages['ai_photos']}
                        download={`vetree-ai-photos-${today}.jpg`}
                        className="text-xs text-zinc-400 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded transition"
                      >
                        ⬇️ Download
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommended Posts — data-driven article suggestions */}
        {!approvedPosts[today] && (!todaysTask || todaysTask.status !== 'done') && !generatedPost && (
          <div className="mb-4">
            <button
              type="button"
              onClick={loadRecommendations}
              disabled={loadingRecs}
              className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              {loadingRecs
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
                : <><span>✨</span> Show recommended articles to post</>
              }
            </button>

            {showRecommendations && insights && (
              <div className="mt-3">
                {/* Insight bar */}
                <div className="flex gap-2 flex-wrap mb-3 items-center">
                  <span className="text-xs text-gray-500">Top performing specialties:</span>
                  {insights.top_specialties.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 bg-emerald-900/40 text-emerald-400 rounded-full text-xs">
                      {s}
                    </span>
                  ))}
                  <span className="text-xs text-gray-600 ml-auto">
                    Based on {insights.total_social_visits_analyzed} social visits
                  </span>
                </div>

                {/* Recommendation cards */}
                <div className="space-y-2">
                  {recommendations.map((article, i) => (
                    <div key={article.id} className="flex items-start gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-emerald-700 transition group">
                      <span className="text-lg font-bold text-gray-600 w-6 shrink-0 mt-0.5">{i + 1}</span>

                      {/* Main clickable area */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedArticle({ id: article.id, title: article.title })
                          setManualSelectionLocked(true)
                          setShowRecommendations(false)
                        }}
                      >
                        <p className="text-sm text-white font-medium truncate group-hover:text-emerald-300">
                          {article.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {article.clinical_bottom_line}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex gap-1 flex-wrap">
                            {(article.labels || [])
                              .filter((l: string) => !['Small Animal','Large Animal'].includes(l))
                              .slice(0, 2)
                              .map((label: string) => (
                                <span key={label} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                  {label}
                                </span>
                              ))
                            }
                          </div>
                          <span className="text-xs text-gray-600 truncate">{article.source_journal}</span>
                        </div>
                      </div>

                      {/* Dismiss actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          title="Already published"
                          onClick={e => { e.stopPropagation(); dismissRecommendation(article.id, 'already_published') }}
                          className="text-xs text-gray-600 hover:text-emerald-400 transition px-1.5 py-0.5 rounded hover:bg-gray-700"
                        >
                          ✓ posted
                        </button>
                        <button
                          type="button"
                          title="Not relevant"
                          onClick={e => { e.stopPropagation(); dismissRecommendation(article.id, 'irrelevant') }}
                          className="text-xs text-gray-600 hover:text-red-400 transition px-1.5 py-0.5 rounded hover:bg-gray-700"
                        >
                          ✕ skip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowRecommendations(false)}
                  className="mt-2 text-xs text-gray-600 hover:text-gray-400"
                >
                  Hide recommendations
                </button>
              </div>
            )}
          </div>
        )}

        {/* Article Search (Optional) */}
        {!approvedPosts[today] && (!todaysTask || todaysTask.status !== 'done') && !generatedPost && (
          <div className="relative mb-3">
            {selectedArticle ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 border border-emerald-700 rounded-lg text-sm">
                <span className="text-emerald-300">📄</span>
                <span className="text-emerald-200 flex-1 truncate">{selectedArticle.title}</span>
                <button
                  onClick={() => {
                    setSelectedArticle(null)
                    setManualSelectionLocked(false)
                    setArticleSearch('')
                    setArticleExclusionNote(null)
                  }}
                  className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={articleSearch}
                  onChange={(e) => {
                    setArticleSearch(e.target.value)
                    searchArticles(e.target.value)
                  }}
                  placeholder="🔍 Search for specific article (optional)"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-600"
                />
                {showArticleDropdown && articleResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {articleResults.map((article: any) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => {
                          setSelectedArticle({ id: article.id, title: article.title })
                          setManualSelectionLocked(true)
                          setArticleSearch('')
                          setShowArticleDropdown(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-700 transition border-b border-gray-700 last:border-0"
                      >
                        <p className="text-sm text-white truncate">{article.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{article.source_journal}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Exclusion note — shown after generation when article has normally-excluded labels */}
        {articleExclusionNote && !showAllPlatforms && (
          <div className="w-full mb-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/50">
            <span className="text-amber-400 text-xs">⚠ {articleExclusionNote}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!approvedPosts[today] && (!todaysTask || todaysTask.status !== 'done') && (
            <>
              {!generatedPost ? (
                <>
                  {/* Article confirmation — shown before every Generate / Generate All */}
                  <div className={`w-full mb-1 px-3 py-2 rounded-lg border text-sm ${
                    selectedArticle
                      ? 'bg-emerald-900/20 border-emerald-700/50'
                      : 'bg-zinc-800/60 border-zinc-700'
                  }`}>
                    {selectedArticle ? (
                      <>
                        <span className="text-emerald-400 text-xs font-medium">Forced selection</span>
                        <p className="text-white truncate mt-0.5 text-sm">{selectedArticle.title}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{selectedArticle.id}</p>
                      </>
                    ) : (
                      <span className="text-zinc-500 text-xs">Article will be auto-selected from today&apos;s feed — or search above to force one</span>
                    )}
                  </div>
                  <button
                    type="button"
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
                      : selectedArticle
                        ? `⚡ Generate All — ${selectedArticle.title.slice(0, 40)}${selectedArticle.title.length > 40 ? '…' : ''}`
                        : '⚡ Generate All Platforms'}
                  </button>
                </>
              ) : (
                <>
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

                  {/* Retry Failed - only show when there are failed platforms AND posts exist */}
                  {failedPlatforms.length > 0 && Object.keys(allPlatformPosts).length > 0 && (
                    <button
                      type="button"
                      onClick={handleRetryFailed}
                      disabled={generatingAll || isGenerating}
                      className="px-4 py-3 bg-orange-700 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generatingAll
                        ? <><Loader2 size={14} className="animate-spin" /> Retrying...</>
                        : `🔁 Retry Failed (${failedPlatforms.length})`}
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
          {/* Posted URL input — LinkedIn only, shown after marking posted */}
          {(approvedPosts[today] || todaysTask?.status === 'done') &&
            todaysPlatform?.platform === 'linkedin' && (
            <div className={`flex flex-col gap-1.5 mt-2 p-3 rounded-lg border ${
              savedPostedUrl
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
            }`}>
              {savedPostedUrl ? (
                <p className="text-xs text-green-700 dark:text-green-400">
                  🔗 URL saved:{' '}
                  <a href={savedPostedUrl} target="_blank" rel="noreferrer" className="underline break-all">
                    {savedPostedUrl.slice(0, 60)}…
                  </a>
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    🔗 Paste the LinkedIn URL to enable exact tracking
                  </p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="url"
                      value={postedUrl}
                      onChange={e => setPostedUrl(e.target.value)}
                      onPaste={e => {
                        const pasted = e.clipboardData.getData('text').trim()
                        if (pasted.startsWith('https://www.linkedin.com/')) {
                          setPostedUrl(pasted)
                          handleSavePostedUrl(pasted) // pass value directly — no stale closure
                        }
                      }}
                      placeholder="https://www.linkedin.com/posts/..."
                      className="flex-1 px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => handleSavePostedUrl()}
                      disabled={!postedUrl.trim() || savingPostedUrl}
                      className="px-3 py-1.5 text-sm bg-[#3D7A5F] text-white rounded-md hover:bg-[#2F5F4A] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {savingPostedUrl ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
