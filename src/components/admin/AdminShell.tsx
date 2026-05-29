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
  if (p.startsWith('/admin/moderation') || p.startsWith('/admin/feedback') || p.startsWith('/admin/flagged') || p.startsWith('/admin/dmca')) return 'support';
  if (p.startsWith('/admin/setup') || p.startsWith('/admin/audit') || p.startsWith('/admin/rate-limits') || p.startsWith('/admin/invite') || p.startsWith('/admin/feature')) return 'system';
  if (p.startsWith('/admin/growth') || p.startsWith('/admin/journal') || p.startsWith('/admin/collab')) return 'growth';
  return 'overview';
}

const NAV: Array<{s: AdminSection; label: string; href: string; icon: string}> = [
  {s:'overview', label:'Overview', href:'/admin',            icon:'⬡'},
  {s:'users',    label:'Users',    href:'/admin/users',      icon:'👥'},
  {s:'content',  label:'Content',  href:'/admin/review',     icon:'🎵'},
  {s:'finance',  label:'Finance',  href:'/admin/finance',    icon:'💰'},
  {s:'ads',      label:'Ads',      href:'/admin/ads',        icon:'📢'},
  {s:'support',  label:'Support',  href:'/admin/moderation', icon:'🛡️'},
  {s:'system',   label:'System',   href:'/admin/setup',      icon:'⚙️'},
  {s:'growth',   label:'Growth',   href:'/admin/growth',     icon:'📈'},
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = sectionFromPathname(pathname);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">iHYPE Admin</div>
        <nav>
          {NAV.map(item => (
            <Link key={item.s} href={item.href}
              className={`admin-sidebar-item${active===item.s?' asl-active':''}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-shell-content">{children}</main>
      <nav className="admin-bottom-bar">
        {NAV.map(item => (
          <Link key={item.s} href={item.href}
            className={`admin-bottom-tab${active===item.s?' asl-active':''}`}>
            <span className="admin-bottom-tab-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
