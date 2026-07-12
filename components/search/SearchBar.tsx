'use client'

import { useState, useEffect, useRef } from 'react'

type SearchBarProps = {
  defaultValue: string
  onSearch: (query: string) => void
  resultsCount?: number
}

const SearchTips = () => {
  const [show, setShow] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleShow = (visible: boolean) => {
    if (visible && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setOpenUpward(rect.bottom + 290 > window.innerHeight)
    }
    setShow(visible)
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => handleShow(true)}
        onMouseLeave={() => handleShow(false)}
        onFocus={() => handleShow(true)}
        onBlur={() => handleShow(false)}
        onClick={() => {
          if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setOpenUpward(rect.bottom + 290 > window.innerHeight)
          }
          setShow(s => !s)
        }}
        aria-label="Search tips"
        className="w-5 h-5 rounded-full border border-gray-400 text-gray-400
                   hover:border-emerald-500 hover:text-emerald-400
                   flex items-center justify-center text-xs font-bold
                   transition cursor-help select-none"
      >
        ?
      </button>

      {show && (
        <div
          className={`absolute right-0 ${openUpward ? 'bottom-7' : 'top-7'} z-50 w-72 bg-gray-900 border
                     border-gray-700 rounded-xl shadow-2xl p-4 text-sm
                     text-gray-300 leading-relaxed`}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <p className="font-semibold text-white mb-2">
            💡 Search tips
          </p>
          <ul className="space-y-2 text-gray-400">
            <li>
              <span className="text-white">Keep it short</span> —{' '}
              1–2 broad keywords work best.<br />
              <span className="text-emerald-400">✓ &quot;mitral valve&quot;</span>
              <span className="text-gray-600"> not &quot;mitral valve disease treatment options&quot;</span>
            </li>
            <li>
              <span className="text-white">Use the condition, not the question</span><br />
              <span className="text-emerald-400">✓ &quot;pancreatitis cats&quot;</span>
              <span className="text-gray-600"> not &quot;how to treat pancreatitis in cats&quot;</span>
            </li>
            <li>
              <span className="text-white">Acronyms are understood</span><br />
              <span className="text-gray-400">IVDD, NSAID, TPLO, CKD, GDV — all work.</span>
            </li>
            <li>
              <span className="text-white">For synthesis</span> —{' '}
              short queries give the most focused AI summaries.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export function SearchBar({ defaultValue, onSearch, resultsCount }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(defaultValue)
  const onSearchRef = useRef(onSearch)
  const lastLoggedQuery = useRef('')

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  // Log searches after they complete and results are available
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only log if query is not empty, at least 2 chars, and different from last logged
      if (inputValue.trim().length >= 2 && inputValue !== lastLoggedQuery.current) {
        lastLoggedQuery.current = inputValue

        // Log the search
        fetch('/api/analytics/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: inputValue.trim(),
            results_count: resultsCount || 0
          })
        }).catch(error => {
          console.debug('[analytics] Failed to log search:', error)
        })
      }
    }, 1000) // Wait 1 second after user stops typing

    return () => clearTimeout(timer)
  }, [inputValue, resultsCount])

  const handleClear = () => {
    setInputValue('')
    onSearchRef.current('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearchRef.current(inputValue)
  }

  return (
    <form onSubmit={handleSubmit} className="relative" data-onboarding="search-bar">
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
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        aria-label="Search veterinary articles"
        data-testid="search-input"
        placeholder="Search articles by title, summary, clinical bottom line, or authors..."
        className="w-full pl-12 pr-24 py-3 text-base bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78] focus:border-transparent text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-zinc-400 dark:placeholder-zinc-500"
      />
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
        <SearchTips />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
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
        <button
          type="submit"
          aria-label="Search"
          data-testid="search-submit"
          className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex-shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </form>
  )
}
