import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles, getSessionDuration, getRecentSearches, getDeviceBreakdown, getTopCountries, getSavedArticlesStats, getTrafficSources, getSynthesisStats, getSaveIntentFunnel } from '@/app/actions/analytics'
import { AnalyticsClient } from './AnalyticsClient'
import { UserRetention } from './UserRetention'
import { AnalysisAgent } from './AnalysisAgent'
import { LinkedInSection } from './LinkedInSection'

export default async function AdminAnalyticsPage() {
  const days = 7 // Default to 7 days

  const [overview, topPages, visitorsOverTime, topArticles, sessionDuration, recentSearches, deviceBreakdown, topCountries, savedArticlesStats, trafficSources, synthesisStats, saveIntentFunnel] = await Promise.all([
    getAnalyticsOverview(days),
    getTopPages(days),
    getVisitorsOverTime(days),
    getTopArticles(days),
    getSessionDuration(days),
    getRecentSearches(days),
    getDeviceBreakdown(days),
    getTopCountries(days),
    getSavedArticlesStats(days),
    getTrafficSources(days),
    getSynthesisStats(days),
    getSaveIntentFunnel(days),
  ])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--al-bg)', padding: '36px 36px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-spectral, serif)', fontSize: 28, fontWeight: 600,
          lineHeight: 1.1, color: 'var(--al-ink2)', letterSpacing: '-.01em',
        }}>
          Analytics
        </h1>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-spectral, serif)', fontStyle: 'italic', fontSize: 14, fontWeight: 400,
          color: 'var(--al-mut3)', lineHeight: 1.4,
        }}>
          How the practice is reading — traffic, sessions and search.
        </p>
      </div>

      <AnalyticsClient
        initialOverview={overview.data}
        initialTopPages={topPages.data || []}
        initialVisitorsOverTime={visitorsOverTime.data || []}
        initialTopArticles={topArticles.data || []}
        initialSessionDuration={sessionDuration.data}
        initialRecentSearches={recentSearches.data || []}
        initialDeviceBreakdown={deviceBreakdown.data}
        initialTopCountries={topCountries.data || []}
        initialSavedArticlesStats={savedArticlesStats.data}
        initialTrafficSources={trafficSources.data || []}
        initialSynthesisStats={synthesisStats.data || null}
        initialSaveIntentFunnel={saveIntentFunnel.data || null}
      />

      <div style={{ marginTop: 32 }}>
        <UserRetention />
      </div>

      <div style={{ marginTop: 32 }}>
        <AnalysisAgent />
      </div>

      <div style={{ marginTop: 32 }}>
        <LinkedInSection />
      </div>
    </div>
  )
}
