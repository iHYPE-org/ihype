export type DiscoverRoleKey = 'fans' | 'artists' | 'promoters' | 'venues';

export type DiscoverModuleId =
  | 'discover'
  | 'globe-search'
  | 'recommendation-engine'
  | 'ticket-hub'
  | 'stats'
  | 'tour-creator'
  | 'event-creator'
  | 'show-creator';

export type DiscoverModuleOption = {
  id: DiscoverModuleId;
  label: string;
};

const discoverModuleOptions: Record<DiscoverRoleKey, DiscoverModuleOption[]> = {
  fans: [
    { id: 'discover', label: 'Discover' },
    { id: 'globe-search', label: 'Globe Search' },
    { id: 'recommendation-engine', label: 'Recommendation Engine' },
    { id: 'ticket-hub', label: 'Ticket Hub' }
  ],
  artists: [
    { id: 'discover', label: 'Discover' },
    { id: 'stats', label: 'Stats' },
    { id: 'recommendation-engine', label: 'Recommendation Engine' },
    { id: 'tour-creator', label: 'Tour Creator' }
  ],
  promoters: [
    { id: 'discover', label: 'Discover' },
    { id: 'stats', label: 'Stats' },
    { id: 'recommendation-engine', label: 'Recommendation Engine' },
    { id: 'show-creator', label: 'Show Creator' }
  ],
  venues: [
    { id: 'discover', label: 'Discover' },
    { id: 'stats', label: 'Stats' },
    { id: 'recommendation-engine', label: 'Recommendation Engine' },
    { id: 'event-creator', label: 'Event Creator' }
  ]
};

export function getDiscoverModulesForRole(role: DiscoverRoleKey) {
  return discoverModuleOptions[role];
}

export function getDefaultDiscoverModule(role: DiscoverRoleKey) {
  return discoverModuleOptions[role][0]?.id ?? 'stats';
}

export function resolveDiscoverModule(
  role: DiscoverRoleKey,
  value: string | string[] | undefined
) {
  if (typeof value === 'string') {
    const matchedModule = discoverModuleOptions[role].find((option) => option.id === value);
    if (matchedModule) {
      return matchedModule.id;
    }
  }

  return getDefaultDiscoverModule(role);
}

export function getTopMarketLabels(
  profiles: Array<{
    city: string | null;
    stateRegion?: string | null;
    country: string | null;
  }>
) {
  const counts = new Map<string, number>();

  for (const profile of profiles) {
    const label = [profile.city, profile.stateRegion ?? profile.country].filter(Boolean).join(', ');
    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([label, count]) => `${label} (${count})`);
}
