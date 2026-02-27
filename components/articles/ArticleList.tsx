import { Article } from '@/lib/supabase'
import { ArticleCard } from './ArticleCard'

type ArticleListProps = {
  articles: Article[]
}

export function ArticleList({ articles }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto text-zinc-400 dark:text-zinc-600 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          No articles found
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}
