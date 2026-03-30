'use client'

import { useRouter } from 'next/navigation'
import { ParsedFilters, SortOption, LabelOperator, QuickFilter } from '@/types/search'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { SearchBar } from './SearchBar'
import { FilterPanel } from './FilterPanel'
import { SortSelector } from './SortSelector'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'
import { AuthButton } from '@/components/ui/AuthButton'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { Footer } from '@/components/ui/Footer'
import { BottomNav } from '@/components/ui/BottomNav'
import { useCallback, useRef, useEffect, ReactNode } from 'react'
import { Facebook, Instagram, Twitter } from 'lucide-react'

const socialLinks = [
  {
    name: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61580762360451',
    icon: <Facebook size={16} />,
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/vetreeapp/',
    icon: <Instagram size={16} />,
  },
  {
    name: 'X / Twitter',
    url: 'https://x.com/Vetree_app',
    icon: <Twitter size={16} />,
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@vetreeapp',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
      </svg>
    ),
  },
]

type SearchControlsProps = {
  initialFilters: ParsedFilters
  availableJournals: string[]
  availableEvidenceLevels: string[]
  resultsCount?: number
  children?: ReactNode
}

export function SearchControls({
  initialFilters,
  availableJournals,
  availableEvidenceLevels,
  resultsCount,
  children
}: SearchControlsProps) {
  const router = useRouter()
  const filtersRef = useRef(initialFilters)

  useEffect(() => {
    filtersRef.current = initialFilters
  }, [initialFilters])

  const updateFilters = useCallback((newFilters: Partial<ParsedFilters>) => {
    const updated = { ...filtersRef.current, ...newFilters, page: 1 }
    filtersRef.current = updated
    const params = buildSearchParams(updated)
    const newUrl = `/?${params}`
    router.push(newUrl)
  }, [router])

  const handleSearchChange = useCallback((search: string) => {
    updateFilters({ search })
  }, [updateFilters])

  const handleLabelsChange = useCallback((labels: string[]) => {
    updateFilters({ labels })
  }, [updateFilters])

  const handleLabelOperatorChange = useCallback((labelOperator: LabelOperator) => {
    updateFilters({ labelOperator })
  }, [updateFilters])

  const handleQuickFilterChange = useCallback((quickFilter: QuickFilter) => {
    updateFilters({ quickFilter })
  }, [updateFilters])

  const handleEvidenceChange = useCallback((evidence: string[]) => {
    updateFilters({ evidence })
  }, [updateFilters])

  const handleJournalsChange = useCallback((journals: string[]) => {
    updateFilters({ journals })
  }, [updateFilters])

  const handleSortChange = useCallback((sort: SortOption) => {
    updateFilters({ sort })
  }, [updateFilters])

  return (
    <>
      <Onboarding />
      <div className="flex min-h-screen md:h-screen">
        {/* Left Sidebar - Filters */}
        <FilterPanel
        labels={initialFilters.labels}
        labelOperator={initialFilters.labelOperator}
        quickFilter={initialFilters.quickFilter}
        evidence={initialFilters.evidence}
        journals={initialFilters.journals}
        availableJournals={availableJournals}
        availableEvidenceLevels={availableEvidenceLevels}
        onLabelsChange={handleLabelsChange}
        onLabelOperatorChange={handleLabelOperatorChange}
        onQuickFilterChange={handleQuickFilterChange}
        onEvidenceChange={handleEvidenceChange}
        onJournalsChange={handleJournalsChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:overflow-y-auto bg-white dark:bg-[#0F0F0F]">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-20 md:pb-8">
          {/* Header with leaf icon and dark mode toggle */}
          <header className="mb-6 md:mb-10 relative" data-onboarding="header">
            <div className="flex items-start gap-2 md:gap-3 mb-2">
              {/* Leaf icon */}
              <svg className="w-7 h-7 md:w-9 md:h-9 text-[#3D7A5F] dark:text-[#4E9A78] flex-shrink-0 mt-0.5 md:mt-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
              </svg>

              <div className="flex-1">
                <p className="text-2xl md:text-4xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-0.5 md:mb-1">
                  Vetree
                </p>
                <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400">
                  Evidence-based veterinary research, distilled.
                </p>
              </div>

              {/* Auth and dark mode toggle */}
              <div className="absolute top-0 right-0 flex items-center gap-2 md:gap-3">
                {/* Social icons — desktop only */}
                <div className="hidden md:flex items-center gap-3 mr-1">
                  {socialLinks.map(social => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
                <AuthButton />
                <DarkModeToggle />
              </div>
            </div>
          </header>

          {/* Search and sort controls */}
          <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
            <SearchBar
              defaultValue={initialFilters.search}
              onSearch={handleSearchChange}
              resultsCount={resultsCount}
            />
            <div className="flex items-center justify-end">
              <SortSelector
                value={initialFilters.sort}
                onChange={handleSortChange}
                showRelevance={!!initialFilters.search}
              />
            </div>
          </div>

          {/* Search results content */}
          {children}

          {/* Footer */}
          <Footer />
        </div>
      </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </>
  )
}
