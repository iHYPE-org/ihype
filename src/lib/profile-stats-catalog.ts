// Dependency-light on purpose: imported by the client-side PageEditor.tsx
// picker (must never pull in @/lib/db / Prisma into the browser bundle) and
// by profile-stats.ts's server-side computation. Keep this file free of any
// import that isn't itself dependency-light.

export type StatKey =
  | 'hypeTotal'
  | 'followerCount'
  | 'monthlyListeners'
  | 'trackCompletionRate'
  | 'ticketsSold'
  | 'showsAttended'
  | 'artistsHyped'
  | 'ticketsBought'
  | 'asksMade'
  | 'asksBooked';

export type StatDef = { key: StatKey; label: string };

// Only stats that are already safe to show publicly — same bar as what's
// already hardcoded on Artist/Venue/FanProfile hero rows today (hype counts,
// follower counts, show/ticket counts). Financial data (ticketRevenueCents,
// booking-request pipeline) is deliberately excluded; it's owner-only via
// ProfileInsights, never pinnable to a public tile.
export const STAT_CATALOG: Record<StatKey, StatDef & { roles: string[] }> = {
  hypeTotal: { key: 'hypeTotal', label: 'Total Hypes', roles: ['ARTIST', 'VENUE'] },
  followerCount: { key: 'followerCount', label: 'Followers', roles: ['ARTIST', 'VENUE', 'LISTENER'] },
  monthlyListeners: { key: 'monthlyListeners', label: 'Monthly Listeners', roles: ['ARTIST'] },
  trackCompletionRate: { key: 'trackCompletionRate', label: 'Track Completion', roles: ['ARTIST'] },
  ticketsSold: { key: 'ticketsSold', label: 'Tickets Sold', roles: ['VENUE'] },
  showsAttended: { key: 'showsAttended', label: 'Shows Attended', roles: ['LISTENER'] },
  artistsHyped: { key: 'artistsHyped', label: 'Artists Hyped', roles: ['LISTENER'] },
  ticketsBought: { key: 'ticketsBought', label: 'Tickets Bought', roles: ['LISTENER'] },
  /* A fan's asks — venues they asked to book an act (2026-09-01, the demand
     loop in fan-demand.ts). Public-safe: a count, never the venue, the act or
     where the fan was when they asked. "Booked" is the venue saying yes. */
  asksMade: { key: 'asksMade', label: 'Asks', roles: ['LISTENER'] },
  asksBooked: { key: 'asksBooked', label: 'Asks Booked', roles: ['LISTENER'] },
};

export function statOptionsForRole(profileType: string): StatDef[] {
  const role = profileType === 'LISTENER' ? 'LISTENER' : profileType;
  return Object.values(STAT_CATALOG).filter((s) => s.roles.includes(role));
}
