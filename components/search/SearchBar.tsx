'use client'

import { useState, useEffect, useRef } from 'react'

type SearchBarProps = {
  defaultValue: string
  onSearch: (query: string) => void
  resultsCount?: number
}

export function SearchBar({ defaultValue, onSearch, resultsCount }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const onSearchRef = useRef(onSearch)
  const lastLoggedQuery = useRef('')

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(query)
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  // Log searches after they complete and results are available
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only log if query is not empty, at least 2 chars, and different from last logged
      if (query.trim().length >= 2 && query !== lastLoggedQuery.current) {
        lastLoggedQuery.current = query

        // Log the search
        fetch('/api/analytics/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            results_count: resultsCount || 0
          })
        }).catch(error => {
          console.debug('[analytics] Failed to log search:', error)
        })
      }
    }, 1000) // Wait 1 second after user stops typing

    return () => clearTimeout(timer)
  }, [query, resultsCount])

  const handleClear = () => {
    setQuery('')
  }

  return (
    <div className="relative" data-onboarding="search-bar">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-zinc-400 dark:text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search veterinary articles"
        placeholder="Search articles by title, summary, clinical bottom line, or authors..."
        className="w-full pl-12 pr-12 py-3 text-base bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] focus:border-transparent text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-zinc-400 dark:placeholder-zinc-500"
      />
      {query && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
