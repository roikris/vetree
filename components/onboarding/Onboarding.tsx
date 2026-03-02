'use client'

import { useState, useEffect } from 'react'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { useAuth } from '@/lib/hooks/useAuth'
import { Caveat } from 'next/font/google'

const caveat = Caveat({ subsets: ['latin'] })

type OnboardingStep = {
  id: string
  title: string
  description: string
  targetSelector: string
  requiresAuth?: boolean
}

const STEPS: OnboardingStep[] = [
  {
    id: 'search',
    title: 'Search Articles',
    description: 'Search veterinary research articles by title, author, or keyword',
    targetSelector: '[data-onboarding="search-bar"]',
  },
  {
    id: 'filters',
    title: 'Filter Results',
    description: 'Filter by specialty, journal, or strength of evidence',
    targetSelector: '[data-onboarding="filters"]',
  },
  {
    id: 'article',
    title: 'Clinical Bottom Line',
    description: 'Each card shows the clinical bottom line first — the most important takeaway',
    targetSelector: '[data-onboarding="article-card"]',
  },
  {
    id: 'bookmark',
    title: 'Save Articles',
    description: 'Save articles to your personal library for quick access later',
    targetSelector: '[data-onboarding="bookmark"]',
    requiresAuth: true,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: 'New articles are added daily from top veterinary journals',
    targetSelector: '[data-onboarding="header"]',
  },
]

type TooltipPosition = {
  top: number
  left: number
  arrowPosition: 'top' | 'bottom' | 'left' | 'right'
  arrowOffset?: { x: number; y: number }
}

export function Onboarding() {
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding()
  const { user } = useAuth()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)

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
    window.addEventListener('scroll', updateTargetRect, true)

    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [showOnboarding, currentStep])

  // Calculate smart tooltip positioning
  useEffect(() => {
    if (!targetRect) return

    const MARGIN = 20
    const TOOLTIP_WIDTH = 384 // max-w-sm = 24rem = 384px
    const TOOLTIP_HEIGHT = 250 // approximate height
    const SPACING = 40

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Determine if target is in top or bottom half
    const targetCenterY = targetRect.top + targetRect.height / 2
    const isInTopHalf = targetCenterY < viewportHeight / 2

    // Determine if target is on left or right side
    const targetCenterX = targetRect.left + targetRect.width / 2
    const isOnLeftSide = targetCenterX < viewportWidth / 2

    let top = 0
    let left = 0
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top'

    // Prefer vertical positioning (above or below)
    if (isInTopHalf) {
      // Show tooltip BELOW target
      top = targetRect.bottom + SPACING
      arrowPosition = 'top'

      // Check if tooltip would go off bottom
      if (top + TOOLTIP_HEIGHT + MARGIN > viewportHeight) {
        // Not enough room below, try above
        top = targetRect.top - SPACING - TOOLTIP_HEIGHT
        arrowPosition = 'bottom'
      }
    } else {
      // Show tooltip ABOVE target
      top = targetRect.top - SPACING - TOOLTIP_HEIGHT
      arrowPosition = 'bottom'

      // Check if tooltip would go off top
      if (top < MARGIN) {
        // Not enough room above, show below
        top = targetRect.bottom + SPACING
        arrowPosition = 'top'
      }
    }

    // Center horizontally on target
    left = targetCenterX - TOOLTIP_WIDTH / 2

    // Constrain to viewport horizontally
    if (left < MARGIN) {
      left = MARGIN
    } else if (left + TOOLTIP_WIDTH + MARGIN > viewportWidth) {
      left = viewportWidth - TOOLTIP_WIDTH - MARGIN
    }

    // Constrain to viewport vertically
    if (top < MARGIN) {
      top = MARGIN
    } else if (top + TOOLTIP_HEIGHT + MARGIN > viewportHeight) {
      top = viewportHeight - TOOLTIP_HEIGHT - MARGIN
    }

    setTooltipPosition({
      top,
      left,
      arrowPosition,
      arrowOffset: { x: targetCenterX - left, y: targetCenterY - top }
    })
  }, [targetRect])

  if (!showOnboarding || !currentStep || !targetRect || !tooltipPosition) {
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

  // Hand-drawn arrow SVG components with organic, sketchy appearance
  const HandDrawnArrow = ({ position }: { position: 'top' | 'bottom' | 'left' | 'right' }) => {
    const arrowPaths = {
      top: (
        // Arrow pointing up from tooltip to target above - wobbly and organic
        <path
          d="M 50 85 C 48 75, 52 70, 49 60 C 47 50, 51 45, 50 35 C 49 25, 52 20, 50 10 M 50 10 L 44 20 M 50 10 L 56 19"
          stroke="#1A1A1A"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      ),
      bottom: (
        // Arrow pointing down from tooltip to target below - wobbly and organic
        <path
          d="M 50 15 C 52 25, 48 30, 51 40 C 53 50, 49 55, 50 65 C 51 75, 48 80, 50 90 M 50 90 L 44 80 M 50 90 L 56 81"
          stroke="#1A1A1A"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      ),
      left: (
        // Arrow pointing left from tooltip to target on left - wobbly and organic
        <path
          d="M 85 50 C 75 52, 70 48, 60 51 C 50 53, 45 49, 35 50 C 25 51, 20 48, 10 50 M 10 50 L 20 44 M 10 50 L 19 56"
          stroke="#1A1A1A"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      ),
      right: (
        // Arrow pointing right from tooltip to target on right - wobbly and organic
        <path
          d="M 15 50 C 25 48, 30 52, 40 49 C 50 47, 55 51, 65 50 C 75 49, 80 52, 90 50 M 90 50 L 80 44 M 90 50 L 81 56"
          stroke="#1A1A1A"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      ),
    }

    const arrowStyles = {
      top: { top: '-60px', left: '50%', transform: 'translateX(-50%)' },
      bottom: { bottom: '-60px', left: '50%', transform: 'translateX(-50%)' },
      left: { left: '-60px', top: '50%', transform: 'translateY(-50%)' },
      right: { right: '-60px', top: '50%', transform: 'translateY(-50%)' },
    }

    return (
      <svg
        className="absolute pointer-events-none"
        style={arrowStyles[position]}
        width="100"
        height="100"
        viewBox="0 0 100 100"
      >
        {arrowPaths[position]}
      </svg>
    )
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
        className={`bg-white dark:bg-[#1A1A1A] rounded-xl border-2 border-[#3D7A5F] dark:border-[#4E9A78] shadow-2xl p-6 w-96 max-w-[calc(100vw-40px)] transition-all duration-300 fixed ${caveat.className}`}
        style={{
          zIndex: 10001,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Hand-drawn arrow */}
        <HandDrawnArrow position={tooltipPosition.arrowPosition} />

        {/* Step counter */}
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          {currentStepIndex + 1} of {availableSteps.length}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-[#3D7A5F] dark:text-[#4E9A78] mb-3">
          {currentStep.title}
        </h3>

        {/* Description */}
        <p className="text-lg text-[#1A1A1A] dark:text-[#E8E8E8] mb-6 leading-relaxed">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSkip}
            className="text-base text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Skip tutorial
          </button>
          <button
            onClick={handleNext}
            className="bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-3 text-lg font-semibold transition-colors"
          >
            {isLastStep ? 'Get Started!' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
