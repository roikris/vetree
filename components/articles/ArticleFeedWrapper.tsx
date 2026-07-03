'use client'

import { useTransition, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  totalCount?: number
  filters: ParsedFilters
}

export function ArticleFeedWrapper({
  articles,
  searchQuery,
  currentPage,
  totalPages,
  totalCount,
  filters,
}: ArticleFeedWrapperProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const articleListRef = useRef<HTMLDivElement>(null)
  const wasPendingRef = useRef(false)
  const searchParams = useSearchParams()
  const urlPage = parseInt(searchParams.get('page') || '1', 10)
  const urlSearch = searchParams.get('search') || ''
  const isStale = urlPage !== currentPage || urlSearch !== (filters.search || '')
  const showLoading = isPending || isStale

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
            showLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'
          }`}
        >
          <ArticleList articles={articles} searchQuery={searchQuery} view={filters.view} totalCount={totalCount} />
        </div>

        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--al-card)', borderRadius: 999, border: '1px solid rgba(var(--al-line, 232,224,204), .12)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--al-accent)', borderTopColor: 'transparent' }} />
              <span style={{ fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 13, color: 'var(--al-mut3)' }}>Loading…</span>
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
