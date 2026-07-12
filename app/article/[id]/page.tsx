import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createPublicClient } from '@supabase/supabase-js'
import { Article } from '@/lib/supabase'
import { ArticleViewTracker } from '@/components/articles/ArticleViewTracker'
import { RegistrationWall } from '@/components/ui/RegistrationWall'
import { SoftRegistrationPrompt } from '@/components/articles/SoftRegistrationPrompt'
import { ArticleAppBar } from '@/components/articles/ArticleAppBar'
import { SaveIntentHandler } from '@/components/articles/SaveIntentHandler'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getEvidenceLevel, getEvidenceBadgeProps } from '@/lib/utils/evidenceBadge'
import { getLabelHue } from '@/lib/constants/labelColors'

type PageProps = {
  params: Promise<{ id: string }>
}

// Pre-build 100 newest enriched articles at deploy time
export async function generateStaticParams() {
  const supabase = createPublicClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .order('publication_date', { ascending: false })
    .limit(100)

  return (data || []).map((article) => ({ id: article.id }))
}

// Allow on-demand generation for articles not in top 100
export const dynamicParams = true

// Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400

async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .single()

  if (error || !data) {
    return null
  }

  return data as Article
}

async function getRelatedArticles(labels: string[] | null, currentArticleId: string): Promise<Article[]> {
  if (!labels || labels.length === 0) return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('articles')
    .select('id, title, clinical_bottom_line, labels, source_journal, publication_date, strength_of_evidence, authors, article_url, doi, pubmed_id')
    .neq('id', currentArticleId)
    .eq('needs_enrichment', false)
    .not('summary', 'is', null)
    .not('clinical_bottom_line', 'is', null)
    .or('quarantined.is.null,quarantined.eq.false')
    .overlaps('labels', labels)
    .order('publication_date', { ascending: false })
    .limit(6)

  const LARGE_ANIMAL = ['Equine','equine','Large Animal','large animal','Livestock','livestock','Poultry','poultry','Food Animal','food animal']
  const filtered = ((data || []) as Article[]).filter(a => !a.labels?.some((l: string) => LARGE_ANIMAL.includes(l)))
  return filtered.slice(0, 2)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    return { title: 'Article Not Found - Vetree' }
  }

  const description = article.clinical_bottom_line
    ? article.clinical_bottom_line.substring(0, 160)
    : article.summary?.substring(0, 160) || 'Veterinary research article on Vetree'

  const shortTitle = article.title.length > 50
    ? article.title.slice(0, 50) + '…'
    : article.title

  return {
    title: shortTitle,
    description,
    alternates: { canonical: `/article/${id}` },
    openGraph: {
      title: article.title,
      description,
      url: `https://vetree.app/article/${id}`,
      siteName: 'Vetree',
      images: [{ url: `https://vetree.app/article/${id}/opengraph-image`, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      images: [`https://vetree.app/article/${id}/opengraph-image`],
    },
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  const relatedArticles = await getRelatedArticles(article.labels, article.id)

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "headline": article.title,
    "description": article.clinical_bottom_line || article.summary,
    "datePublished": article.publication_date,
    "publisher": { "@type": "Organization", "name": article.source_journal || "Unknown Journal" },
    "about": article.labels?.map(label => ({ "@type": "MedicalCondition", "name": label })),
    "url": `https://vetree.app/article/${article.id}`,
    "isAccessibleForFree": true,
    "inLanguage": "en",
  }

  const evidenceLevel = getEvidenceLevel(article.strength_of_evidence, article.labels)
  const evidenceBadge = getEvidenceBadgeProps(evidenceLevel)

  // Estimate read time from summary word count
  const wordCount = article.summary ? article.summary.split(/\s+/).length : 0
  const readMins = Math.max(2, Math.ceil(wordCount / 200))

  // Split summary into paragraphs
  const summaryParagraphs = article.summary
    ? article.summary.split(/\n\n+/).filter(Boolean)
    : []

  // Format publication date
  const pubDate = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Primary label for specialty chip
  const primaryLabel = article.labels?.[0] ?? null
  const primaryHue = primaryLabel ? getLabelHue(primaryLabel) : null

  const articleHref = article.article_url || (article.doi ? `https://doi.org/${article.doi}` : null)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <ArticleViewTracker isLoggedIn={isLoggedIn} />
      {!isLoggedIn && <RegistrationWall />}
      <SaveIntentHandler articleId={article.id} relatedArticles={relatedArticles} />

      {/* Article-specific app bar */}
      <ArticleAppBar
        articleId={article.id}
        articleUrl={articleHref}
        articleTitle={article.title}
      />

      {/* Body */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '44px 32px 90px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 316px', gap: 52, alignItems: 'start' }}>

          {/* ===== MAIN READING COLUMN ===== */}
          <article style={{ minWidth: 0 }}>

            {/* Chips row: specialty + evidence + read time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {primaryLabel && primaryHue && (
                <span className="al-chip" style={{ '--chip-h': primaryHue } as React.CSSProperties}>
                  {primaryLabel}
                </span>
              )}
              <span className="al-ev-chip" style={{ '--ev-h': evidenceBadge.hue, '--ev-dot': evidenceBadge.dot } as React.CSSProperties}>
                <span className="al-ev-dot" />
                {evidenceBadge.label}
              </span>
              <span style={{ font: "400 12.5px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)' }}>
                {readMins} min read · distilled by Vetree AI
              </span>
            </div>

            {/* Title */}
            <h1 data-testid="article-title" style={{
              margin: '0 0 18px',
              font: "600 38px/1.18 var(--font-spectral, serif)",
              color: 'var(--al-ink2)', letterSpacing: '-.015em',
            }}>
              {article.title}
            </h1>

            {/* Byline */}
            <p style={{
              margin: '0 0 32px',
              font: "400 14.5px/1.5 var(--font-instrument, sans-serif)",
              color: 'var(--al-mut2)',
            }}>
              {article.authors && <>{article.authors} · </>}
              {article.source_journal && (
                <span style={{ color: 'var(--al-mut3)' }}>{article.source_journal}</span>
              )}
              {pubDate && <> · {pubDate}</>}
            </p>

            {/* Clinical bottom line hero */}
            <div data-testid="clinical-bottom-line" style={{
              background: 'linear-gradient(135deg,rgba(var(--al-acct),0.12),rgba(var(--al-acct),0.04))',
              border: '1px solid rgba(var(--al-acct),0.28)',
              borderRadius: 18, padding: '28px 30px', marginBottom: 38,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--al-accent)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
                </svg>
                <span style={{
                  font: "600 11px/1 var(--font-instrument, sans-serif)",
                  letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-accent)',
                }}>
                  Clinical bottom line
                </span>
              </div>
              <p style={{
                margin: 0,
                font: "500 24px/1.5 var(--font-spectral, serif)",
                color: 'var(--al-ink2)', letterSpacing: '-.005em',
              }}>
                {article.clinical_bottom_line}
              </p>
            </div>

            {/* Summary */}
            {summaryParagraphs.length > 0 && (
              <div style={{ marginBottom: 38 }}>
                <div style={{
                  font: "600 11px/1 var(--font-instrument, sans-serif)",
                  letterSpacing: '.15em', textTransform: 'uppercase',
                  color: 'var(--al-mut4)', marginBottom: 16,
                }}>
                  Summary
                </div>
                {summaryParagraphs.map((para, i) => (
                  <p key={i} style={{
                    margin: i < summaryParagraphs.length - 1 ? '0 0 18px' : 0,
                    font: "400 16.5px/1.75 var(--font-instrument, sans-serif)",
                    color: 'var(--al-body)',
                  }}>
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Label chips */}
            {article.labels && article.labels.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, marginBottom: 36 }}>
                {article.labels.map(label => {
                  const hue = getLabelHue(label)
                  return (
                    <Link
                      key={label}
                      href={`/?labels=${encodeURIComponent(label)}`}
                      className="al-chip"
                      style={{ '--chip-h': hue, textDecoration: 'none' } as React.CSSProperties}
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}

            {/* AI disclaimer (verbatim) */}
            <div style={{
              display: 'flex', gap: 13,
              background: 'rgba(var(--al-warnc),0.07)',
              border: '1px solid rgba(var(--al-warnc),0.22)',
              borderRadius: 13, padding: '16px 18px',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E0A040" strokeWidth="1.8" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="9"/>
                <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1"/>
              </svg>
              <p style={{
                margin: 0,
                font: "400 12.5px/1.6 var(--font-instrument, sans-serif)",
                color: 'var(--al-warntext)',
              }}>
                This summary was distilled by AI and may occasionally misinterpret data. Confirm critical details with the primary literature before clinical application.
              </p>
            </div>
          </article>

          {/* ===== STICKY RAIL ===== */}
          <aside style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Read full article button */}
            {articleHref ? (
              <a
                href={articleHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  background: 'var(--al-accent)', color: 'var(--al-onaccent)',
                  borderRadius: 12, padding: 15,
                  font: "600 14.5px/1 var(--font-instrument, sans-serif)",
                  textDecoration: 'none',
                }}
              >
                Read full article
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8"/>
                </svg>
              </a>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(var(--al-acct),0.15)', color: 'var(--al-mut3)',
                borderRadius: 12, padding: 15,
                font: "600 14.5px/1 var(--font-instrument, sans-serif)",
              }}>
                Full article unavailable
              </div>
            )}

            {/* Citation card */}
            <div style={{
              background: 'var(--al-card)', border: '1px solid rgba(var(--al-line),0.1)',
              borderRadius: 16, padding: '20px 22px',
            }}>
              <div style={{
                font: "600 10.5px/1 var(--font-instrument, sans-serif)",
                letterSpacing: '.14em', textTransform: 'uppercase',
                color: 'var(--al-mut4)', marginBottom: 16,
              }}>
                Citation
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {article.source_journal && (
                  <div>
                    <div style={{ font: "500 11px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginBottom: 3 }}>Journal</div>
                    <div style={{ font: "italic 500 14px/1.35 var(--font-spectral, serif)", color: 'var(--al-ink4)' }}>
                      {article.source_journal}
                    </div>
                  </div>
                )}
                {pubDate && (
                  <div>
                    <div style={{ font: "500 11px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginBottom: 3 }}>Published</div>
                    <div style={{ font: "400 13.5px/1.35 var(--font-instrument, sans-serif)", color: 'var(--al-body)' }}>
                      {pubDate}
                    </div>
                  </div>
                )}
                {article.doi && (
                  <div>
                    <div style={{ font: "500 11px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginBottom: 3 }}>DOI</div>
                    <a
                      href={`https://doi.org/${article.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ font: "400 13px/1.35 var(--font-instrument, sans-serif)", color: 'var(--al-accent)', wordBreak: 'break-all' }}
                    >
                      {article.doi}
                    </a>
                  </div>
                )}
                {!article.doi && article.pubmed_id && (
                  <div>
                    <div style={{ font: "500 11px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut6)', marginBottom: 3 }}>PubMed</div>
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${article.pubmed_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ font: "400 13px/1.35 var(--font-instrument, sans-serif)", color: 'var(--al-accent)' }}
                    >
                      {article.pubmed_id}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Evidence explainer card */}
            <div style={{
              background: 'var(--al-card)',
              border: `1px solid rgba(${hexToRgb(evidenceBadge.dot)},0.22)`,
              borderRadius: 16, padding: '20px 22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: evidenceBadge.dot, flexShrink: 0 }} />
                <span style={{
                  font: "600 12.5px/1 var(--font-instrument, sans-serif)",
                  color: evidenceBadge.hue,
                }}>
                  {evidenceBadge.label}
                </span>
              </div>
              <p style={{
                margin: 0,
                font: "400 13px/1.6 var(--font-instrument, sans-serif)",
                color: 'var(--al-mut1)',
              }}>
                {evidenceBadge.tooltip}
              </p>
            </div>

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <div style={{
                background: 'var(--al-card2)', border: '1px solid rgba(var(--al-line),0.1)',
                borderRadius: 16, padding: '20px 22px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  {relatedArticles[0]?.labels?.[0] && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: getLabelHue(relatedArticles[0].labels[0]),
                    }} />
                  )}
                  <span style={{
                    font: "600 10.5px/1 var(--font-instrument, sans-serif)",
                    letterSpacing: '.13em', textTransform: 'uppercase',
                    color: 'var(--al-mut3)',
                  }}>
                    Related in your grove
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {relatedArticles.map(rel => {
                    const relEv = getEvidenceBadgeProps(getEvidenceLevel(rel.strength_of_evidence, rel.labels))
                    return (
                      <Link key={rel.id} href={`/article/${rel.id}`} style={{ textDecoration: 'none' }}>
                        <p style={{
                          margin: '0 0 7px',
                          font: "500 13.5px/1.45 var(--font-spectral, serif)",
                          color: 'var(--al-ink4)',
                        }}>
                          {rel.clinical_bottom_line}
                        </p>
                        <div style={{ font: "400 10.5px/1 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
                          <span style={{ color: relEv.hue }}>{relEv.label}</span>
                          {rel.source_journal && <> · {rel.source_journal}</>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {!isLoggedIn && <SoftRegistrationPrompt labels={article.labels} />}
    </>
  )
}

// Utility: convert hex like "#8FD65E" to "143,214,94" for rgba()
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
