import { Article } from '@/lib/supabase'
import { FeedView } from '@/types/search'
import { ArticleCard } from './ArticleCard'
import { StreamRow } from './StreamRow'
import { ZeroResultsCTA } from './ZeroResultsCTA'

type ArticleListProps = {
  articles: Article[]
  searchQuery?: string
  view?: FeedView
  totalCount?: number
}

export function ArticleList({ articles, searchQuery, view = 'stream', totalCount }: ArticleListProps) {
  if (articles.length === 0) {
    if (searchQuery) {
      return <ZeroResultsCTA searchQuery={searchQuery} />
    }
    return (
      <div style={{ maxWidth: view === 'list' ? 844 : 704, margin: '0 auto', padding: '34px 32px' }}>
        <p style={{
          fontFamily: 'var(--font-spectral, serif)',
          fontStyle: 'italic', fontSize: 16, fontWeight: 400,
          color: 'var(--al-mut3)', textAlign: 'center',
        }}>
          No articles found. Try adjusting your filters.
        </p>
      </div>
    )
  }

  if (view === 'stream') {
    return (
      <div style={{ maxWidth: 704, margin: '0 auto', padding: '34px 32px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-spectral, serif)',
            fontSize: 30, fontWeight: 500, lineHeight: 1.1,
            color: 'var(--al-ink2)', letterSpacing: '-.01em',
          }}>
            The bottom line
          </h1>
          <span style={{
            fontFamily: 'var(--font-instrument, sans-serif)',
            fontSize: 12.5, fontWeight: 400, lineHeight: 1,
            color: 'var(--al-mut6)',
          }}>
            Newest first
          </span>
        </div>

        {searchQuery ? (
          <p style={{
            margin: '0 0 30px',
            fontFamily: 'var(--font-instrument, sans-serif)',
            fontSize: 14.5, fontWeight: 400, lineHeight: 1.5,
            color: 'var(--al-mut3)',
          }}>
            <span style={{ color: 'var(--al-accent)', fontWeight: 600 }}>{articles.length} results</span>{' '}
            for &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <p style={{
            margin: '0 0 30px',
            fontFamily: 'var(--font-spectral, serif)',
            fontStyle: 'italic', fontSize: 15, fontWeight: 400, lineHeight: 1.5,
            color: 'var(--al-mut3)',
          }}>
            Every study, distilled to the one thing you need to know.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {articles.map(article => (
            <StreamRow key={article.id} article={article} />
          ))}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div style={{ maxWidth: 844, margin: '0 auto', padding: '30px 32px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <span style={{
            fontFamily: 'var(--font-spectral, serif)',
            fontSize: 26, fontWeight: 600, lineHeight: 1,
            color: 'var(--al-ink2)',
          }}>
            {(totalCount ?? articles.length).toLocaleString()}
          </span>
          <span style={{
            fontFamily: 'var(--font-spectral, serif)',
            fontSize: 15, fontWeight: 400, lineHeight: 1,
            color: 'var(--al-mut2)', marginLeft: 7,
          }}>
            articles
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-instrument, sans-serif)',
          fontSize: 12.5, fontWeight: 400, lineHeight: 1,
          color: 'var(--al-mut6)',
        }}>
          Detailed view · full metadata
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  )
}
