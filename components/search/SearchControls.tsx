'use client'

import { useRouter } from 'next/navigation'
import { ParsedFilters, SortOption, LabelOperator, QuickFilter } from '@/types/search'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { SearchBar } from './SearchBar'
import { FilterPanel } from './FilterPanel'
import { SortSelector } from './SortSelector'
import { useCallback, useRef, useEffect, ReactNode } from 'react'

type SearchControlsProps = {
  initialFilters: ParsedFilters
  availableJournals: string[]
  availableEvidenceLevels: string[]
  children?: ReactNode
}

export function SearchControls({
  initialFilters,
  availableJournals,
  availableEvidenceLevels,
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
    <div className="flex h-screen">
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
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">
              Vetree
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Veterinary Research Platform
            </p>
          </header>

          <div className="space-y-4 mb-8">
            <SearchBar defaultValue={initialFilters.search} onSearch={handleSearchChange} />
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
        </div>
      </div>
    </div>
  )
}
