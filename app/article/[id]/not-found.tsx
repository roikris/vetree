import Link from 'next/link'

export default function ArticleNotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Article Not Found
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          We couldn't find the article you're looking for. It may have been removed or the link may be incorrect.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white hover:bg-[#2F5F4A] dark:hover:bg-[#5FAA88] rounded-lg px-6 py-3 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Search
        </Link>
      </div>
    </div>
  )
}
