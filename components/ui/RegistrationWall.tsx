'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const VIEWS_KEY = 'vetree_guest_views'
const SESSION_DISMISSED_KEY = 'vetree_wall_dismissed'
const VIEW_THRESHOLD = 3

export function RegistrationWall() {
  const [showWall, setShowWall] = useState(false)
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem(SESSION_DISMISSED_KEY)) {
      return
    }

    // Get current view count
    const viewCount = parseInt(localStorage.getItem(VIEWS_KEY) || '0', 10)

    // Show wall if threshold reached
    if (viewCount >= VIEW_THRESHOLD) {
      setShowWall(true)
      setIsBlurred(true)
    }
  }, [])

  function handleDismiss() {
    setShowWall(false)
    setIsBlurred(false)
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
  }

  if (!showWall) return null

  return (
    <>
      {/* Backdrop blur */}
      {isBlurred && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/10 z-40"
          onClick={handleDismiss}
        />
      )}

      {/* Registration card */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-2xl border border-[#3D7A5F]/20 dark:border-[#4E9A78]/20 p-8 max-w-md w-full pointer-events-auto">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">🌿</div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
              You've read {VIEW_THRESHOLD} articles
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Create a free account to keep reading + get a weekly digest of research in your specialty
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/signup"
              className="block w-full bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-3 font-semibold transition-colors text-center"
            >
              Sign Up Free
            </Link>

            <button
              onClick={handleDismiss}
              className="block w-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm transition-colors"
            >
              Maybe later — continue reading
            </button>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-4">
            Free forever · No credit card required
          </p>
        </div>
      </div>
    </>
  )
}

// Hook to track article views
export function trackArticleView() {
  if (typeof window === 'undefined') return

  const currentCount = parseInt(localStorage.getItem(VIEWS_KEY) || '0', 10)
  localStorage.setItem(VIEWS_KEY, String(currentCount + 1))
}
