import Link from 'next/link'
import type { ReactNode } from 'react'

export type LegalLang = 'en' | 'he'

export function legalLang(raw: string | string[] | undefined): LegalLang {
  return raw === 'he' ? 'he' : 'en'
}

/** The controller's contact point: an email button to the monitored mailbox, subject "privacy" */
export const CONTACT_EMAIL = 'vetree.app@gmail.com'
export const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=privacy`

/**
 * Layout for /privacy and /terms in English and Hebrew (?lang=he). Both language versions are
 * complete documents with the same content; the switch keeps the reader on the same document.
 */
export function LegalShell({ lang, path, title, effectiveDate, children }: {
  lang: LegalLang
  path: '/privacy' | '/terms'
  title: string
  /** Fixed ISO date the current text took effect — never computed at render time */
  effectiveDate: string
  children: ReactNode
}) {
  const he = lang === 'he'
  const date = new Date(`${effectiveDate}T00:00:00Z`).toLocaleDateString(he ? 'he-IL' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0F0F]">
      <div className="max-w-3xl mx-auto px-6 py-12" dir={he ? 'rtl' : 'ltr'} lang={lang}>
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#3D7A5F] dark:text-[#4E9A78] hover:text-[#2F5F4A] dark:hover:text-[#5FAA88] transition-colors"
          >
            <svg className={`w-5 h-5 ${he ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">{he ? 'חזרה ל-Vetree' : 'Back to Vetree'}</span>
          </Link>
          <Link
            href={he ? path : `${path}?lang=he`}
            data-testid="legal-language-toggle"
            lang={he ? 'en' : 'he'}
            dir={he ? 'ltr' : 'rtl'}
            className="text-sm font-medium text-[#3D7A5F] dark:text-[#4E9A78] underline underline-offset-4"
          >
            {he ? 'English' : 'עברית'}
          </Link>
        </div>

        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">{title}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {he ? 'בתוקף מיום' : 'Effective'}: {date}
          </p>
        </div>

        <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-10">{children}</div>
      </div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc ps-6 space-y-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

/** Email button to the controller's monitored mailbox (subject "privacy") */
export function ContactButton({ lang }: { lang: LegalLang }) {
  return (
    <a
      href={CONTACT_HREF}
      data-testid="legal-contact"
      className="inline-flex items-center gap-2 rounded-lg bg-[#3D7A5F] dark:bg-[#4E9A78] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
    >
      {lang === 'he' ? 'שליחת דוא"ל בנושא פרטיות' : 'Email us about privacy'}
      <span dir="ltr" className="font-normal opacity-90">({CONTACT_EMAIL})</span>
    </a>
  )
}
