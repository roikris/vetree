'use client'

import { useState } from 'react'

type JournalFilterProps = {
  availableJournals: string[]
  selected: string[]
  onChange: (journals: string[]) => void
}

export function JournalFilter({ availableJournals, selected, onChange }: JournalFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJournals = availableJournals.filter(journal =>
    journal.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleJournal = (journal: string) => {
    if (selected.includes(journal)) {
      onChange(selected.filter(j => j !== journal))
    } else {
      onChange([...selected, journal])
    }
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'Collapse journals filter' : 'Expand journals filter'}
        aria-expanded={isExpanded}
        className="flex items-center justify-between w-full text-left text-sm font-semibold text-zinc-900 dark:text-white"
      >
        <span>
          Journals {selected.length > 0 && `(${selected.length})`}
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
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journals..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-zinc-400"
          />
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-[#3D7A5F] dark:text-[#4E9A78] hover:underline font-medium"
            >
              Clear all
            </button>
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredJournals.length > 0 ? (
              filteredJournals.map((journal) => (
                <label
                  key={journal}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(journal)}
                    onChange={() => toggleJournal(journal)}
                    className="w-4 h-4 text-[#3D7A5F] bg-zinc-50 border-zinc-300 rounded focus:ring-[#3D7A5F] dark:bg-zinc-900 dark:border-zinc-600 dark:text-[#4E9A78] dark:focus:ring-[#4E9A78]"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {journal}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 p-2">
                No journals found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
