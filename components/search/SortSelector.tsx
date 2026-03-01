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
        className="px-3 py-2 text-sm bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] text-[#1A1A1A] dark:text-[#E8E8E8]"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        {showRelevance && <option value="relevance">Relevance</option>}
      </select>
    </div>
  )
}
