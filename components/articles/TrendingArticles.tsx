'use client'

import Link from 'next/link'
import { Article } from '@/lib/supabase'

type TrendingArticle = Article & {
  save_count: number
}

type TrendingArticlesProps = {
  articles: TrendingArticle[]
}

export function TrendingArticles({ articles }: TrendingArticlesProps) {
  // Don't show section if fewer than 3 articles
  if (articles.length < 3) {
    return null
  }

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
          Trending This Week
        </h2>
        <span className="text-2xl">🔥</span>
      </div>

      {/* Trending Cards Container */}
      <div className="flex gap-4 overflow-x-auto md:flex-wrap pb-4 -mx-8 px-8 md:mx-0 md:px-0 scrollbar-hide">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/article/${article.id}`}
            className="flex-shrink-0 w-80 md:w-auto md:flex-1 md:min-w-[300px] md:max-w-[400px] bg-white dark:bg-[#1A1A1A] border-2 border-[#3D7A5F]/20 dark:border-[#4E9A78]/20 rounded-lg p-5 hover:border-[#3D7A5F] dark:hover:border-[#4E9A78] hover:shadow-lg transition-all"
          >
            {/* Rank Badge */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#3D7A5F] dark:bg-[#4E9A78] flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] line-clamp-2 mb-2">
                  {article.title}
                </h3>

                {/* Clinical Bottom Line */}
                {article.clinical_bottom_line && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1 mb-3">
                    {article.clinical_bottom_line}
                  </p>
                )}
              </div>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
              {/* Save Count */}
              <div className="flex items-center gap-1.5 text-sm font-medium text-[#3D7A5F] dark:text-[#4E9A78]">
                <span>🔖</span>
                <span>{article.save_count} {article.save_count === 1 ? 'save' : 'saves'} this week</span>
              </div>
            </div>

            {/* Journal */}
            {article.source_journal && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 truncate">
                {article.source_journal}
              </div>
            )}
          </Link>
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  )
}
