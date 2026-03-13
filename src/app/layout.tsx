import './globals.css';
import Link from 'next/link';
import { ReactNode } from 'react';
import { auth, signOut } from '@/lib/auth';
import { HeaderMediaPlayer, MediaPlayerProvider } from '@/components/GlobalMediaPlayer';

export const metadata = {
  title: 'iHYPE.org',
  description: 'Streaming-first music discovery for artists, promoters, venues, and listeners.'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <MediaPlayerProvider>
          <header className="nav">
            <div className="container nav-inner">
              <Link href="/" className="nav-logo nav-logo-left" aria-label="iHYPE.org home">
                <span className="nav-logo-word">iHYPE</span>
                <span className="nav-logo-dot">.org</span>
              </Link>
              <div className="nav-player-slot nav-player-slot-centered">
                <HeaderMediaPlayer />
              </div>
              <div className="nav-links nav-links-auth nav-links-compact nav-auth-slot">
                {session?.user ? (
                  <>
                    <Link href="/dashboard">Dashboard</Link>
                    <span className="nav-divider">|</span>
                    <form
                      action={async () => {
                        'use server';
                        await signOut({ redirectTo: '/' });
                      }}
                    >
                      <button className="nav-text-button" type="submit">
                        Sign Out
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/login">Sign In</Link>
                    <span className="nav-divider">|</span>
                    <Link href="/register">Sign Up</Link>
                  </>
                )}
              </div>
            </div>
          </header>
          {children}
          <footer className="footer container">
            iHYPE.org production starter. Streaming-first music discovery, because the internet apparently needed more
            late-night dashboards. <Link href="/launch-readiness">Launch readiness</Link>{' '}
            <Link href="/integrity">Integrity</Link>
          </footer>
        </MediaPlayerProvider>
      </body>
    </html>
  );
}
