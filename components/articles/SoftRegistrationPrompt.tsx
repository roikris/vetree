'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SoftRegistrationPromptProps {
  labels: string[] | null
}

export function SoftRegistrationPrompt({ labels }: SoftRegistrationPromptProps) {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const isDismissed = sessionStorage.getItem('vetree_soft_prompt_dismissed')
    if (isDismissed) {
      setDismissed(true)
      return
    }

    const handleScroll = () => {
      const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100

      if (scrollPercentage >= 70 && !show && !dismissed) {
        setShow(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [show, dismissed])

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
    sessionStorage.setItem('vetree_soft_prompt_dismissed', 'true')
  }

  const handleFollowTopic = async () => {
    if (!labels || labels.length === 0) {
      router.push('/signup')
      return
    }

    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
    router.push(`/signup?return=${returnUrl}`)
  }

  const handleSubscribeDigest = () => {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
    router.push(`/signup?return=${returnUrl}`)
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#3D7A5F] to-[#4E9A78] text-white shadow-2xl z-40 animate-slide-up">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <p className="text-sm md:text-base font-medium">
            Get 5 fresh veterinary studies every Friday → Free
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFollowTopic}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Follow this topic
          </button>
          <button
            onClick={handleSubscribeDigest}
            className="px-4 py-2 bg-white text-[#3D7A5F] hover:bg-white/90 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Subscribe to digest
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white transition-colors ml-2"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
