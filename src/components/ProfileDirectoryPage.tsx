import { ProfileDirectoryBrowser, type DirectoryBrowserProfile } from '@/components/ProfileDirectoryBrowser';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  type DiscoverModuleId,
  type DiscoverRoleKey
} from '@/lib/discover-modules';

type DirectoryProfile = DirectoryBrowserProfile;

function getRoleKeyFromHref(currentHref: string): DiscoverRoleKey | null {
  if (currentHref.startsWith('/fans')) return 'fans';
  if (currentHref.startsWith('/artists')) return 'artists';
  if (currentHref.startsWith('/promoters')) return 'promoters';
  if (currentHref.startsWith('/venues')) return 'venues';
  return null;
}

function getDirectoryCta(currentHref: string) {
  if (currentHref.startsWith('/artists')) {
    return {
      label: 'Artist page',
      title: 'Claim an artist lane',
      body: 'Publish music, tour signals, media, and growth stats without changing the public directory look.',
      href: '/register?role=ARTIST'
    };
  }

  if (currentHref.startsWith('/promoters')) {
    return {
      label: 'Promoter page',
      title: 'Build a promoter lane',
      body: 'Open a curatorial profile, connect rooms, and keep your event signal in one place.',
      href: '/register?role=DJ'
    };
  }

  if (currentHref.startsWith('/venues')) {
    return {
      label: 'Venue page',
      title: 'List a room',
      body: 'Give artists and fans a clean venue page with ticketing, demand, and booking context.',
      href: '/register?role=VENUE'
    };
  }

  return {
    label: 'Fan page',
    title: 'Join the fan lane',
    body: 'Track scenes, hype artists, and keep your live music identity in the same network.',
    href: '/register?role=FAN'
  };
}

function compactCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: value > 999 ? 'compact' : 'standard' }).format(value);
}

export function ProfileDirectoryPage({
  badge,
  title,
  description,
  profiles,
  currentHref,
  modulePanel,
  moduleSubheader
}: {
  badge: string;
  title: string;
  description: string;
  profiles: DirectoryProfile[];
  currentHref: string;
  activeModule: DiscoverModuleId;
  modulePanel?: ReactNode;
  moduleSubheader?: ReactNode;
}) {
  const roleKey = getRoleKeyFromHref(currentHref);
  const cta = getDirectoryCta(currentHref);
  const markets = Array.from(
    new Set(
      profiles
        .map((profile) => [profile.city, profile.stateRegion ?? profile.country].filter(Boolean).join(', '))
        .filter(Boolean)
    )
  );
  const genreCount = new Set(profiles.flatMap((profile) => profile.genres)).size;
  const totalHype = profiles.reduce((sum, profile) => sum + profile.hypeCount, 0);

  return (
    <div className={roleKey ? `signed-landing-schema signed-landing-schema-${roleKey}` : undefined}>
      {moduleSubheader}

      <main className="container section signed-landing-main">
        <section className="directory-hero panel directory-public-hero">
          <div className="directory-hero-copy">
            <div className="badge">{badge}</div>
            <h1 className="directory-title">{title}</h1>
            <p className="subtitle">{description}</p>
            <div className="directory-market-strip" aria-label="Visible markets">
              {markets.slice(0, 6).map((market) => (
                <span className="directory-market-pill" key={market}>
                  {market}
                </span>
              ))}
              {!markets.length ? <span className="directory-market-pill">Markets loading</span> : null}
            </div>
          </div>

          <div className="directory-hero-stats">
            <div className="directory-stat">
              <span>Profiles</span>
              <strong>{compactCount(profiles.length)}</strong>
            </div>
            <div className="directory-stat">
              <span>Genres</span>
              <strong>{compactCount(genreCount)}</strong>
            </div>
            <div className="directory-stat">
              <span>Hype</span>
              <strong>{compactCount(totalHype)}</strong>
            </div>
            <div className="directory-cta-card">
              <span>{cta.label}</span>
              <strong>{cta.title}</strong>
              <p>{cta.body}</p>
              <Link className="button small secondary" href={cta.href}>
                Join free
              </Link>
            </div>
          </div>
        </section>

        {modulePanel}

        <section className="section directory-public-stack">
          <div className="directory-section-head">
            <div>
              <div className="badge">Public browser</div>
              <h2>Browse without losing the lane.</h2>
            </div>
            <p className="meta">Filter by role, market, genre, and signal strength.</p>
          </div>
          <ProfileDirectoryBrowser currentHref={currentHref} profiles={profiles} />
        </section>
      </main>
    </div>
  );
}
