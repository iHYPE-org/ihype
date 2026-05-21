import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { CookieConsent } from '@/components/CookieConsent';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BottomTabBar } from '@/components/BottomTabBar';
import { NavDrawer } from '@/components/NavDrawer';
import { SearchBar } from '@/components/SearchBar';
import { BugReportButton } from '@/components/BugReportButton';
import Link from 'next/link';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PushPrompt } from '@/components/PushPrompt';
import { A2HSPrompt } from '@/components/A2HSPrompt';

const syne = Syne({ subsets: ['latin'], weight: ['600','700','800'], variable: '--font-syne', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-dm', display: 'swap' });
const jbMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-jb', display: 'swap' });

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
    process.env.NEXT_PUBLIC_BASE_URL || 'https://ihype.org'
  )
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable} ${jbMono.variable}`}>
      <body>
        <AppProviders>
          <OfflineBanner />
          <div aria-hidden="true" className="site-background">
            <span className="site-background-orb site-background-orb-a" />
            <span className="site-background-orb site-background-orb-b" />
            <span className="site-background-grid" />
          </div>
          {/* Marketing nav — hidden when .wb-shell is present via CSS */}
          <header aria-label="Primary site header" className="nav site-nav">
            <div className="container nav-inner-marketing">
              <HeaderLogo />
              <SearchBar />
              <ThemeToggle />
              <HeaderAuthLinks />
              <NavDrawer />
            </div>
          </header>
          <div className="site-shell">
            {children}
          </div>
          <MiniPlayer />
          <PushPrompt />
          <A2HSPrompt />
          <BottomTabBar />
          <BugReportButton />
          <PwaInstallPrompt />
          <CookieConsent />
          <ServiceWorkerRegister />
          <footer className="site-footer" style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '24px 0', marginTop: 40 }}>
            <div className="container" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center', justifyContent: 'center', fontSize: 13, opacity: 0.65 }}>
              <Link href="/about">About</Link>
              <Link href="/transparency">Transparency</Link>
              <Link href="/discover?tab=fans">Leaderboard</Link>
              <Link href="/advertise">Advertise</Link>
              <Link href="/status">Status</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/dmca">DMCA</Link>
              <Link href="/playlists">Playlists</Link>
              <Link href="/collab">Collab</Link>
              <Link href="/feedback">Feedback</Link>
              <span>© {new Date().getFullYear()} iHYPE — not-for-profit</span>
            </div>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
