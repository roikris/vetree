import { getAnalyticsOverview, getTopPages, getVisitorsOverTime, getTopArticles, getSessionDuration, getRecentSearches, getDeviceBreakdown, getTopCountries, getSavedArticlesStats, getTrafficSources, getSynthesisStats, getSaveIntentFunnel, getBotTraffic, getAnalyticsCleanupDate } from '@/app/actions/analytics'
import { AnalyticsClient } from './AnalyticsClient'
import { UserRetention } from './UserRetention'
import { AnalysisAgent } from './AnalysisAgent'
import { LinkedInSection } from './LinkedInSection'
import { PaidCampaigns } from './PaidCampaigns'

export default async function AdminAnalyticsPage() {
  const days = 7 // Default to 7 days

  const [overview, topPages, visitorsOverTime, topArticles, sessionDuration, recentSearches, deviceBreakdown, topCountries, savedArticlesStats, trafficSources, synthesisStats, saveIntentFunnel, botTraffic, cleanup] = await Promise.all([
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
    getBotTraffic(days),
    getAnalyticsCleanupDate(),
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

      {cleanup.data && (
        <p style={{
          margin: '0 0 20px', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(var(--al-warnc, 176,120,40), .08)', color: 'var(--al-sub)',
          fontFamily: 'var(--font-instrument, sans-serif)', fontSize: 12.5, lineHeight: 1.5,
        }}>
          Analytics cleanup on {cleanup.data}: synthesis events were moved out of page views, so the
          live page-view charts here no longer include them for any date, and synthesis runs with
          evidence of test traffic (CI run windows, a local test burst) are excluded; other runs
          from those days are still counted. Daily snapshots taken before {cleanup.data} (DAU/WAU/MAU,
          devices, traffic sources, synthesis counts) and insights or signals generated from them
          were not rewritten and still include the synthetic rows.
        </p>
      )}

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
        initialBotTraffic={botTraffic.data || null}
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

      <div style={{ marginTop: 32 }}>
        <PaidCampaigns />
      </div>
    </div>
  )
}
