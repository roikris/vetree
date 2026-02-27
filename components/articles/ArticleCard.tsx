import { Article } from '@/lib/supabase'
import { ArticleSummary } from './ArticleSummary'

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

// Map each label to its unique color scheme
function getLabelColor(label: string): string {
  const colorMap: { [key: string]: string } = {
    'Anesthesia': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    'Behavior': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    'Cardiology': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    'Dentistry': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
    'Dermatology': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    'Emergency': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    'Equine': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'Exotic': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    'Internal Medicine': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'Large Animal': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    'Neurology': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'Nutrition': 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
    'Oncology': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    'Ophthalmology': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    'Orthopedics': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    'Pathology': 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300',
    'Pharmacology': 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
    'Radiology': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    'Reproduction': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    'Small Animal': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'Soft Tissue Surgery': 'bg-stone-100 dark:bg-stone-900/30 text-stone-700 dark:text-stone-300'
  }

  return colorMap[label] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
}

export function ArticleCard({ article }: ArticleCardProps) {
  const cleanLabels = parseLabels(article.labels)
  const hasUrl = article.article_url && article.article_url.trim() !== ''

  return (
    <article className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        {/* 1. Source journal + publication date (larger serif font, gray, top) */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-base text-zinc-500 dark:text-zinc-400 font-serif">
          {article.source_journal && (
            <span>{article.source_journal}</span>
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

        {/* 2. Clinical Bottom Line - BEFORE title */}
        {article.clinical_bottom_line && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-600 rounded-r p-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              Clinical Bottom Line
            </h4>
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              {article.clinical_bottom_line}
            </p>
          </div>
        )}

        {/* 3. Title (large, bold, black) - AFTER clinical bottom line */}
        <div>
          {hasUrl ? (
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl font-bold text-zinc-900 dark:text-white hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {article.title}
            </a>
          ) : (
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {article.title}
            </h3>
          )}
        </div>

        {/* 4. Authors (small, more faded/muted) */}
        {article.authors && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {article.authors}
          </p>
        )}

        {/* 5. Strength of evidence (small gray badge) */}
        {article.strength_of_evidence && (
          <div>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evidence: {article.strength_of_evidence}
            </span>
          </div>
        )}

        {/* 6. Summary (expanded by default) */}
        {article.summary && (
          <ArticleSummary summary={article.summary} expandedByDefault={true} />
        )}

        {/* 7. Labels as pill badges with unique colors (at the bottom) */}
        {cleanLabels.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {cleanLabels.map((label, index) => (
              <span
                key={index}
                className={`px-3 py-1 text-xs font-medium rounded-full ${getLabelColor(label)}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* 8. "Read Full Article" button at the very bottom */}
        {hasUrl && (
          <div className="pt-2">
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2B6CB0] hover:bg-[#1e4a7a] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Read Full Article
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </article>
  )
}
