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

    // FIX 1: Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      {/* FIX 3: Previous button - prominent sage green styling */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
          currentPage === 1
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-[#3D7A5F] hover:bg-[#2F5F4A] dark:bg-[#4E9A78] dark:hover:bg-[#3D7A5F] text-white'
        }`}
      >
        <span>←</span>
        <span>Previous</span>
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
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#3D7A5F] dark:bg-[#4E9A78] text-white'
                  : 'text-[#1A1A1A] dark:text-[#E8E8E8] border border-[#E5E5E5] dark:border-[#2A2A2A] hover:bg-[#3D7A5F] hover:text-white hover:border-[#3D7A5F] dark:hover:bg-[#4E9A78] dark:hover:border-[#4E9A78]'
              }`}
            >
              {pageNum}
            </button>
          )
        })}
      </div>

      {/* FIX 3: Next button - prominent sage green styling */}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
          currentPage === totalPages
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            : 'bg-[#3D7A5F] hover:bg-[#2F5F4A] dark:bg-[#4E9A78] dark:hover:bg-[#3D7A5F] text-white'
        }`}
      >
        <span>Next</span>
        <span>→</span>
      </button>
    </div>
  )
}
