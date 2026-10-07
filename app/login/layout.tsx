import type { Metadata } from 'next'

// Sign-in forms have nothing to index: without this Google reported /login as a "soft 404"
// (Search Console, 2026-10-07). follow stays on so its links are still crawled.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
