'use client'

export function AnnouncementBanner() {
  const handleTryIt = () => {
    // Find the search input - try multiple selectors to be robust
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLInputElement

    if (searchInput) {
      // Scroll to search input
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Focus it after a short delay to ensure scroll completes
      setTimeout(() => {
        searchInput.focus()
      }, 500)
    }
  }

  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/50 border border-emerald-700 rounded-full text-sm">
        <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
          NEW
        </span>
        <span className="text-emerald-300">
          Evidence Synthesis — search any clinical topic and get an AI summary of the available research
        </span>
        <button
          onClick={handleTryIt}
          className="text-emerald-400 font-medium cursor-pointer hover:text-white transition"
        >
          Try it →
        </button>
      </div>
    </div>
  )
}
