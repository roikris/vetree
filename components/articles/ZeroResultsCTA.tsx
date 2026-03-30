'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type ZeroResultsCTAProps = {
  searchQuery: string
}

const generateRelatedTerms = (query: string): string[] => {
  const words = query.toLowerCase().split(' ')
    .filter(w => w.length > 3)
    .filter(w => !['with', 'from', 'that', 'this', 'have', 'will'].includes(w))
  return words.slice(0, 4)
}

export function ZeroResultsCTA({ searchQuery }: ZeroResultsCTAProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSynthesis = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('synthesize', 'true')
    router.push(`/?${params.toString()}`)
  }

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', term)
    router.push(`/?${params.toString()}`)
  }

  const relatedTerms = generateRelatedTerms(searchQuery)

  return (
    <div className="text-center py-12 px-6">
      <div className="text-5xl mb-4">🔍</div>

      <h2 className="text-xl font-semibold text-white mb-2">
        No articles found for &ldquo;{searchQuery}&rdquo;
      </h2>
      <p className="text-gray-400 mb-8 max-w-md mx-auto">
        We don&apos;t have articles matching this exact term yet —
        but our AI can synthesize evidence from related research.
      </p>

      <button
        onClick={handleSynthesis}
        aria-label={`Synthesize evidence for "${searchQuery}"`}
        className="inline-flex items-center gap-2 px-6 py-3
                   bg-emerald-700 hover:bg-emerald-600 text-white
                   rounded-lg font-medium text-lg transition mb-4"
      >
        🔬 Synthesize Evidence for &ldquo;{searchQuery}&rdquo;
      </button>

      <p className="text-gray-500 text-sm mb-8">
        AI will search across 15,000+ veterinary studies and
        summarize the best evidence on this topic
      </p>

      {relatedTerms.length > 0 && (
        <div className="mt-6">
          <p className="text-gray-400 text-sm mb-3">Or try a broader search:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {relatedTerms.map(term => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                aria-label={`Search for ${term}`}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600
                           text-gray-300 rounded-full text-sm transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
