import Link from 'next/link';

type Tab = 'dashboard' | 'users' | 'review' | 'broadcast' | 'audit' | 'journal' | 'ads' | 'playlists' | 'feedback' | 'rate-limits';

const TABS: Array<{ key: Tab; href: string; label: string }> = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'users', href: '/admin/users', label: 'Users' },
  { key: 'review', href: '/admin/review', label: 'Review' },
  { key: 'ads', href: '/admin/ads', label: 'Ads' },
  { key: 'broadcast', href: '/admin/broadcast', label: 'Broadcast' },
  { key: 'audit', href: '/admin/audit', label: 'Audit log' },
  { key: 'journal', href: '/admin/journal', label: 'Journal' },
  { key: 'playlists', href: '/admin/playlists', label: 'Playlists' },
  { key: 'feedback', href: '/admin/feedback', label: 'Feedback' },
  { key: 'rate-limits', href: '/admin/rate-limits', label: 'Rate Limits' }
];

export function AdminNav({ active }: { active: Tab }) {
  return (
    <nav className="admin-export-row" aria-label="Admin navigation" style={{ marginBottom: 12 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          className={`button small ${tab.key === active ? '' : 'secondary'}`}
          href={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
