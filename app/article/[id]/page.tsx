import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createPublicClient } from '@supabase/supabase-js'
import { Article } from '@/lib/supabase'
import { ArticleCard } from '@/components/articles/ArticleCard'
import { ArticleViewTracker } from '@/components/articles/ArticleViewTracker'
import { RegistrationWall } from '@/components/ui/RegistrationWall'
import { FollowTopicButtons } from '@/components/articles/FollowTopicButtons'
import { SoftRegistrationPrompt } from '@/components/articles/SoftRegistrationPrompt'
import Link from 'next/link'
import type { Metadata } from 'next'

type PageProps = {
  params: Promise<{ id: string }>
}

// Pre-build 100 newest enriched articles at deploy time
export async function generateStaticParams() {
  const supabase = createPublicClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .order('publication_date', { ascending: false })
    .limit(100)

  return (data || []).map((article) => ({ id: article.id }))
}

// Allow on-demand generation for articles not in top 100
export const dynamicParams = true

// Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400

async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .single()

  if (error || !data) {
    return null
  }

  return data as Article
}

async function getRelatedArticles(labels: string[] | null, currentArticleId: string): Promise<Article[]> {
  if (!labels || labels.length === 0) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('articles')
    .select('*')
    .neq('id', currentArticleId)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .overlaps('labels', labels)
    .order('publication_date', { ascending: false })
    .limit(4)

  return (data || []) as Article[]
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
    title: article.title,
    description,
    alternates: {
      canonical: `/article/${id}`,
    },
    openGraph: {
      title: article.title,
      description,
      url: `https://vetree.app/article/${id}`,
      siteName: 'Vetree',
      images: [{
        url: `https://vetree.app/article/${id}/opengraph-image`,
        width: 1200,
        height: 630,
      }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      images: [`https://vetree.app/article/${id}/opengraph-image`],
    },
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    notFound()
  }

  // Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  // Fetch related articles
  const relatedArticles = await getRelatedArticles(article.labels, article.id)

  // JSON-LD structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "headline": article.title,
    "description": article.clinical_bottom_line || article.summary,
    "datePublished": article.publication_date,
    "publisher": {
      "@type": "Organization",
      "name": article.source_journal || "Unknown Journal"
    },
    "about": article.labels?.map(label => ({
      "@type": "MedicalCondition",
      "name": label
    })),
    "url": `https://vetree.app/article/${article.id}`,
    "isAccessibleForFree": true,
    "inLanguage": "en"
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Track article view for non-logged-in users */}
      <ArticleViewTracker isLoggedIn={isLoggedIn} />

      {/* Registration wall for non-logged-in users after 3 views */}
      {!isLoggedIn && <RegistrationWall />}

      <div className="h-screen overflow-y-auto bg-white dark:bg-[#0F0F0F]">
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
        <div className="mb-8">
          <ArticleCard article={article} />
        </div>

        {/* Follow Topic Buttons */}
        {article.labels && article.labels.length > 0 && (
          <div className="mb-12">
            <FollowTopicButtons labels={article.labels} isLoggedIn={isLoggedIn} />
          </div>
        )}

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-6">
              More research on {article.labels?.[0] || 'related topics'}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {relatedArticles.map((relatedArticle) => (
                <ArticleCard key={relatedArticle.id} article={relatedArticle} />
              ))}
            </div>
          </div>
        )}

        {/* Invitational Banner */}
        <div className="bg-gradient-to-r from-[#3D7A5F]/5 to-[#4E9A78]/5 dark:from-[#3D7A5F]/10 dark:to-[#4E9A78]/10 border border-[#3D7A5F]/20 dark:border-[#4E9A78]/20 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🌿</span>
            <h2 className="text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Enjoying this?
            </h2>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
            Vetree distills veterinary research into clear, actionable summaries. Explore articles from top veterinary journals.
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

        {/* Soft Registration Prompt (scroll-triggered for non-logged-in users) */}
        {!isLoggedIn && <SoftRegistrationPrompt labels={article.labels} />}
      </div>
      </div>
    </>
  )
}
