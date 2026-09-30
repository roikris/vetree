import type { Metadata, Viewport } from "next";
import { getVisibleArticleCount, formatArticleCount } from "@/lib/queries/publicStats";
import { Spectral, Instrument_Sans } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import { PageTracker } from '@/components/PageTracker';
import { PWARegister } from '@/components/PWARegister';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { ConsentGate } from '@/components/ConsentGate';
import { DigestConsentPrompt } from '@/components/DigestConsentPrompt';
import { TrackingConsent } from '@/components/consent/TrackingConsent';
import "./globals.css";

// Ad-platform pixels for paid campaign tracking (LinkedIn + Facebook). Since 2026-09-30 they load
// ONLY after the visitor accepts optional cookies (components/consent/TrackingConsent) — Israeli
// PPA consent guidance / ePrivacy. Both are no-ops when their env var isn't set.
const LINKEDIN_PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Article count from the same cached source as the landing page (lib/queries/publicStats),
// so the description never overstates it (it had drifted to "15,000+" while the landing page
// said "23,000+"; 20,805 were visible on 2026-09-28).
export async function generateMetadata(): Promise<Metadata> {
  const n = formatArticleCount(await getVisibleArticleCount()) ?? 'thousands of'
  return {
  title: 'Vetree — Evidence-Based Veterinary Research',
  description: `AI-powered summaries of peer-reviewed veterinary research. Search ${n} articles from top journals and get the clinical bottom line instantly. Free for veterinary professionals.`,
  metadataBase: new URL('https://vetree.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Vetree — Evidence-Based Veterinary Research',
    description: `AI-powered summaries of peer-reviewed veterinary research. Get the clinical bottom line from ${n} articles instantly.`,
    url: 'https://vetree.app',
    siteName: 'Vetree',
    type: 'website',
    images: [{
      url: 'https://vetree.app/icons/icon-512x512.png',
      width: 512,
      height: 512,
      alt: 'Vetree — Veterinary Research Platform',
    }],
  },
  twitter: {
    card: 'summary',
    title: 'Vetree — Evidence-Based Veterinary Research',
    description: `AI-powered clinical summaries from ${n} peer-reviewed veterinary articles.`,
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vetree',
  },
}
}


export const viewport: Viewport = {
  themeColor: '#8FCB5E',
  width: 'device-width',
  initialScale: 1,
  // No maximumScale: it blocked pinch-zoom. iOS focus-zoom is prevented by 16px form fields
  // on phone widths instead (app/globals.css).
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vetree" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const darkMode = localStorage.getItem('darkMode');
                  if (darkMode === 'true') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${spectral.variable} ${instrumentSans.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <PWARegister />
        <PageTracker />
        <ConsentGate />
        <DigestConsentPrompt />
        <main id="main-content">
          {children}
        </main>
        <PWAInstallPrompt />
        <Analytics />

        {/* LinkedIn / Meta pixels and Sentry session replay load only after the visitor accepts */}
        <TrackingConsent linkedinPartnerId={LINKEDIN_PARTNER_ID} fbPixelId={FB_PIXEL_ID} />
      </body>
    </html>
  );
}
