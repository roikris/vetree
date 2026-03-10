import Link from 'next/link'
import { Article } from '@/lib/supabase'

type HeroSectionProps = {
  exampleArticle: Article | null
  stats: {
    confirmed_users: number
    articles_count: number
  }
}

function formatUserCount(count: number): string {
  if (count < 20) {
    return 'Early access — join the first veterinary professionals using Vetree'
  }

  const roundedDown = Math.floor(count / 5) * 5
  return `Joined by ${roundedDown}+ veterinary professionals`
}

export function HeroSection({ exampleArticle, stats }: HeroSectionProps) {
  return (
    <div className="bg-gradient-to-b from-[#3D7A5F]/5 to-white dark:from-[#3D7A5F]/10 dark:to-[#0F0F0F] border-b border-[#3D7A5F]/10 dark:border-[#4E9A78]/10">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
        {/* Headline */}
        <h1 className="text-3xl md:text-5xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4 text-center">
          Evidence-based veterinary research, distilled.
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-8 text-center max-w-3xl mx-auto">
          Clinical bottom lines from {stats.articles_count.toLocaleString()}+ peer-reviewed articles —
          so you spend less time searching and more time treating.
        </p>

        {/* Example Article Card */}
        {exampleArticle && (
          <div className="mb-8 bg-white dark:bg-[#1A1A1A] rounded-lg border border-[#3D7A5F]/20 dark:border-[#4E9A78]/20 p-6 shadow-sm">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              {exampleArticle.source_journal}
            </div>
            <h3 className="text-lg font-semibold text-[#3D7A5F] dark:text-[#4E9A78] mb-3">
              {exampleArticle.title}
            </h3>
            {exampleArticle.clinical_bottom_line && (
              <div className="flex gap-2 items-start">
                <span className="text-emerald-500 text-sm mt-1">●</span>
                <div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    Clinical Bottom Line
                  </span>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">
                    {exampleArticle.clinical_bottom_line}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-8 py-3 font-semibold transition-colors text-center"
          >
            Create Free Account →
          </Link>
          <a
            href="#articles"
            className="inline-flex items-center justify-center gap-2 bg-white dark:bg-[#1A1A1A] text-[#3D7A5F] dark:text-[#4E9A78] border border-[#3D7A5F]/30 dark:border-[#4E9A78]/30 hover:border-[#3D7A5F] dark:hover:border-[#4E9A78] rounded-lg px-8 py-3 font-semibold transition-colors text-center"
          >
            Browse articles ↓
          </a>
        </div>

        {/* Trust Line */}
        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Free forever · No credit card · Built by a DVM
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatUserCount(stats.confirmed_users)}
          </p>
        </div>
      </div>
    </div>
  )
}
