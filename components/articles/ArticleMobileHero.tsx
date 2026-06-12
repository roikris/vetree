'use client'

import Link from 'next/link'
import { Article } from '@/lib/supabase'
import { useSavedArticles } from '@/lib/hooks/useSavedArticles'
import { useAuth } from '@/lib/hooks/useAuth'

const LARGE_ANIMAL = [
  'Equine', 'equine', 'Large Animal', 'large animal',
  'Livestock', 'livestock', 'Poultry', 'poultry',
  'Food Animal', 'food animal',
]

const SPECIES = [
  'Small Animal', 'Large Animal', 'small animal', 'large animal',
  'Equine', 'equine', 'Livestock', 'livestock', 'Poultry', 'poultry',
  'Food Animal', 'food animal', 'Feline', 'feline', 'Canine', 'canine', 'Exotic',
]

type Props = {
  article: Article
}

export function ArticleMobileHero({ article }: Props) {
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedArticles()

  const filteredLabels = article.labels?.filter(l => !LARGE_ANIMAL.includes(l)) ?? []
  const primaryLabel = article.labels?.filter(l => !SPECIES.includes(l))[0]

  const saved = isSaved(article.id)

  return (
    <div className="flex flex-col gap-3">
      {/* Journal + date */}
      <p className="text-xs text-gray-400">
        {article.source_journal}
        {article.publication_date && (
          <> &middot; {new Date(article.publication_date).getFullYear()}</>
        )}
      </p>

      {/* Label chips */}
      {filteredLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredLabels.map(label => (
            <span
              key={label}
              className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded-full px-2 py-0.5"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* CBL */}
      {article.clinical_bottom_line && (
        <div className="bg-emerald-950/40 border-l-4 border-emerald-500 px-4 py-4 rounded-r-xl mb-1">
          <p className="text-lg font-semibold leading-snug text-white">
            {article.clinical_bottom_line}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {/* Synthesis button */}
        {primaryLabel && (
          <Link
            href={`/?search=${encodeURIComponent(primaryLabel)}&synthesize=true`}
            className="flex items-center justify-center gap-2 w-full min-h-12 bg-emerald-700 hover:bg-emerald-600 text-white font-medium rounded-xl px-4 transition-colors"
          >
            <span>🔬</span>
            <span>See synthesis for {primaryLabel}</span>
          </Link>
        )}

        {/* Save button */}
        {user ? (
          <button
            onClick={() => toggleSave(article.id)}
            className="flex items-center justify-center gap-2 w-full min-h-12 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl px-4 transition-colors"
          >
            {saved ? (
              <>
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                </svg>
                <span>Saved</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                </svg>
                <span>Save article</span>
              </>
            )}
          </button>
        ) : (
          <Link
            href={`/signup?return=/article/${article.id}`}
            className="flex items-center justify-center gap-2 w-full min-h-12 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl px-4 transition-colors"
          >
            Sign up free to save articles
          </Link>
        )}

        {/* Read full paper */}
        {article.article_url && (
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full min-h-12 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl px-4 border border-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Read full paper</span>
          </a>
        )}
      </div>
    </div>
  )
}
