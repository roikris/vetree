'use client'

import { CONSENT_COPY, type ConsentLang } from '@/lib/consent/copy'

/** Small link-style button that switches consent wording between English and Hebrew */
export function ConsentLanguageToggle({ lang, onChange }: { lang: ConsentLang; onChange: (l: ConsentLang) => void }) {
  const copy = CONSENT_COPY[lang]
  return (
    <button
      type="button"
      data-testid="consent-language-toggle"
      onClick={() => onChange(lang === 'en' ? 'he' : 'en')}
      aria-label={copy.switchLabel}
      lang={lang === 'en' ? 'he' : 'en'}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        font: '500 12.5px/1 var(--font-instrument, sans-serif)', color: 'var(--al-accent)',
        textDecoration: 'underline', textUnderlineOffset: 3,
      }}
    >
      {copy.switchTo}
    </button>
  )
}
