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
