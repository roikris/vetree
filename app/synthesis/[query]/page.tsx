import { SynthesisPanelClient } from './SynthesisPanelClient'
import Link from 'next/link'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'

type SynthesisPageProps = {
  params: Promise<{ query: string }>
}

export default async function SynthesisPage({ params }: SynthesisPageProps) {
  const { query } = await params
  const decodedQuery = decodeURIComponent(query)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Search</span>
            </Link>
            <DarkModeToggle />
          </div>

          {/* Page title */}
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-[#3D7A5F] dark:text-[#4E9A78]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/>
            </svg>
            <div>
              <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Evidence Synthesis
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Query: <span className="font-medium text-zinc-700 dark:text-zinc-300">{decodedQuery}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Synthesis Panel */}
        <SynthesisPanelClient query={decodedQuery} />
      </div>
    </div>
  )
}
