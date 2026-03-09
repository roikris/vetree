'use client'

import { useState, useEffect } from 'react'

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Check if we should show the prompt
    const visitCount = parseInt(localStorage.getItem('pwa_visit_count') || '0')
    const dismissed = localStorage.getItem('pwa_prompt_dismissed')
    const installed = localStorage.getItem('pwa_installed')

    // Increment visit count
    localStorage.setItem('pwa_visit_count', String(visitCount + 1))

    // Show prompt after 3 visits if not dismissed or installed
    if (visitCount >= 2 && !dismissed && !installed) {
      // Check if it's iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

      if (isIOS) {
        // Show iOS instructions
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        if (!isStandalone) {
          setTimeout(() => setShowPrompt(true), 2000)
        }
      }
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)

      // Show prompt if conditions are met
      if (visitCount >= 2 && !dismissed && !installed) {
        setTimeout(() => setShowPrompt(true), 2000)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      localStorage.setItem('pwa_installed', 'true')
      setShowPrompt(false)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

    if (isIOS) {
      // Show iOS instructions
      setShowIOSInstructions(true)
    } else if (deferredPrompt) {
      // Trigger Android install prompt
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true')
      }

      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true')
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-[#1A1A1A] border-t-2 border-[#3D7A5F] shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📱</span>
                <h3 className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                  Add Vetree to Home Screen
                </h3>
              </div>
              <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 ml-1">
                <li>1. Tap the <strong>Share</strong> button <span className="inline-block">↑</span> in Safari</li>
                <li>2. Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>3. Tap <strong>Add</strong> to confirm</li>
              </ol>
            </div>
            <button
              onClick={() => {
                setShowIOSInstructions(false)
                setShowPrompt(false)
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-[#1A1A1A] border-t-2 border-[#3D7A5F] shadow-lg">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-2xl">🌿</span>
          <div>
            <p className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Add Vetree to your home screen
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Quick access to veterinary research
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="px-4 py-2 text-sm font-medium bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] transition-colors"
          >
            Add to Home Screen
          </button>
        </div>
      </div>
    </div>
  )
}
