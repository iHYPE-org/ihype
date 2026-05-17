import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Syne, DM_Sans, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';

const syne = Syne({ subsets: ['latin'], weight: ['600','700','800'], variable: '--font-syne', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-dm', display: 'swap' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-jb', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: ['400'], style: ['normal','italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'iHYPE.org',
    template: '%s · iHYPE'
  },
  description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  openGraph: {
    siteName: 'iHYPE',
    type: 'website',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iHYPE — Independent music built for the scene',
    description: 'Not-for-profit music discovery for artists, promoters, venues, and fans. 0% ticket fees. Free forever.',
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org'
  )
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable} ${jbMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <AppProviders>
          <div aria-hidden="true" className="site-background">
            <span className="site-background-orb site-background-orb-a" />
            <span className="site-background-orb site-background-orb-b" />
            <span className="site-background-grid" />
          </div>
          {/* Marketing nav — hidden when .wb-shell is present via CSS */}
          <header aria-label="Primary site header" className="nav site-nav">
            <div className="container nav-inner-marketing">
              <HeaderLogo />
              <HeaderAuthLinks />
            </div>
          </header>
          <div className="site-shell">
            {children}
          </div>
          <PwaInstallPrompt />
          <footer className="site-footer" style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '24px 0', marginTop: 40 }}>
            <div className="container" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center', justifyContent: 'center', fontSize: 13, opacity: 0.65 }}>
              <a href="/about">About</a>
              <a href="/transparency">Transparency</a>
              <a href="/leaderboard">Leaderboard</a>
              <a href="/advertise">Advertise</a>
              <a href="/status">Status</a>
              <span>© {new Date().getFullYear()} iHYPE — not-for-profit</span>
            </div>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
