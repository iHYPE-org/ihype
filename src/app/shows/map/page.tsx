import { redirect } from 'next/navigation';

/**
 * A second, list-backed map of upcoming shows. The MAP module is the map now —
 * real Leaflet over CARTO's raster build of OpenStreetMap, with venues on their
 * street address and artists on a city centroid (ADHERENCE rules 17-19). Two
 * maps of the same data is the duplication this replacement exists to end.
 */
export const dynamic = 'force-dynamic';

export default function ShowsMapRedirect() {
  redirect('/app/map');
}
