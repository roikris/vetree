'use client'

import { useState } from 'react'

type EvidenceFilterProps = {
  availableLevels: string[]
  selected: string[]
  onChange: (levels: string[]) => void
}

export function EvidenceFilter({ availableLevels, selected, onChange }: EvidenceFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleLevel = (level: string) => {
    if (selected.includes(level)) {
      onChange(selected.filter(l => l !== level))
    } else {
      onChange([...selected, level])
    }
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left text-sm font-semibold text-zinc-900 dark:text-white"
      >
        <span>
          Strength of Evidence {selected.length > 0 && `(${selected.length})`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-2 pt-2">
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all
            </button>
          )}
          <div className="space-y-1">
            {availableLevels.map((level) => (
              <label
                key={level}
                className="flex items-center space-x-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(level)}
                  onChange={() => toggleLevel(level)}
                  className="w-4 h-4 text-blue-600 bg-zinc-100 border-zinc-300 rounded focus:ring-blue-500 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {level}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
