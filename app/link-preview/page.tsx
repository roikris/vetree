import type { Metadata } from 'next'
import Link from 'next/link'

// What Meta's link-preview fetchers get for "/" (lib/metaPreview.ts, next.config.ts rewrites). The root layout's title,
// description, canonical "/", Open Graph and Twitter tags are the home page's, word for word. Its only own tag:
// noindex — the page itself is not for search results (Googlebot is never rewritten here; previews ignore it).
export const metadata: Metadata = { robots: { index: false, follow: true } }
// Static (prerendered, refreshed with the layout's cached article count) — never a per-request render.
export default function LinkPreview() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Vetree — Evidence-Based Veterinary Research</h1>
      <p className="mt-4">
        <Link href="/" prefetch={false} className="underline">Open Vetree</Link>
      </p>
    </main>
  )
}
