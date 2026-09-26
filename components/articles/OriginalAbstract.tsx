'use client'

import { useId, useState } from 'react'

type Props = {
  articleId: string
  pubmedId: string | null
  doi: string | null
  journal: string | null
  year: string | null
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; abstract: string | null; fetchedAt: string | null }

// Structured abstracts are stored as "LABEL: text" paragraphs (pubmed-abstract.js)
function splitLabel(para: string): { label: string | null; text: string } {
  const m = para.match(/^([A-Z][A-Z0-9 ,&/()-]{1,60}):\s+([\s\S]*)$/)
  return m ? { label: m[1], text: m[2] } : { label: null, text: para }
}

/**
 * Collapsed "Original abstract" section on the article page. Loads the source abstract
 * from PubMed (stored in articles.abstract) on first open only, and always shows where it
 * came from: abstracts are usually the publisher's copyright, reproduced with attribution
 * and a link to the record, the way PubMed-based reference tools do.
 */
export function OriginalAbstract({ articleId, pubmedId, doi, journal, year }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ status: 'idle' })
  const panelId = useId()

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && (state.status === 'idle' || state.status === 'error')) {
      setState({ status: 'loading' })
      try {
        const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/abstract`)
        if (!res.ok) throw new Error(String(res.status))
        const json = await res.json()
        setState({ status: 'ready', abstract: json.abstract ?? null, fetchedAt: json.fetchedAt ?? null })
      } catch {
        setState({ status: 'error' })
      }
    }
  }

  const retrieved =
    state.status === 'ready' && state.fetchedAt
      ? new Date(state.fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null
  const source = [journal, year].filter(Boolean).join(', ')

  return (
    <div style={{ marginTop: 28 }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="original-abstract-toggle"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
          font: "600 11px/1 var(--font-instrument, sans-serif)",
          letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--al-mut4)',
          textAlign: 'left',
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease', flexShrink: 0 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
        </svg>
        Original abstract
      </button>

      {/* Always mounted (hidden when closed) so aria-controls points at a real element */}
      <div id={panelId} hidden={!open} data-testid="original-abstract-panel" style={{ paddingTop: 14 }}>
          {/* Loading / error announced to screen readers */}
          <p role="status" style={{ margin: 0, font: "400 14px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
            {state.status === 'loading' && 'Loading…'}
            {state.status === 'error' && 'The abstract couldn\u2019t be loaded. Close and reopen to try again.'}
          </p>
          {state.status === 'ready' && !state.abstract && (
            <p style={{ margin: 0, font: "400 14px/1.6 var(--font-instrument, sans-serif)", color: 'var(--al-mut4)' }}>
              No abstract is available for this article.
            </p>
          )}
          {state.status === 'ready' && state.abstract && (
            <>
              {state.abstract.split(/\n\n+/).filter(Boolean).map((para, i) => {
                const { label, text } = splitLabel(para)
                return (
                  <p key={i} style={{
                    margin: '0 0 14px',
                    font: "400 15px/1.7 var(--font-instrument, sans-serif)",
                    color: 'var(--al-body)',
                  }}>
                    {label && <strong style={{ fontWeight: 600, color: 'var(--al-ink2)' }}>{label}: </strong>}
                    {text}
                  </p>
                )
              })}
              <p data-testid="original-abstract-attribution" style={{
                margin: '4px 0 0',
                font: "400 12px/1.6 var(--font-instrument, sans-serif)",
                color: 'var(--al-mut4)',
              }}>
                Abstract{source ? ` from ${source}` : ''}, © the publisher.
                {retrieved ? ` Retrieved from PubMed on ${retrieved}.` : ' Retrieved from PubMed.'}
                {pubmedId && (
                  <>
                    {' '}
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--al-accent)' }}>
                      View on PubMed
                    </a>
                  </>
                )}
                {doi && (
                  <>
                    {' · '}
                    <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--al-accent)' }}>
                      DOI
                    </a>
                  </>
                )}
              </p>
            </>
          )}
      </div>
    </div>
  )
}
