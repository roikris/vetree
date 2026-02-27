'use client'

import { SortOption } from '@/types/search'

type SortSelectorProps = {
  value: SortOption
  onChange: (sort: SortOption) => void
  showRelevance: boolean
}

export function SortSelector({ value, onChange, showRelevance }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Sort by:
      </label>
      <select
        id="sort"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        {showRelevance && <option value="relevance">Relevance</option>}
      </select>
    </div>
  )
}
