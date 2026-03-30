'use client'

import { useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArticleList } from './ArticleList'
import { Pagination } from '@/components/ui/Pagination'
import { ParsedFilters } from '@/types/search'
import { Article } from '@/lib/supabase'
import { buildSearchParams } from '@/lib/utils/searchParams'

type ArticleFeedWrapperProps = {
  articles: Article[]
  searchQuery?: string
  currentPage: number
  totalPages: number
  filters: ParsedFilters
}

export function ArticleFeedWrapper({
  articles,
  searchQuery,
  currentPage,
  totalPages,
  filters,
}: ArticleFeedWrapperProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const articleListRef = useRef<HTMLDivElement>(null)
  const wasPendingRef = useRef(false)

  // Scroll to article list top when navigation completes
  useEffect(() => {
    if (wasPendingRef.current && !isPending) {
      articleListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    wasPendingRef.current = isPending
  }, [isPending])

  const goToPage = (page: number) => {
    const newFilters = { ...filters, page }
    const params = buildSearchParams(newFilters)
    startTransition(() => {
      router.push(`/?${params}`)
    })
  }

  return (
    <>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />

      <div ref={articleListRef} className="relative">
        <div
          className={`transition-opacity duration-200 ${
            isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'
          }`}
        >
          <ArticleList articles={articles} searchQuery={searchQuery} />
        </div>

        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-gray-900/90 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Loading articles…</span>
            </div>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />
    </>
  )
}
