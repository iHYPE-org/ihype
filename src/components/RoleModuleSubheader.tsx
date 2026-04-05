import Link from 'next/link';
import {
  type DiscoverModuleId,
  type DiscoverRoleKey,
  getDiscoverModulesForRole
} from '@/lib/discover-modules';

type RoleModuleSubheaderLink = {
  label: string;
  href: string;
};

const roleLabels: Record<DiscoverRoleKey, string> = {
  fans: 'Fan Lane',
  artists: 'Artist Lane',
  promoters: 'Promoter Lane',
  venues: 'Venue Lane'
};

export function RoleModuleSubheader({
  role,
  currentHref,
  activeModule,
  extraLinks = []
}: {
  role: DiscoverRoleKey;
  currentHref: string;
  activeModule: DiscoverModuleId;
  extraLinks?: RoleModuleSubheaderLink[];
}) {
  const modules = getDiscoverModulesForRole(role);

  return (
    <div className="site-subnav-shell">
      <nav aria-label={`${role} discover modules`} className="container site-subnav">
        <span className="site-subnav-label">{roleLabels[role]}</span>
        {modules.map((module) => (
          <Link
            className={module.id === activeModule ? 'site-subnav-link active' : 'site-subnav-link'}
            href={`${currentHref}?module=${module.id}`}
            key={module.id}
          >
            {module.label}
          </Link>
        ))}
        {extraLinks.length ? <div className="site-subnav-divider" aria-hidden="true" /> : null}
        {extraLinks.map((link) => (
          <Link className="site-subnav-link site-subnav-link-utility" href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
