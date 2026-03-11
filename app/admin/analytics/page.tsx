import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles, getSessionDuration, getRecentSearches, getDeviceBreakdown, getTopCountries } from '@/app/actions/analytics'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  const days = 7 // Default to 7 days

  const [overview, topPages, visitorsOverTime, topArticles, sessionDuration, recentSearches, deviceBreakdown, topCountries] = await Promise.all([
    getAnalyticsOverview(days),
    getTopPages(days),
    getVisitorsOverTime(days),
    getTopArticles(days),
    getSessionDuration(days),
    getRecentSearches(days),
    getDeviceBreakdown(days),
    getTopCountries(days)
  ])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Analytics
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Track user engagement and content performance
        </p>
      </div>

      {/* Main Content */}
      <AnalyticsClient
        initialOverview={overview.data}
        initialTopPages={topPages.data || []}
        initialVisitorsOverTime={visitorsOverTime.data || []}
        initialTopArticles={topArticles.data || []}
        initialSessionDuration={sessionDuration.data}
        initialRecentSearches={recentSearches.data || []}
        initialDeviceBreakdown={deviceBreakdown.data}
        initialTopCountries={topCountries.data || []}
      />
    </div>
  )
}
