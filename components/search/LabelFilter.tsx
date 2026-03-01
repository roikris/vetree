'use client'

import { VETERINARY_LABELS } from '@/lib/constants/labels'
import { LabelOperator, QuickFilter } from '@/types/search'

type LabelFilterProps = {
  selected: string[]
  operator: LabelOperator
  quickFilter: QuickFilter
  onChange: (labels: string[]) => void
  onOperatorChange: (operator: LabelOperator) => void
  onQuickFilterChange: (filter: QuickFilter) => void
}

export function LabelFilter({
  selected,
  operator,
  quickFilter,
  onChange,
  onOperatorChange,
  onQuickFilterChange
}: LabelFilterProps) {
  const toggleLabel = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter(l => l !== label))
    } else {
      onChange([...selected, label])
    }
  }

  // Filter out Small Animal and Large Animal from specialty checkboxes
  const specialtyLabels = VETERINARY_LABELS.filter(
    label => label !== 'Small Animal' && label !== 'Large Animal'
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
          Tags
        </h3>

        {/* Quick Filter Tabs */}
        <div className="flex gap-1 mb-4 bg-zinc-50 dark:bg-zinc-900 p-1 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]">
          <button
            onClick={() => onQuickFilterChange('all')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              quickFilter === 'all'
                ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onQuickFilterChange('small-animal')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              quickFilter === 'small-animal'
                ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Small Animal
          </button>
          <button
            onClick={() => onQuickFilterChange('large-animal')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              quickFilter === 'large-animal'
                ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Large Animal
          </button>
        </div>

        {/* Specialties Label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Specialties {selected.length > 0 && `(${selected.length})`}
          </span>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* OR/AND Toggle - Show only when 2+ specialties selected */}
        {selected.length >= 2 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Match:</span>
            <div className="flex gap-1 bg-zinc-50 dark:bg-zinc-900 p-0.5 rounded border border-[#E5E5E5] dark:border-[#2A2A2A]">
              <button
                onClick={() => onOperatorChange('OR')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  operator === 'OR'
                    ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Any (OR)
              </button>
              <button
                onClick={() => onOperatorChange('AND')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  operator === 'AND'
                    ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                All (AND)
              </button>
            </div>
          </div>
        )}

        {/* Specialty Checkboxes */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {specialtyLabels.map((label) => (
            <label
              key={label}
              className="flex items-center space-x-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selected.includes(label)}
                onChange={() => toggleLabel(label)}
                className="w-4 h-4 text-[#3D7A5F] bg-zinc-50 border-zinc-300 rounded focus:ring-[#3D7A5F] dark:bg-zinc-900 dark:border-zinc-600 dark:text-[#4E9A78] dark:focus:ring-[#4E9A78]"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
