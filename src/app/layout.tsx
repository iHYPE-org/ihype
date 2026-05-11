import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { HeaderMediaPlayer } from '@/components/GlobalMediaPlayer';
import { AppProviders } from '@/components/AppProviders';
import { HeaderAuthLinks } from '@/components/HeaderAuthLinks';
import { HeaderLogo } from '@/components/HeaderLogo';
import { NavPrimaryLinks } from '@/components/NavPrimaryLinks';

export const metadata: Metadata = {
  title: {
    default: 'iHYPE.org',
    template: '%s · iHYPE'
  },
  description: 'Streaming-first music discovery for artists, promoters, venues, and fans.',
  openGraph: {
    siteName: 'iHYPE',
    type: 'website',
    title: 'iHYPE.org',
    description: 'Streaming-first music discovery for artists, promoters, venues, and fans.',
  },
  twitter: {
    card: 'summary',
    title: 'iHYPE.org',
    description: 'Streaming-first music discovery for artists, promoters, venues, and fans.',
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org'
  )
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          <div aria-hidden="true" className="site-background">
            <span className="site-background-orb site-background-orb-a" />
            <span className="site-background-orb site-background-orb-b" />
            <span className="site-background-grid" />
          </div>
          <div className="site-shell">
            <header aria-label="Primary site header" className="nav">
              <div className="container nav-inner">
                <HeaderLogo />
                <NavPrimaryLinks />
                <div className="nav-player-slot nav-player-slot-centered">
                  <HeaderMediaPlayer />
                </div>
                <HeaderAuthLinks />
              </div>
            </header>
            {children}
            <footer className="site-footer">
              <div className="container">
                <nav className="site-footer-nav">
                  <a href="/integrity">Integrity & Transparency</a>
                  <a href="/shows">Shows</a>
                  <a href="/artists">Artists</a>
                  <a href="/venues">Venues</a>
                </nav>
                <p className="meta">© {new Date().getFullYear()} iHYPE.org · Streaming-first music discovery</p>
              </div>
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
