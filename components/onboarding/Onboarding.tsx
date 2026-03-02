'use client'

import { useState, useEffect } from 'react'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { useAuth } from '@/lib/hooks/useAuth'

type OnboardingStep = {
  id: string
  title: string
  description: string
  targetSelector: string
  position: 'top' | 'right' | 'bottom' | 'left'
  requiresAuth?: boolean
}

const STEPS: OnboardingStep[] = [
  {
    id: 'search',
    title: 'Search Articles',
    description: 'Search 7,000+ veterinary research articles by title, author, or keyword',
    targetSelector: '[data-onboarding="search-bar"]',
    position: 'bottom',
  },
  {
    id: 'filters',
    title: 'Filter Results',
    description: 'Filter by specialty, journal, or strength of evidence',
    targetSelector: '[data-onboarding="filters"]',
    position: 'right',
  },
  {
    id: 'article',
    title: 'Clinical Bottom Line',
    description: 'Each card shows the clinical bottom line first — the most important takeaway',
    targetSelector: '[data-onboarding="article-card"]',
    position: 'right',
  },
  {
    id: 'bookmark',
    title: 'Save Articles',
    description: 'Save articles to your personal library for quick access later',
    targetSelector: '[data-onboarding="bookmark"]',
    position: 'left',
    requiresAuth: true,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: 'New articles are added daily from top veterinary journals',
    targetSelector: '[data-onboarding="header"]',
    position: 'bottom',
  },
]

export function Onboarding() {
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding()
  const { user } = useAuth()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  // Filter steps based on auth status
  const availableSteps = STEPS.filter(step => !step.requiresAuth || user)
  const currentStep = availableSteps[currentStepIndex]
  const isLastStep = currentStepIndex === availableSteps.length - 1

  useEffect(() => {
    if (!showOnboarding || !currentStep) return

    const updateTargetRect = () => {
      const element = document.querySelector(currentStep.targetSelector)
      if (element) {
        const rect = element.getBoundingClientRect()
        setTargetRect(rect)
      }
    }

    updateTargetRect()
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect)

    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect)
    }
  }, [showOnboarding, currentStep])

  if (!showOnboarding || !currentStep || !targetRect) {
    return null
  }

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding()
    } else {
      setCurrentStepIndex(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    skipOnboarding()
  }

  // Calculate tooltip position based on target position
  const getTooltipStyle = () => {
    const spacing = 24
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10001,
    }

    switch (currentStep.position) {
      case 'top':
        style.left = targetRect.left + targetRect.width / 2
        style.top = targetRect.top - spacing
        style.transform = 'translate(-50%, -100%)'
        break
      case 'bottom':
        style.left = targetRect.left + targetRect.width / 2
        style.top = targetRect.bottom + spacing
        style.transform = 'translateX(-50%)'
        break
      case 'left':
        style.right = window.innerWidth - targetRect.left + spacing
        style.top = targetRect.top + targetRect.height / 2
        style.transform = 'translateY(-50%)'
        break
      case 'right':
        style.left = targetRect.right + spacing
        style.top = targetRect.top + targetRect.height / 2
        style.transform = 'translateY(-50%)'
        break
    }

    return style
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity duration-300"
        style={{ zIndex: 9999 }}
        onClick={handleSkip}
      />

      {/* Spotlight effect - highlighted area */}
      <div
        className="fixed pointer-events-none transition-all duration-300"
        style={{
          zIndex: 10000,
          left: targetRect.left - 8,
          top: targetRect.top - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          boxShadow: '0 0 0 4px rgba(61, 122, 95, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.6)',
          borderRadius: '12px',
        }}
      />

      {/* Tooltip card */}
      <div
        className="bg-white dark:bg-[#1A1A1A] rounded-xl border-2 border-[#3D7A5F] dark:border-[#4E9A78] shadow-2xl p-6 max-w-sm transition-all duration-300"
        style={getTooltipStyle()}
      >
        {/* Arrow SVG pointing to target */}
        {currentStep.position === 'bottom' && (
          <svg
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2 L2 12 L12 10 L22 12 Z" />
          </svg>
        )}
        {currentStep.position === 'top' && (
          <svg
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78] rotate-180"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2 L2 12 L12 10 L22 12 Z" />
          </svg>
        )}
        {currentStep.position === 'right' && (
          <svg
            className="absolute -left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78] -rotate-90"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2 L2 12 L12 10 L22 12 Z" />
          </svg>
        )}
        {currentStep.position === 'left' && (
          <svg
            className="absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78] rotate-90"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2 L2 12 L12 10 L22 12 Z" />
          </svg>
        )}

        {/* Step counter */}
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          {currentStepIndex + 1} of {availableSteps.length}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-3">
          {currentStep.title}
        </h3>

        {/* Description */}
        <p className="text-[#1A1A1A] dark:text-[#E8E8E8] mb-6 leading-relaxed">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSkip}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Skip tutorial
          </button>
          <button
            onClick={handleNext}
            className="bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-2.5 font-medium transition-colors"
          >
            {isLastStep ? 'Get Started!' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
