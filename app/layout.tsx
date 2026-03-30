import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import { PageTracker } from '@/components/PageTracker';
import { PWARegister } from '@/components/PWARegister';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: '#3D7A5F',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vetree',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <PWARegister />
        <PageTracker />
        <main id="main-content">
          {children}
        </main>
        <PWAInstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
