'use client'

import { useState, useEffect, useRef } from 'react'

type SearchBarProps = {
  defaultValue: string
  onSearch: (query: string) => void
}

export function SearchBar({ defaultValue, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(query)
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  const handleClear = () => {
    setQuery('')
  }

  return (
    <div className="relative">
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
        placeholder="Search articles by title, summary, clinical bottom line, or authors..."
        className="w-full pl-12 pr-12 py-3 text-base bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
      />
      {query && (
        <button
          onClick={handleClear}
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
