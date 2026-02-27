'use client'

import { useRouter } from 'next/navigation'
import { buildSearchParams } from '@/lib/utils/searchParams'
import { ParsedFilters } from '@/types/search'

type PaginationProps = {
  currentPage: number
  totalPages: number
  filters: ParsedFilters
}

export function Pagination({ currentPage, totalPages, filters }: PaginationProps) {
  const router = useRouter()

  if (totalPages <= 1) {
    return null
  }

  const goToPage = (page: number) => {
    const newFilters = { ...filters, page }
    const params = buildSearchParams(newFilters)
    router.push(`/?${params}`)
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showEllipsis = totalPages > 7

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-zinc-900"
      >
        Previous
      </button>

      <div className="flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-zinc-500 dark:text-zinc-400"
              >
                ...
              </span>
            )
          }

          const pageNum = page as number
          const isActive = pageNum === currentPage

          return (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {pageNum}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-zinc-900"
      >
        Next
      </button>
    </div>
  )
}
