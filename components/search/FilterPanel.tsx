'use client'

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
  return (
    <div className="w-80 bg-white dark:bg-[#0F0F0F] border-r border-[#E5E5E5] dark:border-[#2A2A2A] h-screen overflow-y-auto flex-shrink-0">
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
    </div>
  )
}
