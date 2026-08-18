/** Null means the route already owns a more specific back control. */
export function mmmMeBackTarget(pathname: string | null | undefined): string | null {
  if (!pathname || pathname === '/app/me' || !pathname.startsWith('/app/me/')) return null;
  const ownsBack =
    pathname === '/app/me/settings' ||
    pathname === '/app/me/accessibility' ||
    pathname === '/app/me/advertising' ||
    pathname.startsWith('/app/me/info/') ||
    pathname.startsWith('/app/me/support/tickets') ||
    /^\/app\/me\/venues\/[^/]+\/(calendar|booking-inbox)$/.test(pathname) ||
    /^\/app\/me\/shows\/[^/]+\/lineup$/.test(pathname);
  return ownsBack ? null : '/app/me';
}

/** Short workspace context for nested creator/account tools. */
export function mmmMeRouteTrail(pathname: string | null | undefined): string[] {
  if (!pathname?.startsWith('/app/me/')) return [];
  const fixed: Record<string, string[]> = {
    '/app/me/profiles': ['Profiles'],
    '/app/me/advertising/new': ['Advertiser', 'New campaign'],
    '/app/me/booking': ['Booking'],
    '/app/me/events/new': ['Events', 'New event'],
    '/app/me/payouts': ['Account', 'Payouts'],
  };
  if (fixed[pathname]) return fixed[pathname];
  if (/^\/app\/me\/payouts\/[^/]+$/.test(pathname)) return ['Account', 'Payout detail'];
  if (/^\/app\/me\/tickets\/[^/]+$/.test(pathname)) return ['My Tickets', 'Ticket detail'];
  const creator = pathname.match(/^\/app\/me\/(artists|venues)\/[^/]+\/([^/]+)$/);
  if (creator) return [creator[1] === 'artists' ? 'Artist workspace' : 'Venue workspace', humanize(creator[2])];
  const show = pathname.match(/^\/app\/me\/shows\/[^/]+\/([^/]+)$/);
  if (show) return ['Show tools', humanize(show[1])];
  return [];
}

function humanize(value: string) {
  return value.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}
