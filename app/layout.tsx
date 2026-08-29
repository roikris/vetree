import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Spectral, Instrument_Sans } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import { PageTracker } from '@/components/PageTracker';
import { PWARegister } from '@/components/PWARegister';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { ConsentGate } from '@/components/ConsentGate';
import { DigestConsentPrompt } from '@/components/DigestConsentPrompt';
import "./globals.css";

// Ad-platform pixels for paid campaign tracking (LinkedIn + Facebook). Loaded
// unconditionally for every visitor, same as Vercel Analytics — deliberate
// call, not gated behind ConsentGate/marketing consent, since most ad
// click-throughs are anonymous first-time visitors who haven't reached that
// flow yet. Both are no-ops when their env var isn't set, so this is safe to
// ship before either ID is configured in Vercel.
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

export const metadata: Metadata = {
  title: 'Vetree — Evidence-Based Veterinary Research',
  description: 'AI-powered summaries of peer-reviewed veterinary research. Search 15,000+ articles from top journals and get the clinical bottom line instantly. Free for veterinary professionals.',
  metadataBase: new URL('https://vetree.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Vetree — Evidence-Based Veterinary Research',
    description: 'AI-powered summaries of peer-reviewed veterinary research. Get the clinical bottom line from 15,000+ articles instantly.',
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
    description: 'AI-powered clinical summaries from 15,000+ peer-reviewed veterinary articles.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vetree',
  },
};

export const viewport: Viewport = {
  themeColor: '#8FCB5E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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

        {LINKEDIN_PARTNER_ID && (
          <>
            <Script id="linkedin-insight-tag" strategy="afterInteractive">
              {`
                _linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
                window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
                window._linkedin_data_partner_ids.push(_linkedin_partner_id);
                (function(l) {
                  if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                  window.lintrk.q=[]}
                  var s = document.getElementsByTagName("script")[0];
                  var b = document.createElement("script");
                  b.type = "text/javascript";b.async = true;
                  b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                  s.parentNode.insertBefore(b, s);
                })(window.lintrk);
              `}
            </Script>
            <noscript>
              <img
                height="1" width="1" style={{ display: 'none' }} alt=""
                src={`https://px.ads.linkedin.com/collect/?pid=${LINKEDIN_PARTNER_ID}&fmt=gif`}
              />
            </noscript>
          </>
        )}

        {FB_PIXEL_ID && (
          <>
            <Script id="facebook-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${FB_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1" width="1" style={{ display: 'none' }} alt=""
                src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
