import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSavedArticles } from '@/app/actions/saved-articles'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { Article } from '@/lib/supabase'
import Link from 'next/link'
import { BottomNav } from '@/components/ui/BottomNav'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login')
  }

  const { articles, error } = await getSavedArticles()

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-20 md:pb-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Search</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
            </svg>
            <div>
              <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                My Library
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {articles.length} {articles.length === 1 ? 'article' : 'articles'} saved
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200 text-sm">
              Error loading saved articles: {error}
            </p>
          </div>
        )}

        {articles.length === 0 ? (
          // Empty state
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
            </svg>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
              No saved articles yet
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Start exploring and save articles to build your personal library!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-3 font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore Articles
            </Link>
          </div>
        ) : (
          // Article list
          <div className="space-y-6">
            {articles.map((article: any) => (
              <ArticleCard key={article.id} article={article as Article} />
            ))}
          </div>
        )}
        </main>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
