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
        aria-label={isExpanded ? 'Collapse strength of evidence filter' : 'Expand strength of evidence filter'}
        aria-expanded={isExpanded}
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
              className="text-xs text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
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
                  className="w-4 h-4 text-[#3D7A5F] bg-zinc-50 border-zinc-300 rounded focus:ring-[#3D7A5F] dark:bg-zinc-900 dark:border-zinc-600 dark:text-[#4E9A78] dark:focus:ring-[#4E9A78]"
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
