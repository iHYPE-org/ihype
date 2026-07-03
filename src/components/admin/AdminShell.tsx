'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type AdminSection = 'overview'|'users'|'content'|'finance'|'ads'|'support'|'system'|'growth';

function sectionFromPathname(p: string): AdminSection {
  if (p === '/admin' || p === '/admin/') return 'overview';
  if (p.startsWith('/admin/users')) return 'users';
  if (p.startsWith('/admin/review') || p.startsWith('/admin/media')) return 'content';
  if (p.startsWith('/admin/finance')) return 'finance';
  if (p.startsWith('/admin/ads')) return 'ads';
  if (p.startsWith('/admin/moderation') || p.startsWith('/admin/feedback') || p.startsWith('/admin/dmca')) return 'support';
  if (p.startsWith('/admin/setup') || p.startsWith('/admin/audit') || p.startsWith('/admin/rate-limits') || p.startsWith('/admin/invite') || p.startsWith('/admin/feature')) return 'system';
  if (p.startsWith('/admin/growth') || p.startsWith('/admin/journal') || p.startsWith('/admin/collab')) return 'growth';
  return 'overview';
}

const NAV: Array<{s: AdminSection; label: string; href: string; glyph: string}> = [
  {s:'overview', label:'Overview', href:'/admin',            glyph:'⬡'},
  {s:'users',    label:'Users',    href:'/admin/users',      glyph:'◎'},
  {s:'content',  label:'Content',  href:'/admin/review',     glyph:'♪'},
  {s:'finance',  label:'Finance',  href:'/admin/finance',    glyph:'◈'},
  {s:'ads',      label:'Ads',      href:'/admin/ads',        glyph:'▣'},
  {s:'support',  label:'Support',  href:'/admin/moderation', glyph:'⬟'},
  {s:'system',   label:'System',   href:'/admin/setup',      glyph:'⚙'},
  {s:'growth',   label:'Growth',   href:'/admin/growth',     glyph:'△'},
];

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
  const pathname = usePathname();
  const active = sectionFromPathname(pathname);
  const ops = initials(name, email);

  return (
    <div className="ops-shell">
      {/* Top bar */}
      <header className="ops-topbar">
        <span className="ops-wordmark">iH<span className="ops-dot">·</span><span className="ops-ops">OPS</span></span>
        <div className="ops-topbar-mid">
          <span className="ops-search-hint"><kbd>⌘K</kbd> Search</span>
        </div>
        <div className="ops-topbar-right">
          <span className="ops-chip ops-chip-sm">OPERATOR</span>
          <div className="ops-topbar-avatar" title={name ?? email ?? 'Operator'}>{ops}</div>
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
              title={item.label}
            >
              <span className="ops-rail-glyph">{item.glyph}</span>
              <span className="ops-rail-label">{item.label}</span>
            </Link>
          ))}
        </aside>

        {/* Main content */}
        <main className="ops-main">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="ops-bottom-bar">
        {NAV.map(item => (
          <Link
            key={item.s}
            href={item.href}
            className={`ops-bottom-tab${active === item.s ? ' ops-rail-active' : ''}`}
            title={item.label}
          >
            <span className="ops-rail-glyph">{item.glyph}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
