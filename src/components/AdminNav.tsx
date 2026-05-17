import Link from 'next/link';

type Tab = 'dashboard' | 'users' | 'reports' | 'verifications' | 'broadcast' | 'audit' | 'journal';

const TABS: Array<{ key: Tab; href: string; label: string }> = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'users', href: '/admin/users', label: 'Users' },
  { key: 'reports', href: '/admin/reports', label: 'Reports' },
  { key: 'verifications', href: '/admin/verifications', label: 'Verifications' },
  { key: 'broadcast', href: '/admin/broadcast', label: 'Broadcast' },
  { key: 'audit', href: '/admin/audit', label: 'Audit log' },
  { key: 'journal', href: '/admin/journal', label: 'Journal' }
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
