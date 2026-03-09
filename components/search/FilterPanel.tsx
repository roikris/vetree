'use client'

import { useState, useEffect } from 'react'
import { LabelFilter } from './LabelFilter'
import { EvidenceFilter } from './EvidenceFilter'
import { JournalFilter } from './JournalFilter'
import { LabelOperator, QuickFilter } from '@/types/search'

type FilterPanelProps = {
  labels: string[]
  labelOperator: LabelOperator
  quickFilter: QuickFilter
  evidence: string[]
  journals: string[]
  availableJournals: string[]
  availableEvidenceLevels: string[]
  onLabelsChange: (labels: string[]) => void
  onLabelOperatorChange: (operator: LabelOperator) => void
  onQuickFilterChange: (filter: QuickFilter) => void
  onEvidenceChange: (evidence: string[]) => void
  onJournalsChange: (journals: string[]) => void
}

export function FilterPanel({
  labels,
  labelOperator,
  quickFilter,
  evidence,
  journals,
  availableJournals,
  availableEvidenceLevels,
  onLabelsChange,
  onLabelOperatorChange,
  onQuickFilterChange,
  onEvidenceChange,
  onJournalsChange
}: FilterPanelProps) {
  // State for collapsed/expanded (default: expanded/open)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('filtersSidebarCollapsed')
    return saved !== null ? JSON.parse(saved) : false // default to OPEN
  })

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('filtersSidebarCollapsed', String(newState))
  }

  return (
    <div
      className={`${
        isCollapsed ? 'w-16' : 'w-80'
      } bg-white dark:bg-[#0F0F0F] border-r border-[#E5E5E5] dark:border-[#2A2A2A] h-screen overflow-y-auto flex-shrink-0 transition-all duration-300 hidden md:block`}
      data-onboarding="filters"
    >
      {/* Toggle Button */}
      <div className="p-4 flex justify-end border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <button
          onClick={toggleCollapsed}
          className="text-[#3D7A5F] dark:text-[#4E9A78] hover:bg-[#3D7A5F]/10 dark:hover:bg-[#4E9A78]/10 rounded p-2 transition-colors"
          aria-label={isCollapsed ? 'Expand filters' : 'Collapse filters'}
        >
          {isCollapsed ? (
            <span className="text-xl font-bold">»</span>
          ) : (
            <span className="text-xl font-bold">«</span>
          )}
        </button>
      </div>

      {/* Collapsed State - Vertical Text */}
      {isCollapsed && (
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <span
            className="text-[#3D7A5F] dark:text-[#4E9A78] font-semibold text-sm tracking-wider"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            FILTERS
          </span>
        </div>
      )}

      {/* Expanded State - Full Filters */}
      {!isCollapsed && (
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
              Filters
            </h2>

            {/* Tags Filter Section */}
            <LabelFilter
              selected={labels}
              operator={labelOperator}
              quickFilter={quickFilter}
              onChange={onLabelsChange}
              onOperatorChange={onLabelOperatorChange}
              onQuickFilterChange={onQuickFilterChange}
            />
          </div>

          {/* Journal Filter Section */}
          <div className="border-t border-[#E5E5E5] dark:border-[#2A2A2A] pt-6">
            <JournalFilter
              availableJournals={availableJournals}
              selected={journals}
              onChange={onJournalsChange}
            />
          </div>

          {/* Evidence Filter Section */}
          <div className="border-t border-[#E5E5E5] dark:border-[#2A2A2A] pt-6">
            <EvidenceFilter
              availableLevels={availableEvidenceLevels}
              selected={evidence}
              onChange={onEvidenceChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}
