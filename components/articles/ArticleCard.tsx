import { Article } from '@/lib/supabase'
import { ArticleSummary } from './ArticleSummary'
import { getLabelColor } from '@/lib/constants/labelColors'
import { BookmarkButton } from './BookmarkButton'
import { SaveCount } from './SaveCount'

type ArticleCardProps = {
  article: Article
}

// Helper function to parse malformed labels from database
function parseLabels(labels: string[] | null | undefined): string[] {
  if (!labels || !Array.isArray(labels)) return []

  // Handle malformed labels like: ['["Soft Tissue Surgery"', '"Small Animal"', '"Large Animal"]']
  const parsedLabels: string[] = []

  for (const label of labels) {
    if (typeof label === 'string') {
      // Remove all brackets, quotes, and extra whitespace
      const cleaned = label
        .replace(/[\[\]"\\]/g, '')
        .trim()

      if (cleaned) {
        // Split by comma in case multiple labels are in one string
        const split = cleaned.split(',').map(l => l.trim()).filter(Boolean)
        parsedLabels.push(...split)
      }
    }
  }

  return parsedLabels
}

export function ArticleCard({ article }: ArticleCardProps) {
  const cleanLabels = parseLabels(article.labels)
  const hasUrl = article.article_url && article.article_url.trim() !== ''

  return (
    <article className="bg-white dark:bg-[#1A1A1A] rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] p-6 hover:shadow-md transition-shadow relative">
      {/* Bookmark button - top right */}
      <div className="absolute top-4 right-4">
        <BookmarkButton articleId={article.id} />
      </div>

      <div className="space-y-4 pr-10">
        {/* 1. Source journal + publication date */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          {article.source_journal && (
            <span className="font-medium">{article.source_journal}</span>
          )}
          {article.publication_date && (
            <span>
              {new Date(article.publication_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          )}
        </div>

        {/* 2. Clinical Bottom Line */}
        {article.clinical_bottom_line && (
          <div className="bg-amber-50/80 dark:bg-amber-900/10 border-l-3 border-amber-400 dark:border-amber-600 rounded-r-md p-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
              Clinical Bottom Line
            </h4>
            <p className="text-amber-900 dark:text-amber-100 text-sm leading-relaxed">
              {article.clinical_bottom_line}
            </p>
          </div>
        )}

        {/* 3. Title in sage green */}
        <div>
          {hasUrl ? (
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl font-semibold text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
            >
              {article.title}
            </a>
          ) : (
            <h3 className="text-2xl font-semibold text-[#3D7A5F] dark:text-[#4E9A78]">
              {article.title}
            </h3>
          )}
        </div>

        {/* 4. Authors */}
        {article.authors && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {article.authors}
          </p>
        )}

        {/* 5. Strength of evidence badge */}
        {article.strength_of_evidence && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evidence: {article.strength_of_evidence}
            </span>
          </div>
        )}

        {/* 6. Summary */}
        {article.summary && (
          <ArticleSummary summary={article.summary} expandedByDefault={true} />
        )}

        {/* 7. Labels with pastel colors */}
        {cleanLabels.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
            {cleanLabels.map((label, index) => (
              <span
                key={index}
                className={`px-3 py-1 text-xs font-medium rounded-full border ${getLabelColor(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* 8. Read Full Article link + Save count */}
        <div className="pt-3 flex items-center justify-between gap-4">
          {hasUrl && (
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
            >
              Read Full Article
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          )}
          <SaveCount articleId={article.id} />
        </div>
      </div>
    </article>
  )
}
