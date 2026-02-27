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
    <div className="w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen overflow-y-auto flex-shrink-0">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
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
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <JournalFilter
            availableJournals={availableJournals}
            selected={journals}
            onChange={onJournalsChange}
          />
        </div>

        {/* Evidence Filter Section */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
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
