import Link from 'next/link'
import { Article } from '@/lib/supabase'
import { getLabelHue } from '@/lib/constants/labelColors'
import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'
import { BookmarkButton } from './BookmarkButton'
import { ShareButton } from './ShareButton'
import { LazySummary } from './LazySummary'

function parseLabels(labels: string[] | null | undefined): string[] {
  if (!labels || !Array.isArray(labels)) return []
  const result: string[] = []
  for (const label of labels) {
    if (typeof label === 'string') {
      const cleaned = label.replace(/[\[\]"\\]/g, '').trim()
      if (cleaned) result.push(...cleaned.split(',').map(l => l.trim()).filter(Boolean))
    }
  }
  return result
}

type ArticleCardProps = {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  const cleanLabels = parseLabels(article.labels)

  const level = getEvidenceLevel(article.strength_of_evidence, cleanLabels)
  const { label: evLabel, hue: evHue, dot: evDot } = getEvidenceBadgeProps(level)

  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : ''

  const footerLineStyle: React.CSSProperties = {
    paddingTop: 15,
    borderTop: '1px solid rgba(var(--al-line, 232,224,204), .08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  }

  return (
    <article className="al-card" style={{ padding: '26px 28px' }} data-onboarding="article-card" data-testid="article-card">

      {/* Top row: journal + date | share + bookmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          {article.source_journal && (
            <span style={{
              fontFamily: 'var(--font-instrument, sans-serif)',
              fontSize: 11, fontWeight: 600, lineHeight: 1,
              letterSpacing: '.12em', textTransform: 'uppercase',
              color: 'var(--al-accent)',
            }}>
              {article.source_journal}
            </span>
          )}
          {article.source_journal && date && (
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--al-mut7)', display: 'inline-block' }} />
          )}
          {date && (
            <span style={{
              fontFamily: 'var(--font-instrument, sans-serif)',
              fontSize: 12, fontWeight: 400, lineHeight: 1,
              color: 'var(--al-mut4)',
            }}>
              {date}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <ShareButton
            articleId={article.id}
            title={article.title}
            clinicalBottomLine={article.clinical_bottom_line || undefined}
          />
          <BookmarkButton articleId={article.id} />
        </div>
      </div>

      {/* Title */}
      <Link href={`/article/${article.id}`} style={{ textDecoration: 'none' }}>
        <h3 style={{
          margin: '0 0 11px',
          fontFamily: 'var(--font-spectral, serif)',
          fontSize: 21, fontWeight: 600, lineHeight: 1.3,
          color: 'var(--al-ink2)',
          letterSpacing: '-.005em',
          cursor: 'pointer',
          transition: 'color .15s ease',
        }}>
          {article.title}
        </h3>
      </Link>

      {/* Authors */}
      {article.authors && (
        <p style={{
          margin: '0 0 16px',
          fontFamily: 'var(--font-instrument, sans-serif)',
          fontSize: 13, fontWeight: 400, lineHeight: 1.4,
          color: 'var(--al-mut4)',
        }}>
          {article.authors}
        </p>
      )}

      {/* Clinical bottom line pull-quote */}
      {article.clinical_bottom_line && (
        <div style={{ borderLeft: '2px solid var(--al-accent)', padding: '2px 0 2px 18px', marginBottom: 16 }}>
          <div style={{
            fontFamily: 'var(--font-instrument, sans-serif)',
            fontSize: 10.5, fontWeight: 600, lineHeight: 1,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'var(--al-accent)', marginBottom: 8,
          }}>
            Clinical bottom line
          </div>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-spectral, serif)',
            fontStyle: 'italic', fontSize: 16, fontWeight: 500, lineHeight: 1.55,
            color: 'var(--al-ink4)',
          }}>
            {article.clinical_bottom_line}
          </p>
        </div>
      )}

      {/* Evidence tier chip */}
      <div style={{ marginBottom: 15 }}>
        <span
          className="al-ev-chip"
          style={{ '--ev-h': evHue, '--ev-dot': evDot } as React.CSSProperties}
        >
          <span className="al-ev-dot" />
          {evLabel}
        </span>
      </div>

      {/* Summary — lazy loaded */}
      <LazySummary articleId={article.id} initialSummary={article.summary} />

      {/* Footer: label chips + read full article */}
      {(cleanLabels.length > 0 || article.article_url) && (
        <div style={footerLineStyle}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cleanLabels.map((label, i) => (
              <span
                key={i}
                className="al-chip"
                style={{ '--chip-h': getLabelHue(label) } as React.CSSProperties}
              >
                {label}
              </span>
            ))}
          </div>
          {article.article_url && (
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-instrument, sans-serif)',
                fontSize: 13.5, fontWeight: 600, lineHeight: 1,
                color: 'var(--al-accent)', textDecoration: 'none',
              }}
            >
              Read full article
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          )}
        </div>
      )}
    </article>
  )
}
