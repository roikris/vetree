import { Article } from '@/lib/supabase'
import { ArticleCard } from './ArticleCard'
import Link from 'next/link'

type PersonalizedFeedProps = {
  articles: Article[]
}

export function PersonalizedFeed({ articles }: PersonalizedFeedProps) {
  if (articles.length === 0) return null

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] flex items-center gap-2">
          <span>🎯</span>
          <span>Based on your interests</span>
        </h2>
        <Link
          href="/profile"
          className="text-sm text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] font-medium transition-colors"
        >
          Edit interests →
        </Link>
      </div>

      <div className="space-y-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          All Articles
        </h3>
      </div>
    </div>
  )
}
