import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Article } from '@/lib/supabase'
import { ArticleCard } from '@/components/articles/ArticleCard'
import Link from 'next/link'
import type { Metadata } from 'next'

type PageProps = {
  params: Promise<{ id: string }>
}

async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data as Article
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    return {
      title: 'Article Not Found - Vetree',
    }
  }

  const description = article.clinical_bottom_line
    ? article.clinical_bottom_line.substring(0, 160)
    : article.summary?.substring(0, 160) || 'Veterinary research article on Vetree'

  return {
    title: `${article.title} - Vetree`,
    description,
    openGraph: {
      title: article.title,
      description,
      url: `https://vetree.app/article/${id}`,
      siteName: 'Vetree',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: article.title,
      description,
    },
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header with back link */}
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back to Search</span>
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <svg className="w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <div>
              <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Vetree
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Evidence-based veterinary research, distilled.
              </p>
            </div>
          </div>
        </header>

        {/* Article Card */}
        <div className="mb-12">
          <ArticleCard article={article} />
        </div>

        {/* Invitational Banner */}
        <div className="bg-gradient-to-r from-[#3D7A5F]/5 to-[#4E9A78]/5 dark:from-[#3D7A5F]/10 dark:to-[#4E9A78]/10 border border-[#3D7A5F]/20 dark:border-[#4E9A78]/20 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🌿</span>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Enjoying this?
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
            Vetree distills veterinary research into clear, actionable summaries. Explore thousands of articles from top journals.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-3 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Explore More Articles
          </Link>
        </div>
      </div>
    </div>
  )
}
