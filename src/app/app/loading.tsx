import { getServerT } from '@/lib/i18n/server';

/**
 * The shell's loading boundary — the reason a tap on Listen, Tickets or Me
 * answers on the SAME FRAME instead of after the payload lands.
 *
 * Every `/app/*` route is `force-dynamic` (the session gates it), and until
 * this file existed there was no `loading.tsx` under `/app`: so a `<Link>` to
 * a shell route prefetched NOTHING (measured: every RSC prefetch response was
 * 0 bytes), and on the tap the previous screen stayed on screen until the
 * whole new payload had arrived — the "lag between selection of new menus and
 * displaying them" the owner reported (2026-09-23, DESIGN_SYNC row 509). With
 * a boundary, Next prefetches the static tree down to it on hover and in the
 * viewport, the router swaps this in the moment the link is pressed, and the
 * pane streams under it.
 *
 * It renders inside `MmmShell`'s pane (the layout is above it, so the header,
 * the map layer and the section strip are already there), and it wears the
 * plate every MUSIC tab wears while it waits — one shape for "filling", the
 * same shape as "nothing here" (row 338), `aria-busy` for assistive tech. On
 * the map surface the shell does not render the route's children, so this
 * never paints over the map.
 */
export default async function MmmLoading() {
  const t = await getServerT();
  return (
    <p aria-busy="true" className="mmm-empty mmm-loading" role="status">
      {t('mmmMusic.loading', 'Loading…')}
    </p>
  );
}
