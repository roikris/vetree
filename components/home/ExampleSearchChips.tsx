'use client'

import { useRouter } from 'next/navigation'

const EXAMPLE_SEARCHES = [
  'canine diabetes management',
  'feline hypertension',
  'TPLO outcomes',
  'pancreatitis treatment',
  'lymphoma chemotherapy',
]

export function ExampleSearchChips() {
  const router = useRouter()

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-3">
      <span className="text-sm text-gray-400 mr-1 self-center">Try:</span>
      {EXAMPLE_SEARCHES.map(term => (
        <button
          key={term}
          onClick={() => {
            router.push(`/?search=${encodeURIComponent(term)}&synthesize=true`)
          }}
          className="px-3 py-1 text-sm bg-emerald-900/30 hover:bg-emerald-900/50
                     text-emerald-300 border border-emerald-800 rounded-full transition"
        >
          {term}
        </button>
      ))}
    </div>
  )
}
