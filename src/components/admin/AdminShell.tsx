'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { useAdminBadges } from '@/components/admin/AdminLive';

/**
 * The console's sections, as the operator describes the job rather than as the
 * routes happened to accumulate.
 *
 * It used to be eight rail items — Overview, Users, Content, Finance, Ads,
 * Support, System, Growth — which named the code's layout, not the work: ad
 * billing sat under Ads while every other payment sat under Finance, and
 * "Content" and "Support" both meant "someone reported a problem".
 *
 * Nothing is dropped. Every page the old rail reached is still one click away;
 * pages without a section of their own hang off the closest one in SUBNAV
 * below. `system` is kept off the requested list on purpose: setup, the audit
 * log and status are operating the console itself, not any of the six subjects.
 */
type AdminSection = 'overview'|'users'|'tickets'|'payments'|'verifications'|'authorizations'|'stats'|'system';

function sectionFromPathname(p: string): AdminSection {
  if (p === '/admin' || p === '/admin/') return 'overview';
  if (p.startsWith('/admin/users') || p.startsWith('/admin/broadcast') || p.startsWith('/admin/moderation') || p.startsWith('/admin/feedback') || p.startsWith('/admin/dmca')) return 'users';
  if (p.startsWith('/admin/tickets')) return 'tickets';
  if (p.startsWith('/admin/finance') || p.startsWith('/admin/ads')) return 'payments';
  if (p.startsWith('/admin/review') || p.startsWith('/admin/verifications') || p.startsWith('/admin/media')) return 'verifications';
  if (p.startsWith('/admin/authorizations')) return 'authorizations';
  if (p.startsWith('/admin/analytics') || p.startsWith('/admin/growth') || p.startsWith('/admin/journal') || p.startsWith('/admin/collab') || p.startsWith('/admin/playlists') || p.startsWith('/admin/community')) return 'stats';
  if (p.startsWith('/admin/setup') || p.startsWith('/admin/audit') || p.startsWith('/admin/rate-limits') || p.startsWith('/admin/invite') || p.startsWith('/admin/feature') || p.startsWith('/admin/device-register')) return 'system';
  return 'overview';
}

const NAV: Array<{s: AdminSection; label: string; href: string; glyph: string}> = [
  {s:'overview',       label:'Overview',        href:'/admin',                glyph:'⬡'},
  {s:'users',          label:'Users',           href:'/admin/users',          glyph:'◎'},
  {s:'tickets',        label:'Tickets',         href:'/admin/tickets',        glyph:'▤'},
  {s:'payments',       label:'Payments',        href:'/admin/finance',        glyph:'◈'},
  {s:'verifications',  label:'Verifications',   href:'/admin/review',         glyph:'✓'},
  {s:'authorizations', label:'Authorizations',  href:'/admin/authorizations', glyph:'⚿'},
  {s:'stats',          label:'Site statistics', href:'/admin/analytics',      glyph:'△'},
  {s:'system',         label:'System',          href:'/admin/setup',          glyph:'⚙'},
];

// Every real /admin/* subpage that doesn't have its own primary rail item —
// grouped under the section sectionFromPathname() already assigns it to, so
// every page in the app is reachable by a click, not just a typed URL.
// (device-register is deliberately excluded: it's only ever reached via an
// emailed one-time-token link during device re-registration, never a nav
// destination. It is *listed* under Authorizations, which is where an operator
// looks for it, but as the Devices tab that can actually revoke one.)
const SUBNAV: Partial<Record<AdminSection, Array<{label: string; href: string}>>> = {
  users: [
    {label: 'Roles', href: '/admin/users'},
    {label: 'Notifications out', href: '/admin/broadcast'},
    {label: 'Stats', href: '/admin/users?tab=stats'},
    {label: 'Issues', href: '/admin/moderation'},
    {label: 'Feedback', href: '/admin/feedback'},
  ],
  tickets: [
    {label: 'Events', href: '/admin/tickets'},
    {label: 'Support', href: '/admin/tickets/support'},
  ],
  payments: [
    {label: 'Finance', href: '/admin/finance'},
    {label: 'Ad campaigns', href: '/admin/ads'},
  ],
  authorizations: [
    {label: 'Devices', href: '/admin/authorizations'},
    {label: 'Payment holds', href: '/admin/authorizations/holds'},
  ],
  stats: [
    {label: 'Analytics', href: '/admin/analytics'},
    {label: 'Growth', href: '/admin/growth'},
    {label: 'Journal', href: '/admin/journal'},
    {label: 'Playlists', href: '/admin/playlists'},
    {label: 'Community', href: '/admin/community'},
  ],
  system: [
    {label: 'Setup', href: '/admin/setup'},
    {label: 'Audit Log', href: '/admin/audit'},
    {label: 'Status', href: '/status'},
  ],
};

interface Props {
  children: React.ReactNode;
  name?: string | null;
  email?: string | null;
}

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'OP';
}

export function AdminShell({ children, name, email }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const active = sectionFromPathname(pathname);
  const ops = initials(name, email);
  const subnav = SUBNAV[active];
  // Live counts, from the same endpoint the board polls — see AdminLive.tsx.
  const badges = useAdminBadges();

  return (
    <div className="ops-shell">
      {/* Top bar */}
      <header className="ops-topbar">
        <span className="ops-wordmark">iH<span className="ops-dot">·</span><span className="ops-ops">OPS</span></span>
        <div className="ops-topbar-mid">
          <span className="ops-search-hint"><kbd>⌘K</kbd> {t('adminAdminShell.search', 'Search')}</span>
        </div>
        <div className="ops-topbar-right">
          {/* The way out to the member app. An administrator account is a
              normal member as well — nothing gates /app on role, so this
              account has a fan profile, hypes and tickets like anyone else —
              but /admin is a fixed shell with no link to the product it
              administers, so the only route across was editing the URL.

              It is NOT impersonation: this is the operator's own account
              seeing its own data. Impersonating another member is a separate
              control with an audit trail behind it. */}
          <Link className="ops-topbar-app" href={WORKBENCH_PATH} title={t('adminAdminShell.viewAppTitle', 'Open the member app as this account')}>
            {t('adminAdminShell.viewApp', 'View app')}
            <span aria-hidden="true">›</span>
          </Link>
          <span className="ops-chip ops-chip-sm">{t('adminAdminShell.operator', 'OPERATOR')}</span>
          <div className="ops-topbar-avatar" title={name ?? email ?? t('adminAdminShell.operatorTitle', 'Operator')}>{ops}</div>
        </div>
      </header>

      <div className="ops-body">
        {/* Left rail */}
        <aside className="ops-rail">
          {NAV.map(item => (
            <Link
              key={item.s}
              href={item.href}
              className={`ops-rail-item${active === item.s ? ' ops-rail-active' : ''}`}
              title={t(`adminAdminShell.nav.${item.s}`, item.label)}
            >
              <span className="ops-rail-glyph">{item.glyph}</span>
              <span className="ops-rail-label">{t(`adminAdminShell.nav.${item.s}`, item.label)}</span>
              {/* Only ever a real, non-zero count. A badge reading 0 and a
                  badge whose count could not be read look the same, and only
                  one of them means there is nothing to do. */}
              {badges[item.s] ? <span className="ops-rail-badge">{badges[item.s]}</span> : null}
            </Link>
          ))}
        </aside>

        {/* Main content */}
        <main className="ops-main">
          {subnav && (
            <nav className="ops-subnav">
              {subnav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ops-subnav-link${pathname === item.href.split('?')[0] ? ' ops-subnav-active' : ''}`}
                >
                  {t(`adminAdminShell.subnav.${item.href}`, item.label)}
                </Link>
              ))}
            </nav>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="ops-bottom-bar">
        {NAV.map(item => (
          <Link
            key={item.s}
            href={item.href}
            className={`ops-bottom-tab${active === item.s ? ' ops-rail-active' : ''}`}
            title={t(`adminAdminShell.nav.${item.s}`, item.label)}
          >
            <span className="ops-rail-glyph">{item.glyph}</span>
            <span>{t(`adminAdminShell.nav.${item.s}`, item.label)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
