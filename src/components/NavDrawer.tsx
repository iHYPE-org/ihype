'use client';

import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccessibilityControls } from '@/components/AccessibilityControls';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/components/I18nProvider';
import { canPromoteWithHypeLink } from '@/lib/role-capabilities';

type OwnedProfile = {
  id: string;
  slug: string;
  name: string;
  type: string;
};

type MenuItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  description?: string;
};

type MenuGroup = {
  id: 'listen' | 'events' | 'pages' | 'settings';
  label: string;
  color: string;
  items: MenuItem[];
};

type IconName =
  | 'seed'
  | 'radio'
  | 'chart'
  | 'playlist'
  | 'pin'
  | 'spark'
  | 'ticket'
  | 'promote'
  | 'dashboard'
  | 'page'
  | 'show'
  | 'event'
  | 'tour'
  | 'settings'
  | 'community'
  | 'info'
  | 'legal';

const svgProps = {
  'aria-hidden': true,
  fill: 'none',
  height: 18,
  viewBox: '0 0 24 24',
  width: 18,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MenuIcon({ name }: { name: IconName }) {
  const drawings: Record<IconName, ReactNode> = {
    seed: <><path d="M12 21V9" /><path d="M7 3c4 0 5 3 5 6-4 0-7-2-7-6h2Z" /><path d="M17 5c-3 0-5 2-5 5 4 0 7-2 7-5h-2Z" /></>,
    radio: <><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h20" /></>,
    playlist: <><path d="M4 6h11M4 11h11M4 16h7" /><path d="M18 10v8" /><circle cx="15.5" cy="18" r="2.5" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    spark: <><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    ticket: <><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z" /><path d="M13 5v3M13 11v2M13 16v3" /></>,
    promote: <><path d="M4 13V9l11-4v12L4 13Z" /><path d="m7 14 1 5h4l-2-5M18 8v6M21 10v2" /></>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    page: <><path d="M6 3h9l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    show: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M3 15h3v5H4a1 1 0 0 1-1-1v-4Zm15 0h3v4a1 1 0 0 1-1 1h-2v-5Z" /></>,
    event: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15" r="2" /></>,
    tour: <><path d="M4 18c2-5 5-8 9-8h7" /><path d="m17 7 3 3-3 3" /><circle cx="5" cy="18" r="2" /><path d="M5 3v7" /><path d="m2 6 3-3 3 3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5 13.5 5l3-.3.4 2.9 2.6 1.5-1.4 2.7 1.4 2.7-2.6 1.5-.4 3-3-.4L12 21.5l-1.5-2.9-3 .4-.4-3-2.6-1.5 1.4-2.7-1.4-2.7 2.6-1.5.4-2.9 3 .3L12 2.5Z" /></>,
    community: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.9.3 5 2.2 5 5.4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    legal: <><path d="M6 3h9l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  };
  return <svg {...svgProps}>{drawings[name]}</svg>;
}

function isActivePath(pathname: string, href: string) {
  const base = href.split('?')[0].split('#')[0];
  if (base === '/listen') return pathname === '/listen';
  if (base === '/shows') return pathname === '/shows';
  return pathname === base || (base !== '/' && pathname.startsWith(`${base}/`));
}

/**
 * The compact app menu is shared by the authenticated header and the legacy
 * mobile shell. It exposes every fan surface, while creator links resolve to
 * the correct owned page and never replace the destination's server-side
 * authorization checks.
 */
export function NavDrawer({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const { t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<MenuGroup['id'] | null>(null);
  const [profiles, setProfiles] = useState<OwnedProfile[]>([]);
  const settingsPanelId = useId();
  const pathname = usePathname();
  const { data: session } = useSession();
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const accountName = session?.user
    ? session.user.name || session.user.email?.split('@')[0] || 'Account'
    : null;

  useEffect(() => {
    if (!session?.user) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    fetch('/api/pages/home')
      .then((response) => response.ok ? response.json() : null)
      .then((data: { myProfiles?: OwnedProfile[] } | null) => {
        if (!cancelled) setProfiles(data?.myProfiles ?? []);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => { cancelled = true; };
  }, [session?.user]);

  useEffect(() => {
    if (!open) return;
    setExpandedGroup(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const groups = useMemo<MenuGroup[]>(() => {
    const artist = profiles.find((profile) => profile.type === 'ARTIST');
    const venue = profiles.find((profile) => profile.type === 'VENUE');
    const canPromote = canPromoteWithHypeLink(session?.user?.role);

    return [
      {
        id: 'listen',
        label: 'LISTEN',
        color: 'var(--accent)',
        items: [
          { href: '/listen?tab=seeds', label: 'Discover', badge: 'Seeds', icon: 'seed', description: 'Swipe into something new' },
          { href: '/listen?tab=radio', label: 'Radio', icon: 'radio', description: 'Scene-run shows and rotation' },
          { href: '/listen?tab=charts', label: 'Charts', icon: 'chart', description: 'Follow the real local signal' },
          { href: '/listen?tab=playlists', label: 'Playlists', icon: 'playlist', description: 'Everything you saved' },
        ],
      },
      {
        id: 'events',
        label: 'EVENTS',
        color: 'var(--role-venue)',
        items: [
          { href: '/shows?tab=local', label: 'Near Me', icon: 'pin', description: 'Shows happening around you' },
          { href: '/shows?tab=foryou', label: 'Recommended', icon: 'spark', description: 'Built from your HYPE' },
          { href: '/shows?tab=tickets', label: 'My Tickets', icon: 'ticket', description: 'Upcoming and past entry' },
          ...(canPromote
            ? [{ href: '/me/promote', label: 'Promote', icon: 'promote' as const, description: 'Fans and DJs share HYPE links and earn' }]
            : []),
        ],
      },
      {
        id: 'pages',
        label: 'PAGES',
        color: 'var(--role-fan)',
        items: [
          { href: '/me/dashboard', label: 'My Dashboard', icon: 'dashboard', description: 'Your activity and impact' },
          { href: '/pages?tab=creator', label: 'Page Creator', icon: 'page', description: 'Build an artist, DJ, or venue page' },
          ...(artist ? [{
            href: `/pages?tab=mypage&profile=${encodeURIComponent(artist.id)}&tool=tour`,
            label: 'Tour Creator',
            badge: 'Artists',
            icon: 'tour' as const,
            description: 'HYPE, play, and request interest by city',
          }] : []),
          ...(venue ? [{
            href: `/events/new?venue=${encodeURIComponent(venue.id)}`,
            label: 'Event Creator',
            badge: 'Venues',
            icon: 'event' as const,
            description: `Create events as ${venue.name}`,
          }] : []),
        ],
      },
      {
        id: 'settings',
        label: 'SETTINGS',
        color: 'var(--warning-text)',
        items: [
          { href: '/me/settings', label: 'Settings', icon: 'settings', description: 'Account, privacy, and access' },
          { href: '/community', label: 'Community', icon: 'community', description: 'Vote on what iHYPE becomes' },
          { href: '/info', label: 'Info', icon: 'info', description: 'How the nonprofit works' },
          { href: '/legal', label: 'Legal', icon: 'legal', description: 'Terms, privacy, and policies' },
        ],
      },
    ];
  }, [profiles, session?.user?.role]);

  return (
    <>
      {showTrigger && (
        <button
          className="nav-drawer-trigger"
          aria-label={t('navDrawer.openMenuAriaLabel', 'Open menu')}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
        </button>
      )}
      {open ? (
        <>
          <div
            className="nav-drawer-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="nav-drawer app-nav-drawer" aria-label="iHYPE menu">
            <div className="app-nav-drawer-head">
              <div>
                <span>SUPPORT THE SCENE</span>
                <strong>Everything lives here.</strong>
              </div>
              <button
                className="nav-drawer-close"
                aria-label={t('navDrawer.closeMenuAriaLabel', 'Close menu')}
                onClick={() => setOpen(false)}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeLinecap="round" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {accountName ? (
              <Link className="app-nav-account" href="/me/dashboard" onClick={() => setOpen(false)}>
                <span aria-hidden="true">{accountName.charAt(0).toUpperCase()}</span>
                <div>
                  <small>SIGNED IN</small>
                  <strong>{accountName}</strong>
                </div>
              </Link>
            ) : (
              <div className="app-nav-signed-out">
                <Link className="button secondary small" href="/login" onClick={() => setOpen(false)}>Sign in</Link>
                <Link className="button small" href="/register" onClick={() => setOpen(false)}>Join free</Link>
              </div>
            )}

            <div className={`app-nav-groups${expandedGroup ? ' has-expanded' : ''}`}>
              {groups.map((group, groupIndex) => {
                const expanded = expandedGroup === group.id;
                const panelId = `app-menu-${group.id}`;
                return (
                <section
                  className={`app-nav-group${expanded ? ' is-expanded' : ''}`}
                  key={group.label}
                  style={{
                    '--menu-group-color': group.color,
                    '--menu-group-index': groupIndex,
                  } as CSSProperties}
                >
                  <button
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    className="app-nav-group-toggle"
                    onClick={() => setExpandedGroup((current) => current === group.id ? null : group.id)}
                    type="button"
                  >
                    <span>{group.label}</span>
                    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div
                    aria-hidden={!expanded}
                    className="app-nav-group-panel"
                    id={panelId}
                    inert={!expanded}
                  >
                  <ul>
                    {group.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      return (
                        <li key={`${group.label}-${item.label}`}>
                          <Link
                            href={item.href}
                            className={`app-nav-link${active ? ' active' : ''}`}
                            onClick={() => setOpen(false)}
                            tabIndex={expanded ? undefined : -1}
                          >
                            <span className="app-nav-link-icon"><MenuIcon name={item.icon} /></span>
                            <span className="app-nav-link-copy">
                              <strong>{item.label}{item.badge ? <em>{item.badge}</em> : null}</strong>
                              {item.description ? <small>{item.description}</small> : null}
                            </span>
                            <span className="app-nav-arrow" aria-hidden="true">→</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  </div>
                </section>
              )})}
            </div>

            <button
              type="button"
              className="app-nav-preferences"
              aria-expanded={settingsOpen}
              aria-controls={settingsPanelId}
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <span>Device preferences</span>
              <span aria-hidden="true">{settingsOpen ? '−' : '+'}</span>
            </button>
            {settingsOpen ? (
              <div className="nav-drawer-settings" id={settingsPanelId}>
                <div className="nav-drawer-settings-row">
                  <span>{t('navDrawer.theme', 'Theme')}</span>
                  <ThemeToggle />
                </div>
                <div className="nav-drawer-settings-row"><LanguageSwitcher /></div>
                <AccessibilityControls inline />
              </div>
            ) : null}

            {accountName ? (
              <a href="/api/auth/signout" className="app-nav-signout">
                {t('navDrawer.signOut', 'Sign out')}
              </a>
            ) : null}
          </nav>
        </>
      ) : null}
    </>
  );
}
