'use client'

import { useState, useEffect } from 'react'

const ONBOARDING_KEY = 'vetree_onboarding_complete'

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const completed = localStorage.getItem(ONBOARDING_KEY)
    if (!completed) {
      // Small delay to ensure page is loaded
      setTimeout(() => setShowOnboarding(true), 500)
    }
  }, [])

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowOnboarding(false)
  }

  const skipOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowOnboarding(false)
  }

  return {
    showOnboarding: mounted && showOnboarding,
    completeOnboarding,
    skipOnboarding,
  }
}
