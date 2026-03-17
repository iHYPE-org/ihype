'use client';

import Link from 'next/link';

type AuthConnectionMapProps = {
  active: 'login' | 'register';
  registerHref?: string;
};

type DiscoverLaneMapProps = {
  badge: string;
  title: string;
  modules: string[];
};

const laneLabels = [
  'Fans discover page',
  'Artists discover page',
  'Promoters discover page',
  'Venues discover page'
] as const;

export function AuthConnectionMap({
  active,
  registerHref = '/register'
}: AuthConnectionMapProps) {
  return (
    <section className="connection-map panel" aria-label="Website and app linking layout">
      <div className="connection-map-top">
        <Link className="connection-map-card connection-map-card-index" href="/">
          <span>Index</span>
        </Link>
      </div>

      <div className="connection-map-middle">
        <div className="connection-map-hub">
          <Link
            className={active === 'login' ? 'connection-map-auth-link active' : 'connection-map-auth-link'}
            href="/login"
          >
            Sign in
          </Link>
          <span className="connection-map-divider">|</span>
          <Link
            className={active === 'register' ? 'connection-map-auth-link active' : 'connection-map-auth-link'}
            href={registerHref}
          >
            Sign up
          </Link>
        </div>

        <div className="connection-map-wizard-link" aria-hidden="true">
          <span />
          <span />
        </div>

        <Link className="connection-map-card connection-map-card-secondary" href={registerHref}>
          <span>Sign up wizard</span>
        </Link>
      </div>

      <div className="connection-map-lanes" aria-label="Discover pages unlocked after sign in">
        {laneLabels.map((label) => (
          <div className="connection-map-lane" key={label}>
            <div className="connection-map-card connection-map-card-lane">
              <span>{label}</span>
            </div>
            <small>After sign in</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DiscoverLaneMap({ badge, title, modules }: DiscoverLaneMapProps) {
  return (
    <section className="section directory-module-shell" aria-label={`${badge} modules`}>
      <div className="directory-module-lane">
        <div className="directory-module-card directory-module-card-head">
          <span className="badge">{badge}</span>
          <strong>{title}</strong>
          <p>Modules associated with this discover page.</p>
        </div>

        <div className="directory-module-stack">
          {modules.map((module) => (
            <div className="directory-module-card" key={module}>
              <span>{module}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
