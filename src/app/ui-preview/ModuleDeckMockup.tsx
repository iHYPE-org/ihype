'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { type CSSProperties, type Dispatch, type PointerEvent, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformCapabilities } from '@/lib/usePlatformCapabilities';
import { loadDiscoveryTracks, loadNearbyShows, loadRadioTracks, recordDiscoveryDecision, searchPreview, updateSceneNotifications, type ExperienceTrack, type NearbyShow, type PreviewDataSource, type PreviewSearchResult } from './preview-api';

type ModuleId = 'map' | 'discover' | 'radio' | 'dashboard' | 'settings' | 'community';
type RoleId = 'fan' | 'artist' | 'dj' | 'venue' | 'promoter' | 'advertiser';
type DemoState = 'normal' | 'loading' | 'empty' | 'offline' | 'error' | 'playback';
type CommunitySection = 'voting' | 'info' | 'legal' | 'dmca';

export type DeckViewer = {
  name: string;
  role: string;
  avatarUrl?: string | null;
  roles: RoleId[];
  metrics?: Partial<Record<RoleId, Array<[string, string]>>>;
};

function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) setValue(JSON.parse(saved) as T);
    } catch {
      // A privacy-restricted browser can still use the complete mockup in memory.
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persistence is an enhancement, never a requirement for navigation.
    }
  }, [hydrated, key, value]);

  return [value, setValue];
}

const implementationBindings = {
  globalSearch: { method: 'GET', path: '/api/search' },
  discoverDecision: { method: 'POST', path: '/api/discover/seeds/:mediaId/:action' },
  mapQuery: { method: 'GET', path: '/api/shows/nearby' },
  settingsUpdate: { method: 'PATCH', path: '/api/me', deviceStorage: 'theme | ihype-locale | ihype-accessibility-settings' },
  communityVote: { method: 'POST', path: '/api/feedback' },
} as const;

type ImplementationAction = keyof typeof implementationBindings;

function signalImplementationAction(action: ImplementationAction, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ihype:implementation-action', { detail: { action, ...implementationBindings[action], payload } }));
}

const modules: Array<{ id: ModuleId; label: string; eyebrow: string; detail: string }> = [
  { id: 'map', label: 'Around you', eyebrow: '01 / Scene map', detail: 'Venues, artists, and events in reach' },
  { id: 'discover', label: 'Discover', eyebrow: '02 / Discovery', detail: 'Swipe through music outside your orbit' },
  { id: 'radio', label: 'Radio', eyebrow: '03 / Live radio', detail: 'Shows by sound, scene, and subject' },
  { id: 'dashboard', label: 'Dashboard', eyebrow: '04 / Your signal', detail: 'The view that fits your role' },
  { id: 'settings', label: 'Settings', eyebrow: '05 / Control room', detail: 'Privacy, playback, and notifications' },
  { id: 'community', label: 'Community', eyebrow: '06 / Open book', detail: 'Voting, transparency, legal, and DMCA' },
];

const discoveryTracks: ExperienceTrack[] = [
  { mediaId: null, title: 'City Lights', artist: 'Jayla Reign', scene: 'Detroit · alternative R&B', art: '/brand/alpha-featured.png', match: '92% scene match' },
  { mediaId: null, title: 'Pressure', artist: 'Milo Coast', scene: 'Ferndale · indie soul', art: '/brand/alpha-artist-2.png', match: '84% scene match' },
  { mediaId: null, title: 'Different Plans', artist: 'Rooke', scene: 'Hamtramck · post punk', art: '/brand/alpha-show-3.png', match: '25% wild card' },
];

const previewPlayerTracks: ExperienceTrack[] = [
  { mediaId: null, title: 'City Lights', artist: 'Jayla Reign', art: '/brand/alpha-featured.png', scene: 'Detroit', match: 'Alpha placeholder' },
  { mediaId: null, title: 'Pressure After Midnight', artist: 'Milo Coast and the North Woodward Collective', art: '/brand/alpha-artist-2.png', scene: 'Ferndale', match: 'Alpha placeholder' },
  { mediaId: null, title: 'Different Plans', artist: 'Rooke', art: '/brand/alpha-show-3.png', scene: 'Hamtramck', match: 'Alpha placeholder' },
];

const mapPlaces = {
  motor: { name: 'Motor City Room', distance: '1.2 miles', event: 'City Lights release show', time: 'Tonight · 8:30 PM', lineup: 'Jayla Reign · Rooke · Saint Lila', hypes: '2,418 HYPES nearby', art: '/brand/alpha-show-1.png' },
  painted: { name: 'The Painted Lady', distance: '2.6 miles', event: 'Basement Signal Live', time: 'Tonight · 9:00 PM', lineup: 'Milo Coast · Different Plans', hypes: '1,106 HYPES nearby', art: '/brand/alpha-show-2.png' },
  marble: { name: 'Marble Bar', distance: '3.8 miles', event: 'After Hours Radio', time: 'Friday · 11:30 PM', lineup: 'Laila Stone · Hotel Barrio', hypes: '876 HYPES nearby', art: '/brand/alpha-show-4.png' },
} as const;

type MapPlaceId = keyof typeof mapPlaces;
type MapZoomId = 'town' | 'county' | 'state' | 'region' | 'nation' | 'global';
type MapFilterId = 'venues' | 'tonight' | 'date' | 'tour';
type SceneVenueMarker = { coordinates: [number, number]; id: MapPlaceId; label: string };

const mapZoomLevels: Array<{ id: MapZoomId; label: string; area: string; distance: string; detail: string; radius: number }> = [
  { id: 'town', label: 'Town', area: 'Detroit', distance: '8 mi', detail: 'Blocks, rooms, and tonight', radius: 8 },
  { id: 'county', label: 'County', area: 'Wayne County', distance: '35 mi', detail: 'Local venues and nearby demand', radius: 35 },
  { id: 'state', label: 'State', area: 'Michigan', distance: '310 mi', detail: 'Tour stops and state-wide scenes', radius: 125 },
  { id: 'region', label: 'Region', area: 'Great Lakes', distance: '850 mi', detail: 'Connected regional music scenes', radius: 250 },
  { id: 'nation', label: 'Nation', area: 'United States', distance: '3,000 mi', detail: 'Independent scenes across the country', radius: 250 },
  { id: 'global', label: 'Global', area: 'Worldwide', distance: 'World', detail: 'Local scenes without borders', radius: 250 },
];

const mapPinCopy: Record<MapZoomId, [string, string, string]> = {
  town: ['Motor City Room', 'Painted Lady · Tonight', 'Marble Bar'],
  county: ['Detroit · 9 events', 'Dearborn · 4 venues', 'Hamtramck · 6 shows'],
  state: ['Detroit · 22 signals', 'Ann Arbor · 11 signals', 'Grand Rapids · 14 signals'],
  region: ['Detroit', 'Chicago', 'Cleveland'],
  nation: ['Great Lakes', 'Northeast', 'Pacific scenes'],
  global: ['North America', 'Europe', 'Oceania'],
};

const mapCameraByZoom: Record<MapZoomId, { center: [number, number]; zoom: number }> = {
  town: { center: [-83.047, 42.337], zoom: 13.1 },
  county: { center: [-83.14, 42.34], zoom: 10.25 },
  state: { center: [-85.4, 44.25], zoom: 6.35 },
  region: { center: [-84.7, 42.7], zoom: 4.45 },
  nation: { center: [-98.2, 39.4], zoom: 3.15 },
  global: { center: [4, 22], zoom: 1.45 },
};

const mapMarkerCoordinates: Record<MapZoomId, [[number, number], [number, number], [number, number]]> = {
  town: [[-83.041, 42.335], [-83.063, 42.348], [-83.066, 42.357]],
  county: [[-83.046, 42.331], [-83.176, 42.322], [-83.05, 42.393]],
  state: [[-83.046, 42.331], [-83.743, 42.281], [-85.668, 42.963]],
  region: [[-83.046, 42.331], [-87.63, 41.878], [-81.694, 41.499]],
  nation: [[-84.7, 42.7], [-74.2, 40.8], [-122.42, 37.77]],
  global: [[-98.2, 39.4], [10.4, 51.1], [151.2, -33.8]],
};

type RadioScope = 'local' | 'regional' | 'national' | 'global';

const radioRecommendations: Record<RadioScope, Array<{ id: string; title: string; meta: string; signal: string; time: string }>> = {
  local: [
    { id: 'basement-signal', title: 'Basement Signal', meta: 'Hamtramck · punk & experimental', signal: '96% local fit', time: 'LIVE' },
    { id: 'motor-city-after-dark', title: 'Motor City After Dark', meta: 'Detroit · new releases', signal: '2.4K nearby HYPES', time: '21:00' },
    { id: 'after-hours', title: 'After Hours', meta: 'Ypsilanti · electronic', signal: 'Fan favorite', time: '23:30' },
  ],
  regional: [
    { id: 'great-lakes-exchange', title: 'Great Lakes Exchange', meta: 'Michigan + Ohio · scene swap', signal: '89% regional fit', time: 'FRI' },
    { id: 'new-noise-sunday', title: 'New Noise Sunday', meta: 'Ann Arbor · weekly premieres', signal: '1.8K regional HYPES', time: 'SUN' },
    { id: 'lake-effect', title: 'Lake Effect', meta: 'Chicago · Detroit · Cleveland', signal: 'Wildcard exchange', time: '20:00' },
  ],
  national: [
    { id: 'independent-frequency', title: 'Independent Frequency', meta: 'U.S. scenes · independent only', signal: '91% taste match', time: 'LIVE' },
    { id: 'tour-van-radio', title: 'Tour Van Radio', meta: 'Artists crossing the country', signal: '7 tour stops matched', time: 'WED' },
    { id: 'college-signal', title: 'College Signal', meta: 'Campus radio exchange', signal: '25% wildcard', time: '18:00' },
  ],
  global: [
    { id: 'scenes-without-borders', title: 'Scenes Without Borders', meta: 'Global local-music exchange', signal: '88% discovery fit', time: 'LIVE' },
    { id: 'night-shift-worldwide', title: 'Night Shift Worldwide', meta: 'After-dark scenes by time zone', signal: '12 cities live', time: '24/7' },
    { id: 'wildcard-world', title: 'Wildcard World', meta: 'Completely outside your orbit', signal: '100% wildcard', time: 'NOW' },
  ],
};

const roleData: Record<RoleId, { headline: string; description: string; metrics: Array<[string, string]>; actions: string[]; build: [string, string]; insights: string[]; recommendations: Array<[string, string, string]> }> = {
  fan: {
    headline: 'Your voice moves the scene.',
    description: 'Every listen, HYPE, ticket, and referral strengthens real local signal.',
    metrics: [['HYPE balance', '1,284'], ['Discovery adds', '47'], ['Shows attended', '8'], ['Referral listens', '312'], ['Local impact', 'Top 9%'], ['Wildcard wins', '14']],
    actions: ['Open my Discovery playlist', 'Share my HYPE link', 'See tonight nearby'],
    build: ['Your music profile is 86% tuned', 'Add two favorite genres to sharpen the local 75% while preserving the 25% wildcard.'],
    insights: ['Detroit alternative R&B is your strongest signal', 'You discover most often after attending live events', 'Three artists you HYPED announced nearby shows'],
    recommendations: [['Jayla Reign · City Lights', 'Detroit · 94% preferences', 'LOCAL'], ['Milo Coast · Pressure', 'Ferndale · playlist match', 'NEARBY'], ['Rooke · Different Plans', 'Hamtramck · outside your history', 'WILDCARD']],
  },
  artist: {
    headline: 'Turn listeners into a real route.',
    description: 'See where plays, HYPES, and requests are concentrated before you book the van.',
    metrics: [['Monthly listeners', '3,812'], ['HYPES received', '9,406'], ['Hot scenes', '6'], ['Song HYPE rate', '18.4%'], ['Album saves', '1,209'], ['Tour requests', '684']],
    actions: ['Create recommended tour', 'Edit artist page', 'Review song insights'],
    build: ['Artist page strength: 78%', 'Add press imagery, stage requirements, and two missing track credits before sharing your EPK.'],
    insights: ['City Lights earns the most HYPES between 8–11 PM', 'The album is saved 31% more often after Different Plans', 'Ann Arbor requests rose 46% after last radio feature'],
    recommendations: [['Detroit → Ann Arbor → Toledo', '2,481 HYPES · 716 fan requests', 'TOUR FIT'], ['Release City Lights live cut', 'Highest song-level HYPE momentum', 'CONTENT'], ['Invite Milo Coast as support', '64% shared fan signal', 'COLLAB']],
  },
  dj: {
    headline: 'Build shows people return to.',
    description: 'Program your radio show, see live response, and spotlight the scene you represent.',
    metrics: [['Show followers', '2,109'], ['Avg. completion', '71%'], ['HYPES this week', '684'], ['Live listeners', '312'], ['Repeat listeners', '63%'], ['Peak HYPE minute', '42:18']],
    actions: ['Create a radio show', 'Open show analytics', 'Share my HYPE link'],
    build: ['Radio page and show studio', 'Finish your show description, recurring schedule, intro audio, and first three preset music-only ad breaks.'],
    insights: ['Fans HYPE most during first-play local premieres', 'Interview segments retain 22% more listeners', 'Sunday at 9 PM is your strongest regional slot'],
    recommendations: [['New Noise Sunday', '12 rising local tracks matched to listeners', 'SHOW PLAN'], ['Interview Jayla Reign', 'Audience overlap: 71%', 'GUEST'], ['Great Lakes exchange hour', 'Regional listener demand +38%', 'FORMAT']],
  },
  venue: {
    headline: 'Book the demand around you.',
    description: 'Match available dates with local artist interest and verified fan momentum.',
    metrics: [['Nearby demand', '8.7K'], ['Upcoming events', '12'], ['Ticket conversion', '18%'], ['Fan requests', '1,048'], ['Tour matches', '17'], ['Repeat attendees', '42%']],
    actions: ['Create an event', 'Review booking interest', 'Open venue page'],
    build: ['Venue page strength: 82%', 'Confirm capacity, accessibility, production inventory, booking windows, and settlement preferences.'],
    insights: ['Friday demand peaks for indie soul within 18 miles', 'Four artist tours currently fit open October dates', 'Fan requests favor 3-band bills under $25'],
    recommendations: [['Jayla Reign + Milo Coast', '2,906 nearby HYPES · Oct 18 fit', 'BOOKING'], ['Local discovery night', '614 fan requests across four artists', 'EVENT'], ['Rooke tour hold', 'Route passes Detroit · capacity fit 91%', 'TOUR MATCH']],
  },
  promoter: {
    headline: 'Turn trust into turnout.',
    description: 'Promote shows your network will actually care about and share transparent ticket credit.',
    metrics: [['Link clicks', '4,218'], ['Ticket assists', '186'], ['Fan payout', '$1,428'], ['Conversion', '11.6%'], ['Active links', '9'], ['Top scene', 'Detroit']],
    actions: ['Create a HYPE campaign', 'Open referral analytics', 'Find high-fit events'],
    build: ['Promoter profile strength: 74%', 'Add scene specialties, verified channels, and payout preferences.'],
    insights: ['Personal recommendations convert 2.4× better than generic posts', 'Friday afternoon shares produce the most ticket assists', 'Punk events outperform your baseline in Hamtramck'],
    recommendations: [['City Lights release show', 'Your network match: 89%', 'PROMOTE'], ['Basement Signal Live', 'High Hamtramck conversion potential', 'LOCAL'], ['Great Lakes weekend pass', 'Wildcard outside your usual scene', 'WILDCARD']],
  },
  advertiser: {
    headline: 'Reach scenes. Keep data private.',
    description: 'Match music-only creative to aggregate location, genre, and HYPE signals—never personal profiles.',
    metrics: [['Qualified listens', '18.4K'], ['Completion rate', '84%'], ['Active regions', '4'], ['Cost per listen', '$0.08'], ['Genre matches', '9'], ['Scene lift', '+22%']],
    actions: ['Build a music-only campaign', 'Open aggregate heat map', 'Review creative matches'],
    build: ['Advertiser profile strength: 69%', 'Confirm campaign geography, music rights, tone, genre fit, and nonprofit disclosure.'],
    insights: ['Detroit indie soul listeners complete warm mid-tempo creative most often', 'HYPE density is rising along the Ann Arbor–Detroit corridor', 'Aggressive punk creative underperforms for this campaign tone'],
    recommendations: [['Wayne + Oakland counties', 'Strongest aggregate HYPE heat · 18–35 mi', 'GEO'], ['Alternative R&B / indie soul', 'Best background music and tone match', 'GENRE'], ['Great Lakes discovery shows', 'Regional context without individual targeting', 'PLACEMENT']],
  },
};

const roleActionHrefs: Record<RoleId, string[]> = {
  fan: ['/playlist/discovery', '/me/promote', '/shows/map'],
  artist: ['/me/dashboard', '/pages', '/me/analytics'],
  dj: ['/radio/studio', '/me/analytics', '/me/promote'],
  venue: ['/events/new', '/pages', '/pages'],
  promoter: ['/me/promote', '/me/promote/analytics', '/shows'],
  advertiser: ['/advertise/dashboard', '/advertise/dashboard', '/advertise/dashboard'],
};

function Icon({ name }: { name: 'search' | 'menu' | 'location' | 'calendar' | 'play' | 'pause' | 'skip' | 'add' | 'settings' | 'close' | 'previous' | 'next' | 'volume' | 'queue' }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="10.8" cy="10.8" r="6.4" /><path d="m16 16 4 4" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    play: <path d="m9 7 8 5-8 5Z" />,
    pause: <path d="M9 7v10M15 7v10" />,
    skip: <><path d="m15 7-6 5 6 5" /><path d="M6 7v10" /></>,
    add: <><path d="M12 5v14M5 12h14" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    previous: <><path d="m15 7-6 5 6 5" /><path d="M6 6v12" /></>,
    next: <><path d="m9 7 6 5-6 5" /><path d="M18 6v12" /></>,
    volume: <><path d="M5 10v4h3l4 4V6L8 10Z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
    queue: <><path d="M5 7h10M5 12h10M5 17h7" /><path d="m17 15 4 2.5-4 2.5Z" /></>,
  };
  return <svg aria-hidden="true" className="deck-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

function OpenSceneMap({
  noResults,
  onNativeZoom,
  onPin,
  selectedPlaceId,
  userCenter,
  venueMarkers,
  zoomIndex,
}: {
  noResults: boolean;
  onNativeZoom: (index: number) => void;
  onPin: (placeId: MapPlaceId) => void;
  selectedPlaceId: MapPlaceId;
  userCenter: [number, number] | null;
  venueMarkers: SceneVenueMarker[];
  zoomIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Array<{ id: MapPlaceId; marker: MapLibreMarker; element: HTMLButtonElement }>>([]);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const onPinRef = useRef(onPin);
  const onNativeZoomRef = useRef(onNativeZoom);
  const zoomIndexRef = useRef(zoomIndex);
  const venueMarkersRef = useRef(venueMarkers);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const zoom = mapZoomLevels[Math.max(0, Math.min(mapZoomLevels.length - 1, zoomIndex))];

  useEffect(() => { onPinRef.current = onPin; }, [onPin]);
  useEffect(() => { onNativeZoomRef.current = onNativeZoom; }, [onNativeZoom]);
  useEffect(() => { zoomIndexRef.current = zoomIndex; }, [zoomIndex]);
  useEffect(() => { venueMarkersRef.current = venueMarkers; }, [venueMarkers]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let loadTimer: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    setLoaded(false);
    setFailed(false);
    setFailureReason('');

    void import('maplibre-gl').then((maplibre) => {
      if (disposed || !containerRef.current) return;
      const initialZoom = mapZoomLevels[Math.max(0, Math.min(mapZoomLevels.length - 1, zoomIndexRef.current))];
      const camera = mapCameraByZoom[initialZoom.id];
      const map = new maplibre.Map({
        attributionControl: false,
        center: camera.center,
        container: containerRef.current,
        dragRotate: false,
        fadeDuration: 0,
        maxPitch: 0,
        pitchWithRotate: false,
        style: 'https://tiles.openfreemap.org/styles/fiord',
        touchPitch: false,
        zoom: camera.zoom,
      });
      mapRef.current = map;
      const markerIds: MapPlaceId[] = ['motor', 'painted', 'marble'];
      markersRef.current = markerIds.map((id, index) => {
        const element = document.createElement('button');
        const dot = document.createElement('span');
        const label = document.createElement('strong');
        const status = document.createElement('em');
        const venueMarker = zoomIndexRef.current <= 1 ? venueMarkersRef.current[index] : undefined;
        const markerLabel = venueMarker?.label ?? mapPinCopy[initialZoom.id][index];
        element.type = 'button';
        element.className = `real-map-marker marker-${id} signal-${index === 0 ? 'live' : index === 1 ? 'rising' : 'upcoming'}`;
        element.dataset.placeId = id;
        element.setAttribute('aria-label', `${markerLabel}. ${zoomIndexRef.current <= 1 ? 'Open venue and upcoming events' : 'Zoom into this scene'}`);
        element.classList.toggle('is-selected', id === selectedPlaceId);
        element.hidden = noResults;
        element.style.display = noResults ? 'none' : 'flex';
        label.textContent = markerLabel;
        status.textContent = index === 0 ? 'LIVE' : index === 1 ? 'RISING' : 'SOON';
        element.append(dot, label, status);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          onPinRef.current(id);
        });
        const marker = new maplibre.Marker({ anchor: 'bottom', element })
          .setLngLat(venueMarker?.coordinates ?? mapMarkerCoordinates[initialZoom.id][index])
          .addTo(map);
        return { id, marker, element };
      });

      const userElement = document.createElement('div');
      userElement.className = 'real-map-user';
      userElement.setAttribute('aria-label', 'Approximate location');
      userMarkerRef.current = new maplibre.Marker({ anchor: 'center', element: userElement })
        .setLngLat(userCenter ?? mapCameraByZoom.town.center)
        .addTo(map);

      const syncNativeZoom = () => {
        const nativeZoom = map.getZoom();
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        mapZoomLevels.forEach((level, index) => {
          const distance = Math.abs(mapCameraByZoom[level.id].zoom - nativeZoom);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });
        if (closestIndex !== zoomIndexRef.current) onNativeZoomRef.current(closestIndex);
      };

      map.on('zoomend', syncNativeZoom);
      map.on('error', (event) => {
        if (!disposed) setFailureReason(event.error?.message ?? 'Map resource error');
      });
      const markLoaded = () => {
        if (disposed) return;
        if (loadTimer !== null) window.clearTimeout(loadTimer);
        const canvas = map.getCanvas();
        canvas.setAttribute('aria-label', 'Detailed OpenFreeMap scene map');
        canvas.setAttribute('role', 'img');
        canvas.tabIndex = -1;
        setFailed(false);
        setLoaded(true);
      };
      map.once('load', markLoaded);
      map.once('style.load', markLoaded);
      map.once('idle', markLoaded);
      loadTimer = window.setTimeout(() => {
        if (disposed) return;
        if (map.isStyleLoaded()) markLoaded();
        else setFailed(true);
      }, 12000);
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    }).catch((error: unknown) => {
      if (!disposed) {
        setFailureReason(error instanceof Error ? error.message : 'Unknown map initialization error');
        setFailed(true);
      }
    });

    return () => {
      disposed = true;
      if (loadTimer !== null) window.clearTimeout(loadTimer);
      resizeObserver?.disconnect();
      markersRef.current = [];
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const camera = mapCameraByZoom[zoom.id];
    const center = userCenter && zoomIndex <= 1 ? userCenter : camera.center;
    map.easeTo({ center, duration: 520, essential: true, zoom: camera.zoom });
    markersRef.current.forEach(({ id, marker, element }, index) => {
      const venueMarker = zoomIndex <= 1 ? venueMarkers[index] : undefined;
      const label = venueMarker?.label ?? mapPinCopy[zoom.id][index];
      marker.setLngLat(venueMarker?.coordinates ?? mapMarkerCoordinates[zoom.id][index]);
      element.querySelector('strong')!.textContent = label;
      element.setAttribute('aria-label', `${label}. ${zoomIndex <= 1 ? 'Open venue and upcoming events' : 'Zoom into this scene'}`);
      element.classList.toggle('is-selected', id === selectedPlaceId);
      element.hidden = noResults;
      element.style.display = noResults ? 'none' : 'flex';
    });
    userMarkerRef.current?.setLngLat(userCenter ?? mapCameraByZoom.town.center);
  }, [noResults, selectedPlaceId, userCenter, venueMarkers, zoom.id, zoomIndex]);

  return <div className={`real-map-surface ${loaded ? 'is-loaded' : ''} ${failed ? 'has-failed' : ''}`} data-failure-reason={failureReason || undefined}>
    <div className="real-map-canvas" ref={containerRef} />
    {!loaded && !failed && <div className="real-map-loading"><span /><span /><span /><strong>Loading the scene map</strong><small>OpenFreeMap · OpenStreetMap data</small></div>}
    {failed && <div className="real-map-fallback"><strong>Map connection paused.</strong><span>The iHYPE filters still work. Reconnect to load streets and place detail.</span><button onClick={() => setAttempt((value) => value + 1)} type="button">Retry map</button></div>}
  </div>;
}

function SceneMap({ production }: { production: boolean }) {
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [privacyKeyOpen, setPrivacyKeyOpen] = useState(false);
  const [filter, setFilter] = usePersistentState<MapFilterId>('ihype:preview-map-filter', 'tonight');
  const [zoomIndex, setZoomIndex] = usePersistentState('ihype:preview-map-zoom', 1);
  const [date, setDate] = usePersistentState('ihype:preview-map-date', '2026-08-01');
  const [genre, setGenre] = usePersistentState('ihype:preview-map-genre', 'All genres');
  const [hypeOnly, setHypeOnly] = usePersistentState('ihype:preview-map-hype-only', false);
  const [location, setLocation] = useState(production ? 'Location private' : 'Detroit, MI');
  const [locationMessage, setLocationMessage] = useState(production ? 'Use your location to find nearby venues' : 'Centered on your saved scene');
  const [userCenter, setUserCenter] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<MapPlaceId>('motor');
  const [detailOpen, setDetailOpen] = useState(false);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [nearbyShows, setNearbyShows] = useState<NearbyShow[]>([]);
  const [nearbySource, setNearbySource] = useState<PreviewDataSource>('sample');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const zoom = mapZoomLevels[Math.max(0, Math.min(mapZoomLevels.length - 1, zoomIndex))];
  const noResults = filter === 'tour' && zoom.id === 'town';
  const sampleResultCount = Math.max(2, (filter === 'venues' ? 18 : filter === 'tour' ? 6 : 12) - (hypeOnly ? 7 : 0) - (genre === 'All genres' ? 0 : 3));
  const resultCount = nearbySource === 'live' && nearbyCount !== null && zoomIndex <= 3 ? nearbyCount : production ? 0 : sampleResultCount;
  const publicVenueShows = useMemo(() => nearbyShows
    .filter((show) => show.locationPrecision === 'exact-venue' && Number.isFinite(show.latitude) && Number.isFinite(show.longitude))
    .slice(0, 3), [nearbyShows]);
  const venueMarkers = useMemo<SceneVenueMarker[]>(() => {
    const ids: MapPlaceId[] = ['motor', 'painted', 'marble'];
    return publicVenueShows
      .map((show, index) => ({
        coordinates: [show.longitude as number, show.latitude as number],
        id: ids[index],
        label: `${show.venueName ?? show.venueProfile?.name ?? 'Local venue'} · ${show.title}`,
      }));
  }, [publicVenueShows]);
  const selectedPlaceIndex = (['motor', 'painted', 'marble'] as MapPlaceId[]).indexOf(selectedPlaceId);
  const selectedVenueShow = publicVenueShows[selectedPlaceIndex];
  const hasLiveVenue = publicVenueShows.length > 0;
  const hideSampleMarkers = production && !nearbyLoading && !hasLiveVenue;
  const selectedPlace = selectedVenueShow ? {
    ...mapPlaces[selectedPlaceId],
    name: selectedVenueShow.venueName ?? selectedVenueShow.venueProfile?.name ?? 'Local venue',
    event: selectedVenueShow.title,
    time: new Date(selectedVenueShow.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    hypes: `${selectedVenueShow.hypeCount.toLocaleString()} HYPES nearby`,
    lineup: 'Venue-submitted public location',
  } : mapPlaces[selectedPlaceId];

  useEffect(() => () => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    if (production && !userCenter) {
      setNearbyCount(0);
      setNearbyShows([]);
      setNearbySource('live');
      return;
    }
    const controller = new AbortController();
    const center = userCenter ?? mapCameraByZoom.town.center;
    const timer = window.setTimeout(() => {
      setNearbyLoading(true);
      void loadNearbyShows({
        latitude: center[1],
        longitude: center[0],
        radiusKm: zoom.radius * 1.60934,
        signal: controller.signal,
        allowSamples: !production,
      }).then((response) => {
        setNearbyCount(response.data.length);
        setNearbyShows(response.data);
        setNearbySource(response.source);
      }).catch(() => {
        if (!controller.signal.aborted) setNearbySource(production ? 'live' : 'sample');
      }).finally(() => {
        if (!controller.signal.aborted) setNearbyLoading(false);
      });
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [production, userCenter, zoom.radius]);

  const refreshMap = () => {
    setMapRefreshing(true);
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setMapRefreshing(false), 420);
  };

  const changeZoom = (nextIndex: number) => {
    const normalized = Math.max(0, Math.min(mapZoomLevels.length - 1, nextIndex));
    setZoomIndex(normalized);
    setDetailOpen(false);
    refreshMap();
    signalImplementationAction('mapQuery', { zoom: mapZoomLevels[normalized].id, filter, genre, hypeOnly, date });
  };

  const syncNativeZoom = (nextIndex: number) => {
    const normalized = Math.max(0, Math.min(mapZoomLevels.length - 1, nextIndex));
    if (normalized === zoomIndex) return;
    setZoomIndex(normalized);
    setDetailOpen(false);
    signalImplementationAction('mapQuery', { zoom: mapZoomLevels[normalized].id, filter, genre, hypeOnly, date, source: 'map-gesture' });
  };

  const openPin = (placeId: MapPlaceId) => {
    if (zoomIndex > 1) {
      changeZoom(zoomIndex - 1);
      return;
    }
    setSelectedPlaceId(placeId);
    setDetailOpen(true);
    const placeIndex = (['motor', 'painted', 'marble'] as MapPlaceId[]).indexOf(placeId);
    const liveShow = publicVenueShows[placeIndex];
    const fallbackPlace = mapPlaces[placeId];
    window.dispatchEvent(new CustomEvent('ihype:scene-venue-selected', { detail: {
      event: liveShow?.title ?? fallbackPlace.event,
      name: liveShow?.venueName ?? liveShow?.venueProfile?.name ?? fallbackPlace.name,
      time: liveShow ? new Date(liveShow.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }) : fallbackPlace.time,
    } }));
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser');
      return;
    }
    setLocating(true);
    setLocationMessage('Waiting for permission…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
        setLocationMessage('Using this device for nearby results');
        setUserCenter([coords.longitude, coords.latitude]);
        setLocating(false);
      },
      () => {
        setLocationMessage('Permission declined — saved scene retained');
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );
  };

  return (
    <section aria-labelledby="map-title" className="deck-module deck-map-module">
      <div className="deck-module-copy">
        <span className="deck-kicker">LIVE SCENE SIGNAL · {zoom.label.toUpperCase()} VIEW</span>
        <h1 id="map-title">Your scene,<br />right here.</h1>
        <p>Move from your town to the whole world without losing the local rooms, events, and HYPE signals that make each scene real.</p>
        <div className="deck-location-line"><Icon name="location" /><span><strong>{location}</strong><small>{locationMessage}</small></span></div>
        <button className="deck-button deck-button-primary" disabled={locating} onClick={locate} type="button">{locating ? 'Locating…' : 'Use my location'}</button>
      </div>

      <div className="scene-map-frame">
        <button aria-expanded={mapMenuOpen} aria-label={mapMenuOpen ? 'Close map filters' : 'Open map filters'} className="map-menu-button" onClick={() => setMapMenuOpen((value) => !value)} type="button"><Icon name={mapMenuOpen ? 'close' : 'menu'} /></button>
        {mapMenuOpen && (
          <div className="map-filter-panel">
            <span className="deck-kicker">EXPLORE THE MAP</span>
            <div className="map-scale-picker"><span>Scene scale</span><div>{mapZoomLevels.map((level, index) => <button aria-pressed={zoomIndex === index} key={level.id} onClick={() => changeZoom(index)} type="button">{level.label}</button>)}</div></div>
            <div className="map-filter-heading">SHOW ME</div>
            {([
              ['venues', 'Venues nearby'],
              ['tonight', 'Upcoming events'],
              ['date', 'Choose a date'],
              ['tour', 'Artist tour maps'],
            ] as Array<[typeof filter, string]>).map(([id, label]) => (
              <button aria-pressed={filter === id} data-api-path={implementationBindings.mapQuery.path} key={id} onClick={() => { setFilter(id); refreshMap(); signalImplementationAction('mapQuery', { zoom: zoom.id, filter: id, genre, hypeOnly, date }); }} type="button">{label}<span>↗</span></button>
            ))}
            {filter === 'date' && <label className="map-date"><span>Date</span><input onChange={(event) => { setDate(event.target.value); refreshMap(); signalImplementationAction('mapQuery', { zoom: zoom.id, filter, genre, hypeOnly, date: event.target.value }); }} type="date" value={date} /></label>}
            <label className="map-genre"><span>Genre</span><select onChange={(event) => { setGenre(event.target.value); refreshMap(); signalImplementationAction('mapQuery', { zoom: zoom.id, filter, genre: event.target.value, hypeOnly, date }); }} value={genre}><option>All genres</option><option>Alternative R&B</option><option>Electronic</option><option>Hip-hop</option><option>Indie</option><option>Jazz</option><option>Punk</option><option>Rock</option></select></label>
            <button aria-pressed={hypeOnly} className="map-hype-filter" data-api-path={implementationBindings.mapQuery.path} onClick={() => { const next = !hypeOnly; setHypeOnly(next); refreshMap(); signalImplementationAction('mapQuery', { zoom: zoom.id, filter, genre, hypeOnly: next, date }); }} type="button"><span>{hypeOnly ? '✓' : '+'}</span> Only things I HYPE</button>
            <small className="map-result-count">{noResults ? 'No tour signals at town scale — zoom out once' : `${resultCount} ${genre === 'All genres' ? '' : `${genre} `}signals · ${zoom.area}${hypeOnly ? ' · My HYPE' : ''}`}</small>
            <small aria-live="polite" className={`map-data-source source-${nearbySource}`}>{nearbyLoading ? 'Checking nearby shows…' : nearbySource === 'live' ? 'Live nearby-show API connected' : 'Alpha sample signals'}</small>
          </div>
        )}

        <div aria-label={`Interactive scene map showing ${filter} at ${zoom.label.toLowerCase()} scale centered on ${zoom.area}`} aria-busy={mapRefreshing} className={`scene-local-map ${mapRefreshing ? 'is-refreshing' : ''}`} data-zoom={zoom.id} role="application">
          <OpenSceneMap noResults={noResults || hideSampleMarkers} onNativeZoom={syncNativeZoom} onPin={openPin} selectedPlaceId={selectedPlaceId} userCenter={userCenter} venueMarkers={venueMarkers} zoomIndex={zoomIndex} />
          <div className="local-map-vignette" />
          <div className="map-scale-context"><span>{zoom.label.toUpperCase()} VIEW</span><strong>{zoom.area}</strong><small>{zoom.detail}</small></div>
          <div aria-label="Map zoom controls" className="map-zoom-controls" role="group"><button aria-label="Zoom in one level" disabled={zoomIndex === 0} onClick={() => changeZoom(zoomIndex - 1)} type="button">+</button><button aria-label="Zoom out one level" disabled={zoomIndex === mapZoomLevels.length - 1} onClick={() => changeZoom(zoomIndex + 1)} type="button">−</button></div>
          <button aria-expanded={privacyKeyOpen} className="map-trust-toggle" onClick={() => setPrivacyKeyOpen((value) => !value)} type="button"><span>●</span> Location privacy</button>
          {privacyKeyOpen && <div className="map-trust-panel"><span>WHAT THE MAP SHARES</span><p><b>Venues</b> use the public address supplied by that venue.</p><p><b>Artists + DJs</b> appear only as county-level scene signals.</p><p><b>Fans</b> stay private and never appear on this map.</p></div>}
          {noResults && <div className="map-empty-state"><strong>No tour signal at town scale.</strong><span>Move to county view to see routes passing nearby.</span><button onClick={() => changeZoom(1)} type="button">Open county view</button></div>}
          <div aria-hidden="true" className="map-result-loader"><span /><span /><span /></div>
          <div className="map-radius-readout"><span>{zoom.distance}</span><br /><small>drag, pinch, scroll, or use + / −</small></div><div className="map-attribution"><a href="https://openfreemap.org" rel="noreferrer" target="_blank">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a></div>
        </div>

        <div className="map-bottom-controls">
          <div className="map-level-rail">{mapZoomLevels.map((level, index) => <button aria-current={zoomIndex === index ? 'step' : undefined} aria-label={`Switch to ${level.label} view`} key={level.id} onClick={() => changeZoom(index)} type="button"><span />{level.label}</button>)}</div>
          <button className="map-place-detail" disabled={production && zoomIndex <= 1 && !hasLiveVenue} onClick={() => zoomIndex <= 1 ? setDetailOpen(true) : changeZoom(zoomIndex - 1)} type="button"><span className="map-live-dot" /><strong>{zoomIndex <= 1 ? hasLiveVenue || !production ? selectedPlace.name : 'Nearby venues appear here' : zoom.area}</strong><small>{zoomIndex <= 1 ? hasLiveVenue || !production ? `${selectedPlace.event} · ${selectedPlace.time}` : 'Share approximate location to load public venue events' : 'Select a scene pin to zoom closer'}</small><span className="map-open-page">{zoomIndex <= 1 ? hasLiveVenue || !production ? 'Events ↗' : 'Private by default' : 'Drill down'}</span></button>
        </div>
        {detailOpen && (!production || selectedVenueShow) && <aside aria-label={`${selectedPlace.name} details`} className="map-detail-sheet">
          <button aria-label="Close place details" className="map-detail-close" onClick={() => setDetailOpen(false)} type="button"><Icon name="close" /></button>
          <Image alt="Sample event artwork" height={92} src={selectedPlace.art} width={92} />
          <div className="map-detail-title"><span>SAMPLE ALPHA VENUE · {selectedPlace.distance}</span><h2>{selectedPlace.name}</h2><strong>{genre === 'All genres' ? 'Independent local music' : genre}</strong><small>{hypeOnly ? 'You HYPE this venue' : 'Recommended from your scene'}</small></div>
          <div className="map-detail-signal"><span>{selectedPlace.hypes}</span><small>{selectedPlace.lineup}</small></div>
          <div className="map-upcoming-events"><span>UPCOMING EVENTS</span><button type="button"><strong>{selectedPlace.event}</strong><small>{filter === 'date' ? date : selectedPlace.time} · Tickets available</small><i>↗</i></button><button type="button"><strong>{genre === 'All genres' ? 'Local discovery night' : `${genre} showcase`}</strong><small>Next Friday · Fan requests open</small><i>↗</i></button></div>
          <div className="map-detail-actions"><Link href="/pages">Venue page</Link><button type="button">Directions</button><button className="primary" type="button">Tickets</button></div>
        </aside>}
      </div>
    </section>
  );
}

function DiscoverModule({ production }: { production: boolean }) {
  const [trackIndex, setTrackIndex] = usePersistentState(production ? 'ihype:discover-index' : 'ihype:preview-discover-index', 0);
  const [liveTracks, setLiveTracks] = useState<ExperienceTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(production);
  const [decisionError, setDecisionError] = useState('');
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [decision, setDecision] = useState<'skip' | 'save' | null>(null);
  const [saved, setSaved] = usePersistentState(production ? 'ihype:discover-session-saves' : 'ihype:preview-discover-saved', production ? 0 : 47);
  const [lastAction, setLastAction] = useState<{ direction: 'skip' | 'save'; trackIndex: number } | null>(null);
  const dragStart = useRef<number | null>(null);
  const pointerSample = useRef({ x: 0, time: 0, velocity: 0 });
  const availableTracks = liveTracks.length > 0 ? liveTracks : discoveryTracks;
  const track = availableTracks[trackIndex % availableTracks.length];
  const nextTrack = availableTracks[(trackIndex + 1) % availableTracks.length];
  const canRecordDecision = !production || Boolean(track.mediaId);
  const swipeStrength = Math.min(1, Math.abs(dragX) / 150);

  useEffect(() => {
    if (!production) return;
    const controller = new AbortController();
    setTracksLoading(true);
    void loadDiscoveryTracks(controller.signal)
      .then(setLiveTracks)
      .catch(() => setDecisionError('Discovery could not refresh. Your previous view remains available.'))
      .finally(() => { if (!controller.signal.aborted) setTracksLoading(false); });
    return () => controller.abort();
  }, [production]);

  const advance = (direction: 'skip' | 'save') => {
    if (!canRecordDecision) {
      setDragX(0);
      setDragging(false);
      return;
    }
    setDecisionError('');
    signalImplementationAction('discoverDecision', { track: track.title, artist: track.artist, decision: direction === 'save' ? 'add' : 'skip' });
    if (production && track.mediaId) {
      void recordDiscoveryDecision(track.mediaId, direction).catch((error: unknown) => {
        setDecisionError(error instanceof Error ? error.message : 'Could not save that choice.');
      });
    }
    setLastAction({ direction, trackIndex });
    setDecision(direction);
    setDragging(false);
    if (direction === 'save') setSaved((value) => value + 1);
    setDragX(direction === 'save' ? 500 : -500);
    window.setTimeout(() => {
      setTrackIndex((value) => value + 1);
      setDragX(0);
      setDecision(null);
    }, 280);
  };
  const undo = () => {
    if (!lastAction) return;
    setTrackIndex(lastAction.trackIndex);
    if (lastAction.direction === 'save') setSaved((value) => Math.max(0, value - 1));
    setLastAction(null);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientX;
    pointerSample.current = { x: event.clientX, time: performance.now(), velocity: 0 };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const now = performance.now();
    const elapsed = Math.max(8, now - pointerSample.current.time);
    pointerSample.current = { x: event.clientX, time: now, velocity: (event.clientX - pointerSample.current.x) / elapsed };
    const raw = event.clientX - dragStart.current;
    const resisted = raw / (1 + Math.abs(raw) / 560);
    setDragX(Math.max(-220, Math.min(220, resisted)));
  };
  const onPointerUp = () => {
    const projected = dragX + pointerSample.current.velocity * 105;
    if (projected > 76) advance('save');
    else if (projected < -76) advance('skip');
    else setDragX(0);
    setDragging(false);
    dragStart.current = null;
  };
  const cancelDrag = () => {
    dragStart.current = null;
    setDragging(false);
    setDragX(0);
  };

  return (
    <section aria-labelledby="discover-title" className="deck-module discover-module">
      <div className="discover-copy">
        <span className="deck-kicker">DISCOVER · 75% YOUR SIGNAL / 25% WILD CARD</span>
        <h1 id="discover-title">One song.<br />One decision.</h1>
        <p>Swipe right when it belongs in your Discovery playlist. Swipe left when it does not. Your choices reshape what comes next.</p>
        <div className="discover-count"><strong>{saved}</strong><span>songs saved<br />{production ? 'this session' : 'to Discovery'}</span></div>
      </div>
      <div className={`discover-stage ${dragX > 10 ? 'intent-save' : dragX < -10 ? 'intent-skip' : ''}`} style={{ '--swipe-strength': swipeStrength } as CSSProperties}>
        <div aria-hidden="true" className="discover-signal-wash" />
        <div className={`swipe-outcome ${dragX < -35 ? 'is-visible' : ''}`}>SKIP</div>
        <div className={`swipe-outcome swipe-outcome-save ${dragX > 35 ? 'is-visible' : ''}`}>ADD</div>
        <div aria-hidden="true" className="discover-next-card" style={{ position: 'absolute' }}><Image alt="" fill sizes="(max-width: 800px) 72vw, 35vw" src={nextTrack.art} /><span>NEXT SIGNAL</span></div>
        <div aria-label={`${track.title} by ${track.artist}. Swipe left to skip or right to add.`} className={`discover-card ${dragging ? 'is-dragging' : ''} ${decision ? `is-${decision}` : ''}`} key={track.title} onPointerCancel={cancelDrag} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} role="group" style={{ position: 'relative', transform: `translate3d(${dragX}px,${Math.abs(dragX) * -.025}px,0) rotate(${dragX / 28}deg) scale(${1 - swipeStrength * .018})` }}>
          <Image alt="Placeholder artist portrait" draggable={false} fill priority sizes="(max-width: 800px) 82vw, 40vw" src={track.art} />
          <div className="discover-card-gradient" />
          <div className="discover-card-copy"><span>{tracksLoading ? 'Tuning your scene…' : production && !track.mediaId ? 'Waiting for local uploads' : track.match}</span><h2>{track.title}</h2><p>{track.artist}</p><small>{track.scene}</small><div className="discover-why"><b>WHY THIS SONG</b><i>{production && !track.mediaId ? 'Placeholder artwork leaves the layout ready for the first alpha uploads.' : track.match.toLowerCase().includes('wild') || track.match.toLowerCase().includes('random') ? 'A fresh wildcard outside your usual signal.' : 'Your scene, HYPES, and Discovery saves point here.'}</i></div></div>
        </div>
        <div className="discover-actions">
          <button aria-label="Skip this song" data-api-path={implementationBindings.discoverDecision.path} disabled={!canRecordDecision || tracksLoading} onClick={() => advance('skip')} type="button"><Icon name="skip" /><span>Skip</span></button>
          <button aria-label="Add this song to Discovery" className="save" data-api-path={implementationBindings.discoverDecision.path} disabled={!canRecordDecision || tracksLoading} onClick={() => advance('save')} type="button"><Icon name="add" /><span className="discover-action-full">Add to Discovery</span><span className="discover-action-short">Add</span></button>
        </div>
        {lastAction && <div aria-live="polite" className={`discover-feedback ${lastAction.direction}`}><span>{lastAction.direction === 'save' ? 'Added to Discovery' : 'Skipped for now'}</span><button onClick={undo} type="button">Undo</button></div>}
        {decisionError && <div aria-live="polite" className="discover-feedback skip"><span>{decisionError}</span></div>}
      </div>
    </section>
  );
}

function RadioModule({ production }: { production: boolean }) {
  const [genre, setGenre] = usePersistentState('ihype:preview-radio-genre', 'All sounds');
  const [location, setLocation] = usePersistentState('ihype:preview-radio-location', 'Near Detroit');
  const [topic, setTopic] = usePersistentState('ihype:preview-radio-topic', 'New releases');
  const [scope, setScope] = usePersistentState<RadioScope>('ihype:preview-radio-scope', 'local');
  const [favorites, setFavorites] = usePersistentState<string[]>('ihype:preview-radio-favorites', ['after-hours']);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [liveTracks, setLiveTracks] = useState<ExperienceTrack[]>([]);
  const [radioLoading, setRadioLoading] = useState(production);
  useEffect(() => {
    if (!production) return;
    const controller = new AbortController();
    setRadioLoading(true);
    void loadRadioTracks(controller.signal).then(setLiveTracks).catch(() => setLiveTracks([])).finally(() => {
      if (!controller.signal.aborted) setRadioLoading(false);
    });
    return () => controller.abort();
  }, [production]);
  const liveRecommendations = scope === 'local' ? liveTracks.slice(0, 8).map((track) => ({ id: track.mediaId ?? track.title, title: track.title, meta: `${track.artist} · ${track.scene}`, signal: 'Live catalog', time: 'PLAY' })) : [];
  const recommendationPool = production ? liveRecommendations : radioRecommendations[scope];
  const recommendations = recommendationPool.filter((station) => !favoritesOnly || favorites.includes(station.id));
  const heroTrack = production ? liveTracks[0] : null;
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id]);
  const playStation = (id: string) => {
    setPlaying(true);
    const track = liveTracks.find((item) => (item.mediaId ?? item.title) === id);
    if (track) window.dispatchEvent(new CustomEvent('ihype:play-track', { detail: track }));
  };
  const toggleHero = () => {
    if (heroTrack && !playing) window.dispatchEvent(new CustomEvent('ihype:play-track', { detail: heroTrack }));
    else if (playing) window.dispatchEvent(new Event('ihype:player-toggle'));
    setPlaying((value) => !value);
  };
  return (
    <section aria-labelledby="radio-title" className="deck-module radio-module">
      <div className="radio-heading">
        <span className="deck-kicker">RADIO · HUMAN-CURATED · MUSIC-ONLY SUPPORT</span>
        <h1 id="radio-title">Every scene<br />has a signal</h1>
        <p>Start close to home, then move through regional, national, and global independent radio without losing your favorites.</p>
        <div aria-label="Radio recommendation distance" className="radio-scope" role="group">
          {(Object.keys(radioRecommendations) as RadioScope[]).map((id) => <button aria-pressed={scope === id} key={id} onClick={() => { setScope(id); setFavoritesOnly(false); }} type="button">{id}</button>)}
        </div>
      </div>
      <div className="radio-console">
        <div className="radio-topline">
          <div className="radio-live-art"><div className="radio-rings"><span /><span /><span /><span /></div><button aria-label={playing ? 'Pause radio' : 'Play radio'} disabled={production && !heroTrack} onClick={toggleHero} type="button"><Icon name={playing ? 'pause' : 'play'} /></button></div>
          <div className="radio-now"><span>{playing ? 'LIVE NOW' : radioLoading ? 'TUNING' : 'READY TO PLAY'}</span><strong>{heroTrack?.title ?? (production ? 'Your local catalog' : 'Motor City After Dark')}</strong><small>{heroTrack ? `${heroTrack.artist} · ${heroTrack.scene}` : production ? 'Tracks appear as local artists publish them' : 'with Laila Stone · Detroit'}</small></div>
          <button aria-pressed={favoritesOnly} className="radio-favorites-toggle" onClick={() => setFavoritesOnly((value) => !value)} type="button">♥ <span>{favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}</span></button>
        </div>
        <div className="radio-filters">
          <label><span>Genre</span><select onChange={(event) => setGenre(event.target.value)} value={genre}><option>All sounds</option><option>Indie</option><option>Hip-hop</option><option>Electronic</option><option>Punk</option><option>Jazz</option></select></label>
          <label><span>Location</span><select onChange={(event) => setLocation(event.target.value)} value={location}><option>Near Detroit</option><option>Michigan</option><option>Great Lakes</option><option>Anywhere</option></select></label>
          <label><span>Topic</span><select onChange={(event) => setTopic(event.target.value)} value={topic}><option>New releases</option><option>Scene history</option><option>Live sessions</option><option>Artist interviews</option></select></label>
        </div>
        <div className="radio-results">
          <div className="radio-results-heading"><span>{favoritesOnly ? 'YOUR FAVORITES' : `${scope.toUpperCase()} RECOMMENDATIONS`}</span><small>{genre} · {location} · {topic}</small></div>
          {radioLoading && <div className="radio-empty"><strong>Tuning the local catalog…</strong></div>}
          {!radioLoading && recommendations.map((station) => <article key={station.id}><button aria-label={`Play ${station.title}`} className="radio-result-play" onClick={() => playStation(station.id)} type="button"><Icon name="play" /></button><span><strong>{station.title}</strong><small>{station.meta}</small></span><i>{station.signal}</i><b>{station.time}</b><button aria-label={`${favorites.includes(station.id) ? 'Remove' : 'Add'} ${station.title} ${favorites.includes(station.id) ? 'from' : 'to'} favorites`} aria-pressed={favorites.includes(station.id)} className="radio-favorite" onClick={() => toggleFavorite(station.id)} type="button">♥</button></article>)}
          {!radioLoading && recommendations.length === 0 && <div className="radio-empty"><strong>{production ? scope === 'local' ? 'No published local tracks are ready yet.' : `${scope} exchange recommendations arrive as alpha scenes connect.` : `No favorites in ${scope} yet.`}</strong>{favoritesOnly && <button onClick={() => setFavoritesOnly(false)} type="button">Show recommendations</button>}</div>}
        </div>
      </div>
    </section>
  );
}

function DashboardModule({ production, viewer }: { production: boolean; viewer?: DeckViewer }) {
  const viewerRoles = viewer?.roles.length ? viewer.roles : ['fan'] as RoleId[];
  const [role, setRole] = usePersistentState<RoleId>('ihype:preview-dashboard-role', viewerRoles[0]);
  const [assignedRoles, setAssignedRoles] = usePersistentState<RoleId[]>('ihype:preview-dashboard-assigned-roles', production ? viewerRoles : ['fan', 'artist']);
  const [managingRoles, setManagingRoles] = useState(false);
  const data = roleData[role];
  useEffect(() => {
    if (!assignedRoles.includes(role)) setRole(assignedRoles[0] ?? 'fan');
  }, [assignedRoles, role, setRole]);
  useEffect(() => {
    if (production) setAssignedRoles(viewerRoles);
  }, [production, setAssignedRoles, viewerRoles.join('|')]);
  const toggleRole = (id: RoleId) => {
    if (assignedRoles.includes(id)) {
      if (assignedRoles.length === 1) return;
      setAssignedRoles((current) => current.filter((assigned) => assigned !== id));
    } else setAssignedRoles((current) => [...current, id]);
  };
  return (
    <section aria-labelledby="dashboard-title" className="deck-module dashboard-module">
      <div className="dashboard-heading">
        <span className="deck-kicker">DASHBOARD · ONLY YOUR ACTIVE ROLES</span>
        <h1 id="dashboard-title">{data.headline}</h1>
        <p>{data.description}</p>
        <div aria-label="Choose dashboard role" className="role-picker" role="group">
          {assignedRoles.map((id) => <button aria-pressed={role === id} key={id} onClick={() => setRole(id)} type="button">{id}</button>)}
          {!production && <button aria-expanded={managingRoles} className="role-manage-button" onClick={() => setManagingRoles((value) => !value)} type="button">Manage roles</button>}
        </div>
        {!production && managingRoles && <div className="role-manager"><span>Alpha role preview</span><p>The live dashboard will derive these from verified account roles.</p><div>{(Object.keys(roleData) as RoleId[]).map((id) => <button aria-pressed={assignedRoles.includes(id)} key={id} onClick={() => toggleRole(id)} type="button"><span>{assignedRoles.includes(id) ? '✓' : '+'}</span>{id}</button>)}</div></div>}
        <article className="dashboard-build"><span>PAGE & WORKSPACE</span><strong>{data.build[0]}</strong><p>{data.build[1]}</p><Link href={role === 'dj' ? '/radio/studio' : role === 'venue' ? '/events/new' : role === 'advertiser' ? '/advertise/dashboard' : '/pages'}>Open editor ↗</Link></article>
      </div>
      <div className="dashboard-signal dashboard-workspace">
        <div className="dashboard-next"><span>NEXT BEST ACTION</span><strong>{data.actions[0]}</strong><Link href={roleActionHrefs[role][0]}>Start now ↗</Link></div>
        <div className="dashboard-metrics">{(viewer?.metrics?.[role] ?? data.metrics).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <section className="dashboard-recommendations"><div><span>{role === 'fan' ? 'MUSIC FOR YOU' : 'RECOMMENDED NEXT MOVES'}</span><small>{role === 'fan' ? 'Location + preferences + a permanent wildcard' : 'Built from aggregate, role-appropriate signal'}</small></div>{data.recommendations.map(([title, detail, tag]) => <button key={title} type="button"><span><strong>{title}</strong><small>{detail}</small></span><i>{tag}</i><b>↗</b></button>)}</section>
        <section className="dashboard-insights"><span>WHAT YOUR HYPE SIGNAL SAYS</span>{data.insights.map((insight, index) => <div key={insight}><strong>{String(index + 1).padStart(2, '0')}</strong><p>{insight}</p></div>)}</section>
        <div className="dashboard-actions">{data.actions.map((action, index) => <Link className={index === 0 ? 'primary' : ''} href={roleActionHrefs[role][index] ?? '/pages'} key={action}>{action}<span>↗</span></Link>)}</div>
      </div>
    </section>
  );
}

function SettingsModule({ demoState, onDemoStateChange, onReducedMotionChange, production, reducedMotion }: { demoState: DemoState; onDemoStateChange: (state: DemoState) => void; onReducedMotionChange: (value: boolean) => void; production: boolean; reducedMotion: boolean }) {
  const [theme, setTheme] = usePersistentState('ihype:preview-settings-theme', 'System');
  const [language, setLanguage] = usePersistentState('ihype:preview-settings-language', 'English');
  const [privateListening, setPrivateListening] = usePersistentState('ihype:preview-settings-private', false);
  const [location, setLocation] = usePersistentState('ihype:preview-settings-location', true);
  const [notifications, setNotifications] = usePersistentState('ihype:preview-settings-notifications', true);
  const [highContrast, setHighContrast] = usePersistentState('ihype:preview-settings-high-contrast', false);
  const [largerText, setLargerText] = usePersistentState('ihype:preview-settings-larger-text', false);
  const [underlineLinks, setUnderlineLinks] = usePersistentState('ihype:preview-settings-underline-links', false);
  const [readableFont, setReadableFont] = usePersistentState('ihype:preview-settings-readable-font', false);
  const [captions, setCaptions] = usePersistentState('ihype:preview-settings-captions', true);
  const [saveStatus, setSaveStatus] = useState('');
  const localeCodes: Record<string, string> = { English: 'en', Español: 'es', Français: 'fr', Português: 'pt', العربية: 'ar', Deutsch: 'de', 日本語: 'ja', 中文: 'zh', Italiano: 'it', 한국어: 'ko', हिन्दी: 'hi', Русский: 'ru' };
  const applyDeviceSetting = (key: string, value: unknown) => {
    if (!production) return;
    if (key === 'theme' && typeof value === 'string') {
      if (value === 'System') window.localStorage.removeItem('theme');
      else window.localStorage.setItem('theme', value.toLowerCase());
      const resolved = value === 'System' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : value.toLowerCase();
      document.documentElement.setAttribute('data-theme', resolved);
      return;
    }
    if (key === 'language' && typeof value === 'string') {
      const locale = localeCodes[value] ?? 'en';
      window.localStorage.setItem('ihype-locale', locale);
      document.cookie = `ihype_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      return;
    }
    const accessibilityKeys: Record<string, string> = { highContrast: 'highContrast', largerText: 'largeText', underlineLinks: 'underlineLinks', readableFont: 'readableFont', reducedMotion: 'reduceMotion' };
    if (key in accessibilityKeys && typeof value === 'boolean') {
      let current: Record<string, boolean> = {};
      try { current = JSON.parse(window.localStorage.getItem('ihype-accessibility-settings') ?? '{}') as Record<string, boolean>; } catch { current = {}; }
      current[accessibilityKeys[key]] = value;
      window.localStorage.setItem('ihype-accessibility-settings', JSON.stringify(current));
      const classes: Record<string, string> = { highContrast: 'high-contrast', largerText: 'a11y-large-text', underlineLinks: 'a11y-underline-links', readableFont: 'a11y-readable-font', reducedMotion: 'a11y-reduce-motion' };
      document.documentElement.classList.toggle(classes[key], value);
      return;
    }
    if (key === 'captions' && typeof value === 'boolean') window.localStorage.setItem('ihype-captions', String(value));
    if (key === 'privateListening' && typeof value === 'boolean') window.localStorage.setItem('ihype-private-listening', String(value));
    if (key === 'location' && typeof value === 'boolean') window.localStorage.setItem('ihype-location-personalization', String(value));
  };
  useEffect(() => {
    if (!production) return;
    const storedTheme = window.localStorage.getItem('theme');
    setTheme(storedTheme === 'light' ? 'Light' : storedTheme === 'dark' ? 'Dark' : 'System');
    const storedLocale = window.localStorage.getItem('ihype-locale') ?? 'en';
    const localeLabel = Object.entries(localeCodes).find(([, code]) => code === storedLocale)?.[0];
    if (localeLabel) setLanguage(localeLabel);
    try {
      const settings = JSON.parse(window.localStorage.getItem('ihype-accessibility-settings') ?? '{}') as Record<string, boolean>;
      setHighContrast(Boolean(settings.highContrast));
      setLargerText(Boolean(settings.largeText));
      setUnderlineLinks(Boolean(settings.underlineLinks));
      setReadableFont(Boolean(settings.readableFont));
      onReducedMotionChange(Boolean(settings.reduceMotion));
    } catch {
      // Invalid device preferences fall back to the safe defaults already rendered.
    }
    setCaptions(window.localStorage.getItem('ihype-captions') !== 'false');
    setPrivateListening(window.localStorage.getItem('ihype-private-listening') === 'true');
    setLocation(window.localStorage.getItem('ihype-location-personalization') !== 'false');
  }, [production]);
  const updateSetting = <T,>(key: string, setter: Dispatch<SetStateAction<T>>, value: T) => {
    setter(value);
    signalImplementationAction('settingsUpdate', { key, value });
    applyDeviceSetting(key, value);
    if (production && key === 'notifications' && typeof value === 'boolean') {
      setSaveStatus('Saving…');
      void updateSceneNotifications(value).then(() => setSaveStatus('Saved')).catch(() => setSaveStatus('Could not save notification settings'));
    }
  };
  return (
    <section aria-labelledby="settings-title" className="deck-module settings-module">
      <div className="settings-heading"><span className="deck-kicker">SETTINGS · YOU ARE IN CONTROL</span><h1 id="settings-title">Your app.<br />Your rules.</h1><p>Everything important is visible, understandable, and reversible.</p></div>
      <div className="settings-board" data-api-path={implementationBindings.settingsUpdate.path}>
        <div className="settings-section settings-appearance"><span>LANGUAGE & APPEARANCE</span><label><strong>Language</strong><select onChange={(event) => updateSetting('language', setLanguage, event.target.value)} value={language}><option>English</option><option>Español</option><option>Français</option><option>Português</option><option>العربية</option><option>Deutsch</option><option>日本語</option><option>中文</option><option>Italiano</option><option>한국어</option><option>हिन्दी</option><option>Русский</option></select></label><label><strong>Theme</strong><select onChange={(event) => updateSetting('theme', setTheme, event.target.value)} value={theme}><option>System</option><option>Dark</option><option>Light</option></select></label></div>
        <div className="settings-section settings-accessibility"><span>ACCESSIBILITY</span><label><span><strong>Reduce motion</strong><small>Minimize transitions and animated artwork</small></span><input checked={reducedMotion} onChange={(event) => { onReducedMotionChange(event.target.checked); signalImplementationAction('settingsUpdate', { key: 'reducedMotion', value: event.target.checked }); applyDeviceSetting('reducedMotion', event.target.checked); }} type="checkbox" /></label><label><span><strong>High contrast</strong><small>Increase borders and text separation</small></span><input checked={highContrast} onChange={(event) => updateSetting('highContrast', setHighContrast, event.target.checked)} type="checkbox" /></label><label><span><strong>Larger interface text</strong><small>Increase labels and supporting copy</small></span><input checked={largerText} onChange={(event) => updateSetting('largerText', setLargerText, event.target.checked)} type="checkbox" /></label><label><span><strong>Underline links</strong><small>Make text links easier to identify</small></span><input checked={underlineLinks} onChange={(event) => updateSetting('underlineLinks', setUnderlineLinks, event.target.checked)} type="checkbox" /></label><label><span><strong>Readable font</strong><small>Use a simpler typeface for long reading</small></span><input checked={readableFont} onChange={(event) => updateSetting('readableFont', setReadableFont, event.target.checked)} type="checkbox" /></label><label><span><strong>Captions and transcripts</strong><small>Prefer available text for radio and video</small></span><input checked={captions} onChange={(event) => updateSetting('captions', setCaptions, event.target.checked)} type="checkbox" /></label></div>
        <div className="settings-section"><span>PRIVACY & DISCOVERY</span><label><span><strong>Use location for nearby music</strong><small>Approximate location only</small></span><input checked={location} onChange={(event) => updateSetting('location', setLocation, event.target.checked)} type="checkbox" /></label><label><span><strong>Private listening</strong><small>Do not use this session for recommendations</small></span><input checked={privateListening} onChange={(event) => updateSetting('privateListening', setPrivateListening, event.target.checked)} type="checkbox" /></label></div>
        <div className="settings-section"><span>NOTIFICATIONS</span><label><span><strong>Scene alerts</strong><small>Shows, artists, and radio you HYPE</small></span><input checked={notifications} onChange={(event) => updateSetting('notifications', setNotifications, event.target.checked)} type="checkbox" /></label></div>
        {production && saveStatus && <div aria-live="polite" className="settings-save-status">{saveStatus}</div>}
        {!production && <div className="settings-section settings-alpha-states"><span>ALPHA EXPERIENCE STATES</span><p>Preview the states every module needs before launch.</p><div>{(['normal', 'loading', 'empty', 'offline', 'error', 'playback'] as DemoState[]).map((state) => <button aria-pressed={demoState === state} key={state} onClick={() => onDemoStateChange(state)} type="button">{state}</button>)}</div></div>}
        <div className="settings-foot"><span>We never sell your data.</span><button onClick={() => { window.location.href = '/api/privacy/export'; }} type="button">Download my data</button><button onClick={() => { window.location.href = '/privacy'; }} type="button">Privacy details</button></div>
      </div>
    </section>
  );
}

function CommunityModule({ production }: { production: boolean }) {
  const [section, setSection] = usePersistentState<CommunitySection>('ihype:preview-community-section', 'voting');
  const [vote, setVote] = useState<'support' | 'oppose' | null>(null);
  const sectionCopy: Record<CommunitySection, { kicker: string; title: string; description: string }> = {
    voting: { kicker: 'COMMUNITY VOTING · EVERY FAN GETS A VOICE', title: 'The scene helps choose what comes next.', description: 'Proposals remain public, discussion stays attached, and every eligible fan account gets one transparent vote.' },
    info: { kicker: '501(C)(3) · SCENE-FOCUSED · SCENE-RUN', title: 'The platform does not own the signal. You do.', description: 'iHYPE exists to renew local music by turning trusted community signal into discovery, attendance, and fair opportunity.' },
    legal: { kicker: 'LEGAL & PRIVACY · PLAIN LANGUAGE FIRST', title: 'Trust only works when the rules are visible.', description: 'Your data supports your experience. It is never sold, and every important policy should be understandable before you agree.' },
    dmca: { kicker: 'DMCA · RIGHTS-HOLDER RESPONSE', title: 'Protect the music and the people who made it.', description: 'Rights holders can report material, artists can respond, and every action follows a documented review path.' },
  };
  const copy = sectionCopy[section];
  const castVote = (choice: 'support' | 'oppose') => {
    if (production) {
      window.location.href = '/community';
      return;
    }
    setVote(choice);
    signalImplementationAction('communityVote', { proposal: 'discovery-local-only-mode', choice });
  };
  return (
    <section aria-labelledby="community-title" className="deck-module community-module">
      <div className="community-manifesto"><span className="deck-kicker">{copy.kicker}</span><h1 id="community-title">{copy.title}</h1><p>{copy.description}</p></div>
      <div className="community-board">
        <nav aria-label="Community sections" className="community-subnav">
          {([['voting', 'Voting'], ['info', 'Info'], ['legal', 'Legal & privacy'], ['dmca', 'DMCA']] as Array<[CommunitySection, string]>).map(([id, label]) => <button aria-current={section === id ? 'page' : undefined} key={id} onClick={() => setSection(id)} type="button">{label}</button>)}
        </nav>
        {section === 'voting' && <div className="community-panel community-vote-panel"><span>{production ? 'COMMUNITY VOTING · VERIFIED FAN ACCOUNTS' : 'OPEN COMMUNITY PROPOSAL · 12 DAYS LEFT'}</span><h2>Should Discovery add a local-only listening mode?</h2><p>When enabled, the feed would temporarily use music within the listener’s selected radius while leaving the permanent wildcard system unchanged elsewhere.</p><div className="community-vote-tally"><strong>{production ? '1' : '72%'}</strong><span><i style={{ width: production ? '100%' : '72%' }} />{production ? 'voice per verified fan' : '1,842 verified fan votes'}</span></div><div className="community-vote-actions"><button aria-pressed={vote === 'support'} data-api-path={implementationBindings.communityVote.path} onClick={() => castVote('support')} type="button">{production ? 'Open community voting' : 'Support proposal'}</button>{!production && <button aria-pressed={vote === 'oppose'} data-api-path={implementationBindings.communityVote.path} onClick={() => castVote('oppose')} type="button">Keep current mix</button>}</div>{vote && !production && <small aria-live="polite">Your sample vote is recorded locally for this editable preview.</small>}</div>}
        {section === 'info' && <div className="community-panel community-principles"><article><strong>01</strong><h2>No data sales. Ever.</h2><p>Activity improves local recommendations—not a profile sold to somebody else.</p></article><article><strong>02</strong><h2>Music supports music.</h2><p>Music-only radio ads fund infrastructure, transparent wages, and the scene.</p></article><article><strong>03</strong><h2>Signal becomes opportunity.</h2><p>HYPES can become attendance, ticket sales, and fair payouts.</p></article><article><strong>04</strong><h2>Community has a vote.</h2><p>Feature changes remain accountable to the fans who use the platform.</p></article></div>}
        {section === 'legal' && <div className="community-panel community-policy-list"><article><span>PRIVACY</span><strong>Minimum data, clear purpose</strong><p>Approximate location, transparent controls, accessible exports, and no data sales.</p><Link href="/privacy">Read privacy policy ↗</Link></article><article><span>TERMS</span><strong>Plain-language participation rules</strong><p>Clear expectations for accounts, uploads, tickets, promotions, and community conduct.</p><Link href="/terms">Read terms ↗</Link></article><article><span>TRANSPARENCY</span><strong>Public nonprofit accountability</strong><p>Governance, major policy changes, and community decisions should be easy to inspect.</p><Link href="/info">Transparency center ↗</Link></article></div>}
        {section === 'dmca' && <div className="community-panel community-dmca"><span>RIGHTS PROTECTION WORKFLOW</span><ol><li><strong>Submit a notice</strong><p>Identify the work, the reported material, and your authority to act.</p></li><li><strong>Human review</strong><p>iHYPE records the request, checks required details, and limits access when appropriate.</p></li><li><strong>Artist response</strong><p>The uploader receives notice and a documented counter-notice path.</p></li></ol><div><Link href="/dmca">Read the DMCA policy</Link><Link href="/dmca">Start a report</Link></div></div>}
      </div>
    </section>
  );
}

function PlayerMarquee({ artist, title }: { artist: string; title: string }) {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const copyRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current || !copyRef.current) return;
      setOverflowing(copyRef.current.scrollWidth > viewportRef.current.clientWidth + 2);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (viewportRef.current) observer?.observe(viewportRef.current);
    if (copyRef.current) observer?.observe(copyRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [artist, title]);

  const copy = (hidden = false) => <span aria-hidden={hidden || undefined} className="deck-player-marquee-copy" ref={hidden ? undefined : copyRef}><strong>{title}</strong><i>·</i><small>{artist}</small></span>;
  return <span className="deck-player-marquee" ref={viewportRef}><span className={`deck-player-marquee-track ${overflowing ? 'is-scrolling' : ''}`}>{copy()}{overflowing && copy(true)}</span></span>;
}

function PlayerWaveform({ playing }: { playing: boolean }) {
  return <span aria-hidden="true" className={`deck-player-waveform ${playing ? 'is-playing' : ''}`}>{[7, 13, 19, 10, 16, 8, 20, 12, 17, 9, 14, 6].map((height, index) => <i key={`${height}-${index}`} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * -90}ms` } as CSSProperties} />)}</span>;
}

function useArtworkPalette(src: string) {
  const [palette, setPalette] = useState('255,77,46');
  useEffect(() => {
    let disposed = false;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 18;
        canvas.height = 18;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let samples = 0;
        for (let index = 0; index < pixels.length; index += 16) {
          const brightness = pixels[index] + pixels[index + 1] + pixels[index + 2];
          if (pixels[index + 3] < 180 || brightness < 70 || brightness > 720) continue;
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
          samples += 1;
        }
        if (!disposed && samples > 0) setPalette(`${Math.round(red / samples)},${Math.round(green / samples)},${Math.round(blue / samples)}`);
      } catch {
        // The branded fallback palette remains if an image cannot be sampled.
      }
    };
    image.src = src;
    return () => { disposed = true; };
  }, [src]);
  return palette;
}

type HypeIntensity = 'pulse' | 'scene-wave';

function formatPlayerTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function CompactPlayer({ activeModule, onHype, onPlayingChange, production }: { activeModule: ModuleId; onHype: (intensity: HypeIntensity) => void; onPlayingChange: (playing: boolean) => void; production: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [queueOpen, setQueueOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [hypeCount, setHypeCount] = useState(production ? 0 : 2418);
  const [externalTrack, setExternalTrack] = useState<ExperienceTrack | null>(null);
  const [playbackError, setPlaybackError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [venueContext, setVenueContext] = useState<{ event: string; name: string; time: string } | null>(null);
  const hypeHoldTimer = useRef<number | null>(null);
  const hypeHoldTriggered = useRef(false);
  const venueContextTimer = useRef<number | null>(null);
  const [playerIndex, setPlayerIndex] = usePersistentState('ihype:preview-player-track', 0);
  const [queue, setQueue] = usePersistentState(production ? 'ihype:play-queue' : 'ihype:preview-queue', production ? [] : [
    { id: 'pressure', title: 'Pressure', artist: 'Milo Coast', duration: '3:21', type: 'track' },
    { id: 'ad-one', title: 'Scene supporter message', artist: 'Music-only ad · 0:20', duration: 'AD', type: 'ad' },
    { id: 'plans', title: 'Different Plans', artist: 'Rooke', duration: '2:47', type: 'track' },
    { id: 'sunbreak', title: 'Sunbreak', artist: 'Hotel Barrio', duration: '3:09', type: 'track' },
  ]);

  useEffect(() => setMounted(true), []);
  useEffect(() => onPlayingChange(playing), [onPlayingChange, playing]);

  useEffect(() => {
    if (!production) return;
    const controller = new AbortController();
    void loadRadioTracks(controller.signal).then((tracks) => {
      if (tracks[0]) setExternalTrack(tracks[0]);
    }).catch(() => {
      // The neutral player remains ready while the catalog is unavailable.
    });
    return () => controller.abort();
  }, [production]);

  const baseTrack = production
    ? { mediaId: null, title: 'Choose a local track', artist: 'Open Discover or Radio to begin', art: '/brand/ihype-menu-logo.webp', scene: 'Your scene', match: 'Ready for a real local signal' }
    : previewPlayerTracks[playerIndex % previewPlayerTracks.length];
  const playerTrack = externalTrack ?? (activeModule === 'radio' && !production
    ? { mediaId: null, title: 'Motor City After Dark', artist: 'Laila Stone', art: '/brand/alpha-show-4.png', scene: 'Detroit radio', match: 'Alpha radio placeholder' }
    : baseTrack);
  const artworkPalette = useArtworkPalette(playerTrack.art);
  const canPlay = !production || Boolean(playerTrack.url);
  const canHype = !production || Boolean(playerTrack.mediaId);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playerTrack.url) return;
    if (playing) {
      setPlaybackError('');
      void audio.play().catch(() => {
        setPlaying(false);
        setPlaybackError('This track could not start. Try the next local signal.');
      });
    } else audio.pause();
  }, [playerTrack.url, playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  const moveQueueItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    setQueue((items) => {
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };
  const removeQueueItem = (id: string) => setQueue((items) => items.filter((item) => item.id !== id));
  const changeTrack = (direction: -1 | 1) => {
    if (production) {
      const controller = new AbortController();
      void loadRadioTracks(controller.signal).then((tracks) => {
        const candidates = tracks.filter((track) => track.mediaId !== playerTrack.mediaId);
        const next = direction > 0 ? candidates[0] : candidates[candidates.length - 1];
        if (!next) {
          setPlaying(false);
          setPlaybackError('No other published tracks are ready yet.');
          return;
        }
        setExternalTrack(next);
        setHypeCount(next.hypeCount ?? 0);
        setCurrentTime(0);
        setLiked(false);
        setPlaying(true);
      }).catch(() => setPlaybackError('The next local signal could not be loaded.'));
      return;
    }
    setExternalTrack(null);
    setPlayerIndex((current) => (current + direction + previewPlayerTracks.length) % previewPlayerTracks.length);
    setLiked(false);
    setPlaying(true);
  };
  const triggerHype = (intensity: HypeIntensity) => {
    if (!liked) setHypeCount((count) => count + 1);
    setLiked(true);
    onHype(intensity);
    if (production && playerTrack.mediaId) {
      void recordDiscoveryDecision(playerTrack.mediaId, 'hype').catch(() => setPlaybackError('Your HYPE could not be saved. Please try again.'));
    }
    if (navigator.vibrate) navigator.vibrate(intensity === 'scene-wave' ? [18, 35, 28] : 14);
  };
  const beginHypeHold = () => {
    hypeHoldTriggered.current = false;
    if (hypeHoldTimer.current !== null) window.clearTimeout(hypeHoldTimer.current);
    hypeHoldTimer.current = window.setTimeout(() => {
      hypeHoldTriggered.current = true;
      triggerHype('scene-wave');
    }, 520);
  };
  const endHypeHold = () => {
    if (hypeHoldTimer.current !== null) window.clearTimeout(hypeHoldTimer.current);
    hypeHoldTimer.current = null;
  };
  const clickHype = () => {
    if (hypeHoldTriggered.current) {
      hypeHoldTriggered.current = false;
      return;
    }
    if (liked && !production) setLiked(false);
    else triggerHype('pulse');
  };
  const shareTrack = async () => {
    const url = playerTrack.hexId ? `${window.location.origin}/tracks/${playerTrack.hexId}` : window.location.href;
    const text = `${playerTrack.title} by ${playerTrack.artist} on iHYPE`;
    const nativeShare = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    const usedNativeShare = typeof nativeShare === 'function';
    try {
      if (usedNativeShare) await nativeShare.call(navigator, { title: text, text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
      setPlaybackError(usedNativeShare ? '' : 'Track link copied.');
    } catch {
      // Closing the native share sheet is not an application error.
    }
  };

  useEffect(() => {
    const togglePlayback = () => setPlaying((value) => !value);
    const hypeCurrent = () => {
      if (!liked && (!production || playerTrack.mediaId)) triggerHype('pulse');
    };
    const showVenue = (event: Event) => {
      const detail = (event as CustomEvent<{ event: string; name: string; time: string }>).detail;
      setVenueContext(detail);
      if (venueContextTimer.current !== null) window.clearTimeout(venueContextTimer.current);
      venueContextTimer.current = window.setTimeout(() => setVenueContext(null), 7200);
    };
    const playTrack = (event: Event) => {
      const detail = (event as CustomEvent<ExperienceTrack>).detail;
      if (!detail?.title) return;
      setExternalTrack(detail);
      setHypeCount(detail.hypeCount ?? 0);
      setLiked(false);
      setPlaying(true);
    };
    window.addEventListener('ihype:player-toggle', togglePlayback);
    window.addEventListener('ihype:player-hype', hypeCurrent);
    window.addEventListener('ihype:scene-venue-selected', showVenue);
    window.addEventListener('ihype:play-track', playTrack);
    return () => {
      window.removeEventListener('ihype:player-toggle', togglePlayback);
      window.removeEventListener('ihype:player-hype', hypeCurrent);
      window.removeEventListener('ihype:scene-venue-selected', showVenue);
      window.removeEventListener('ihype:play-track', playTrack);
      if (hypeHoldTimer.current !== null) window.clearTimeout(hypeHoldTimer.current);
      if (venueContextTimer.current !== null) window.clearTimeout(venueContextTimer.current);
    };
  }, [liked]);

  return (<>
    <div aria-label="Persistent music player" className={`deck-player context-${activeModule} ${activeModule === 'discover' || activeModule === 'radio' ? 'is-featured' : ''} ${playing ? 'is-playing' : ''}`} role="region" style={{ '--art-rgb': artworkPalette } as CSSProperties}>
      <audio onEnded={() => changeTrack(1)} onError={() => { if (playerTrack.url) setPlaybackError('This track is temporarily unavailable.'); }} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} preload="metadata" ref={audioRef} src={playerTrack.url ?? undefined} />
      <div aria-hidden="true" className="deck-player-aura" />
      {venueContext && <div aria-live="polite" className="deck-player-context-card"><span>HAPPENING NEAR YOU</span><strong>{venueContext.name}</strong><small>{venueContext.event} · {venueContext.time}</small><button aria-label="Dismiss nearby event" onClick={() => setVenueContext(null)} type="button">×</button></div>}
      <button aria-label="Open full player" className="deck-player-track-button" onClick={() => setExpanded(true)} type="button"><span className="deck-player-art" key={playerTrack.art}><Image alt="" height={52} src={playerTrack.art} width={52} /><PlayerWaveform playing={playing} /></span><span aria-live="polite" className="deck-player-copy" key={`${playerTrack.title}-${playerTrack.artist}`}><span>{activeModule === 'radio' ? 'RADIO' : playing ? 'NOW PLAYING' : 'READY'}</span><PlayerMarquee artist={playerTrack.artist} title={playerTrack.title} /></span></button>
      <div className="deck-player-controls">
        <button aria-label="Previous song" onClick={() => changeTrack(-1)} type="button"><Icon name="previous" /></button>
        <button aria-label={playing ? 'Pause' : 'Play'} className="deck-player-play" disabled={!canPlay} onClick={() => setPlaying((value) => !value)} type="button"><Icon name={playing ? 'pause' : 'play'} /></button>
        <button aria-label="Next song" onClick={() => changeTrack(1)} type="button"><Icon name="next" /></button>
      </div>
      <div aria-label={`${formatPlayerTime(currentTime)} of ${formatPlayerTime(duration)}`} className="deck-player-progress"><span style={{ width: duration > 0 ? `${Math.min(100, currentTime / duration * 100)}%` : '0%' }} /></div>
      <label className="deck-player-volume"><Icon name="volume" /><span className="sr-only">Volume</span><input aria-label="Volume" max="100" min="0" onChange={(event) => setVolume(Number(event.target.value))} type="range" value={volume} /></label>
      <button aria-expanded={queueOpen} aria-label="Open play queue" className="deck-player-queue-button" onClick={() => setQueueOpen((value) => !value)} type="button"><Icon name="queue" /></button>
      <button aria-label={`${liked ? 'Remove HYPE from' : 'HYPE'} ${playerTrack.title}. Press and hold to send a scene wave.`} aria-pressed={liked} className={`deck-player-hype ${liked ? 'is-hyped' : ''}`} disabled={!canHype} onClick={clickHype} onPointerCancel={endHypeHold} onPointerDown={beginHypeHold} onPointerLeave={endHypeHold} onPointerUp={endHypeHold} type="button"><span>{liked ? 'HYPED' : 'HYPE'}</span><small>{hypeCount.toLocaleString()}</small><i aria-hidden="true" className="hype-burst"><b /><b /><b /><b /><b /><b /><b /><b /></i></button>
      {queueOpen && <div className="deck-player-queue"><div className="queue-heading"><span>UP NEXT</span><button onClick={() => setQueue([])} type="button">Clear</button></div>{queue.length === 0 ? <p>Queue cleared. Discovery will keep the music moving.</p> : queue.map((item, index) => <div className={`queue-row ${item.type}`} key={item.id}><span><strong>{item.title}</strong><small>{item.artist} · {item.duration}</small></span>{item.type === 'track' && <span className="queue-row-actions"><button aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => moveQueueItem(index, -1)} type="button">↑</button><button aria-label={`Move ${item.title} down`} disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, 1)} type="button">↓</button><button aria-label={`Remove ${item.title}`} onClick={() => removeQueueItem(item.id)} type="button">×</button></span>}</div>)}</div>}
      {playbackError && <div aria-live="polite" className="deck-player-error">{playbackError}</div>}
    </div>
      {mounted && expanded ? createPortal(<div aria-label="Full music player" aria-modal="true" className={`deck-full-player ${playing ? 'is-playing' : ''}`} role="dialog" style={{ '--art-rgb': artworkPalette } as CSSProperties}>
        <button aria-label="Close full player" className="full-player-close" onClick={() => setExpanded(false)} type="button"><Icon name="close" /></button>
        <div className="full-player-art" key={playerTrack.art} style={{ position: 'relative' }}><Image alt={`Sample artwork for ${playerTrack.title}`} fill priority sizes="(max-width: 800px) 78vw, 36vw" src={playerTrack.art} /><PlayerWaveform playing={playing} /></div>
        <div className="full-player-main" key={`${playerTrack.title}-${playerTrack.artist}`}><span className="deck-kicker">{production ? 'LOCAL TRACK' : 'SAMPLE ALPHA TRACK'} · {playerTrack.scene.toUpperCase()}</span><h2>{playerTrack.title}</h2><Link href={playerTrack.artistSlug ? `/artists/${playerTrack.artistSlug}` : '/pages'}>{playerTrack.artist} ↗</Link><p>“Local sound, carried by a real scene.”</p><div className="full-player-progress"><span>{formatPlayerTime(currentTime)}</span><div><i style={{ width: duration > 0 ? `${Math.min(100, currentTime / duration * 100)}%` : '0%' }} /></div><span>{formatPlayerTime(duration)}</span></div><div className="full-player-controls"><button aria-label="Previous song" onClick={() => changeTrack(-1)} type="button"><Icon name="previous" /></button><button aria-label={playing ? 'Pause' : 'Play'} disabled={!canPlay} onClick={() => setPlaying((value) => !value)} type="button"><Icon name={playing ? 'pause' : 'play'} /></button><button aria-label="Next song" onClick={() => changeTrack(1)} type="button"><Icon name="next" /></button></div><div className="full-player-actions"><button aria-pressed={liked} disabled={!canHype} onClick={clickHype} type="button">{liked ? `HYPED · ${hypeCount.toLocaleString()}` : 'HYPE'}</button><button disabled={!playerTrack.mediaId} onClick={() => { if (playerTrack.mediaId) void recordDiscoveryDecision(playerTrack.mediaId, 'save'); }} type="button">Add to Discovery</button><button onClick={() => void shareTrack()} type="button">Share</button></div><div className="full-player-notes"><span>WHY THIS TRACK</span><p>{production ? playerTrack.match : '75% from your Detroit scene, alternative R&B HYPES, and Discovery saves · 25% wildcard keeps the signal open.'}</p></div></div>
        <aside className="full-player-queue"><div className="queue-heading"><span>PLAY QUEUE</span><button onClick={() => setQueue([])} type="button">Clear</button></div>{queue.map((item, index) => <div className={`queue-row ${item.type}`} key={item.id}><span><strong>{item.title}</strong><small>{item.artist} · {item.duration}</small></span>{item.type === 'track' && <span className="queue-row-actions"><button aria-label={`Move ${item.title} up`} disabled={index === 0} onClick={() => moveQueueItem(index, -1)} type="button">↑</button><button aria-label={`Move ${item.title} down`} disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, 1)} type="button">↓</button><button aria-label={`Remove ${item.title}`} onClick={() => removeQueueItem(item.id)} type="button">×</button></span>}</div>)}</aside>
      </div>, document.body) : null}
    </>
  );
}

function DemoStateOverlay({ copy, onRecover, state }: { copy: [string, string]; onRecover: () => void; state: Exclude<DemoState, 'normal'> }) {
  const action = state === 'loading' ? 'Finish loading' : state === 'offline' ? 'Use saved preview' : state === 'playback' ? 'Skip unavailable track' : 'Try again';
  return <div aria-live="polite" className={`deck-demo-state state-${state}`} role={state === 'error' ? 'alert' : 'status'}>
    <div aria-hidden="true" className="demo-state-visual">
      <span /><span /><span /><i />
    </div>
    <span>{state === 'loading' ? 'BUILDING YOUR SCENE' : state === 'offline' ? 'SAVED MODE' : state === 'empty' ? 'OPEN SIGNAL' : state === 'playback' ? 'KEEP LISTENING' : 'SIGNAL INTERRUPTED'}</span>
    <h2>{copy[0]}</h2>
    <p>{copy[1]}</p>
    <button onClick={onRecover} type="button">{action}<b>↗</b></button>
  </div>;
}

export function ModuleDeckMockup({ production = false, viewer }: { production?: boolean; viewer?: DeckViewer } = {}) {
  const [activeIndex, setActiveIndex] = usePersistentState('ihype:preview-active-module', 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [transition, setTransition] = useState<'idle' | 'up-out' | 'up-in' | 'down-out' | 'down-in'>('idle');
  const [logoAnimating, setLogoAnimating] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>('normal');
  const [reducedMotion, setReducedMotion] = usePersistentState('ihype:preview-settings-reduced-motion', false);
  const [pageVisible, setPageVisible] = useState(true);
  const [searchMatches, setSearchMatches] = useState<PreviewSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSource, setSearchSource] = useState<PreviewDataSource>('live');
  const [scenePlaying, setScenePlaying] = useState(false);
  const [hypePulse, setHypePulse] = useState(0);
  const [signalToast, setSignalToast] = useState('');
  const transitionTimer = useRef<number | null>(null);
  const logoAnimationTimer = useRef<number | null>(null);
  const hypePulseTimer = useRef<number | null>(null);
  const activeModule = modules[activeIndex];
  const platform = usePlatformCapabilities();
  const demoCopy: Record<Exclude<DemoState, 'normal'>, [string, string]> = {
    loading: ['Tuning the local signal…', 'Nearby music, events, and HYPES are being assembled.'],
    empty: ['Your scene starts here.', 'No results match this view yet. Expand the radius or HYPE the first signal.'],
    offline: ['You are offline.', 'Saved music and tickets remain available. Live scene updates will reconnect automatically.'],
    error: ['The signal hit a snag.', 'Nothing was changed. Retry now or return to your last working module.'],
    playback: ['This track is temporarily unavailable.', 'Skip ahead, keep it in your playlist, or visit the artist page.'],
  };

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountOpen(false); setMenuOpen(false); } };
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    window.addEventListener('keydown', closeMenus);
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => {
      window.removeEventListener('keydown', closeMenus);
      document.removeEventListener('visibilitychange', updateVisibility);
      if (logoAnimationTimer.current !== null) window.clearTimeout(logoAnimationTimer.current);
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      if (hypePulseTimer.current !== null) window.clearTimeout(hypePulseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!production) return;
    const key = 'ihype:module-guide-seen';
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, '1');
    setMenuOpen(true);
    const timer = window.setTimeout(() => setMenuOpen(false), 2600);
    return () => window.clearTimeout(timer);
  }, [production]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchMatches([]);
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void searchPreview(normalized, controller.signal, !production).then((response) => {
        setSearchMatches(response.data);
        setSearchSource(response.source);
      }).catch(() => {
        if (!controller.signal.aborted) setSearchMatches([]);
      }).finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    }, 240);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [production, query]);

  const searchResultHref = (result: PreviewSearchResult) => {
    if (result.type === 'show') return `/shows/${result.slug ?? result.id}`;
    if (result.type === 'song') return `/tracks/${result.id}`;
    if (result.type === 'genre') return `/listen?genre=${encodeURIComponent(result.name)}`;
    if (!result.slug) return '/pages';
    if (result.type === 'venue') return `/venues/${result.slug}`;
    if (result.type === 'promoter') return `/promoters/${result.slug}`;
    return `/artists/${result.slug}`;
  };

  const changeModule = (nextIndex: number) => {
    const normalized = (nextIndex + modules.length) % modules.length;
    if (normalized === activeIndex) {
      setMenuOpen(false);
      return;
    }
    const direction = normalized > activeIndex || (activeIndex === modules.length - 1 && normalized === 0) ? 'up' : 'down';
    setTransition(`${direction}-out`);
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      setActiveIndex(normalized);
      setTransition(`${direction}-in`);
      transitionTimer.current = window.setTimeout(() => setTransition('idle'), 360);
    }, 180);
    setMenuOpen(false);
    setAccountOpen(false);
    setQuery('');
  };
  const animateLogo = useCallback(() => {
    if (logoAnimationTimer.current !== null) window.clearTimeout(logoAnimationTimer.current);
    setLogoAnimating(false);
    window.requestAnimationFrame(() => setLogoAnimating(true));
    logoAnimationTimer.current = window.setTimeout(() => setLogoAnimating(false), 620);
  }, []);
  const toggleNavigator = useCallback(() => {
    animateLogo();
    setMenuOpen((value) => !value);
    setAccountOpen(false);
  }, [animateLogo]);
  const handlePlayerHype = useCallback((intensity: HypeIntensity) => {
    setHypePulse((value) => value + 1);
    setSignalToast(intensity === 'scene-wave' ? 'SCENE WAVE SENT · your signal carries farther' : 'HYPE SENT · local signal strengthened');
    if (hypePulseTimer.current !== null) window.clearTimeout(hypePulseTimer.current);
    hypePulseTimer.current = window.setTimeout(() => setSignalToast(''), intensity === 'scene-wave' ? 3200 : 2200);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        document.getElementById('deck-global-search')?.focus();
      } else if (event.key.toLowerCase() === 'm' && !isTyping) {
        event.preventDefault();
        toggleNavigator();
      } else if (event.key.toLowerCase() === 'h' && !isTyping) {
        event.preventDefault();
        window.dispatchEvent(new Event('ihype:player-hype'));
      } else if (event.code === 'Space' && !isTyping) {
        event.preventDefault();
        window.dispatchEvent(new Event('ihype:player-toggle'));
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleNavigator]);

  return (
    <div className={`module-deck-preview module-${activeModule.id} platform-${platform.platform} input-${platform.input} ${scenePlaying ? 'scene-is-playing' : ''} ${signalToast ? 'scene-hype-active' : ''} ${platform.isNative ? 'is-native-shell' : ''} ${platform.isStandalone ? 'is-standalone' : ''} ${reducedMotion ? 'reduce-motion' : ''} ${pageVisible ? '' : 'is-page-hidden'}`} data-hype-pulse={hypePulse} data-platform={platform.platform}>
      <style>{styles}</style>
      <div aria-hidden="true" className="scene-atmosphere"><span className="scene-orbit orbit-one" /><span className="scene-orbit orbit-two" /><span className="scene-frequency">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ '--frequency-index': index } as CSSProperties} />)}</span><span className="scene-hype-wave" key={hypePulse} /></div>
      {signalToast && <div aria-live="polite" className="scene-signal-toast"><span />{signalToast}</div>}
      <header className="deck-topbar">
        <button aria-expanded={menuOpen} aria-label={menuOpen ? 'Close iHYPE module navigator' : 'Open iHYPE module navigator'} className={`deck-logo ${logoAnimating ? 'is-pressed' : ''}`} onClick={toggleNavigator} type="button"><Image alt="iHYPE" height={58} priority src="/brand/ihype-menu-logo.webp" width={58} /></button>
        <div className="deck-search is-open">
          <Icon name="search" /><label className="sr-only" htmlFor="deck-global-search">Search iHYPE</label><input autoComplete="off" data-api-path={implementationBindings.globalSearch.path} id="deck-global-search" onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length >= 2) signalImplementationAction('globalSearch', { query: value.trim() }); }} placeholder="Search artists, tracks, radio, venues, and scenes" value={query} />
          {(searchLoading || searchMatches.length > 0 || query.trim().length >= 2) && <div aria-busy={searchLoading} className="deck-search-results">
            <small>{searchLoading ? 'Searching the scene…' : searchSource === 'live' ? 'LIVE SEARCH' : 'ALPHA SAMPLE'}</small>
            {searchLoading && <span aria-hidden="true" className="deck-search-loading"><i /><i /><i /></span>}
            {!searchLoading && searchMatches.length === 0 && <p>No public artists, tracks, shows, or venues match yet.</p>}
            {searchMatches.map((match) => <Link href={searchResultHref(match)} key={`${match.type}-${match.id}`}><span><strong>{match.name}</strong><small>{match.subtitle}</small></span><b>↗</b></Link>)}
          </div>}
        </div>
        <div className="deck-active-label" key={activeModule.id}><span>{activeModule.eyebrow}</span><strong>{activeModule.label}</strong></div>
        <span className="deck-sample-badge">{production ? 'LIVE ALPHA' : 'ALPHA SAMPLE'}</span>
        <button aria-expanded={accountOpen} aria-label="Open account menu" className="deck-profile" onClick={() => setAccountOpen((value) => !value)} type="button">{viewer?.name?.trim().charAt(0).toUpperCase() || 'F'}</button>
        {accountOpen && <div className="deck-account-menu"><div><span>SIGNED IN AS</span><strong>{viewer?.name || 'Fan alpha tester'}</strong><small>{viewer?.role || 'Base fan account'}</small></div><Link href="/api/auth/signout">Log out <span>↗</span></Link></div>}
      </header>

      <main aria-busy={demoState === 'loading'} className={`deck-stage transition-${transition}`}>
        {activeModule.id === 'map' && <SceneMap production={production} />}
        {activeModule.id === 'discover' && <DiscoverModule production={production} />}
        {activeModule.id === 'radio' && <RadioModule production={production} />}
        {activeModule.id === 'dashboard' && <DashboardModule production={production} viewer={viewer} />}
        {activeModule.id === 'settings' && <SettingsModule demoState={demoState} onDemoStateChange={setDemoState} onReducedMotionChange={setReducedMotion} production={production} reducedMotion={reducedMotion} />}
        {activeModule.id === 'community' && <CommunityModule production={production} />}
        {!production && demoState !== 'normal' && <DemoStateOverlay copy={demoCopy[demoState]} onRecover={() => setDemoState('normal')} state={demoState} />}
      </main>

      <CompactPlayer activeModule={activeModule.id} onHype={handlePlayerHype} onPlayingChange={setScenePlaying} production={production} />

      <button aria-label="Close module navigator" className={`deck-scrim ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)} type="button" />
      <aside aria-hidden={!menuOpen} className={`deck-navigator ${menuOpen ? 'is-open' : ''}`}>
        <div className="deck-nav-heading"><span>MOVE THROUGH iHYPE</span><small>Choose a module</small></div>
        <nav aria-label="iHYPE modules">{modules.map((item, index) => <button aria-current={activeIndex === index ? 'page' : undefined} key={item.id} onClick={() => changeModule(index)} style={{ '--nav-index': index } as CSSProperties} type="button"><span>0{index + 1}</span><strong>{item.label}</strong><small>{item.detail}</small><i>↗</i></button>)}</nav>
        <div className="deck-nav-footer"><span>Discover Local Music</span><b>|</b><span>Support The Scene</span><b>|</b><span>Be The Signal</span><small><kbd>/</kbd> Search <kbd>Space</kbd> Play <kbd>H</kbd> HYPE</small></div>
      </aside>
    </div>
  );
}

const styles = String.raw`
body:has(.module-deck-preview) { overflow:hidden!important; background:#050607!important; }
body:has(.module-deck-preview) .adaptive-site-header,
body:has(.module-deck-preview) .site-shell > footer,
body:has(.module-deck-preview) .ihype-cookie-consent,
body:has(.module-deck-preview) .mobile-bottom-nav,
body:has(.module-deck-preview) .ihype-mobile-nav,
body:has(.module-deck-preview) .site-dock,
body:has(.module-deck-preview) .mas-root,
body:has(.module-deck-preview) nextjs-portal { display:none!important; }
body:has(.module-deck-preview) .site-shell { padding:0!important; }
body:has(.module-deck-preview) #main-content { transform:none!important; padding:0!important; }
.module-deck-preview { --deck-orange:#ff4d2e; --deck-cyan:#18ded1; --deck-cream:#f3eee7; --deck-muted:#a69d93; --deck-line:rgba(243,238,231,.14); --scene-a:255,77,46; --scene-b:24,222,209; --scene-focus-x:72%; --scene-focus-y:38%; --deck-safe-top:env(safe-area-inset-top,0px); --deck-safe-right:env(safe-area-inset-right,0px); --deck-safe-bottom:env(safe-area-inset-bottom,0px); --deck-safe-left:env(safe-area-inset-left,0px); position:relative; width:100%; height:100dvh; min-height:640px; overflow:hidden; color:var(--deck-cream); background:#050607; isolation:isolate; overscroll-behavior:none; }
html[data-theme="light"] body:has(.module-deck-preview) { background:#f3efe8!important; }
html[data-theme="light"] .module-deck-preview { --deck-cream:#17130f; --deck-muted:#746b61; --deck-line:rgba(23,19,15,.16); color-scheme:light; background:#f3efe8; }
html[data-theme="light"] .module-deck-preview::before { background:radial-gradient(circle at 17% 44%,rgba(var(--scene-a),.09),transparent 28%),radial-gradient(circle at var(--scene-focus-x) var(--scene-focus-y),rgba(var(--scene-b),.1),transparent 34%),linear-gradient(120deg,#faf7f1 0%,#f1ece5 48%,#e9f2f0 100%); }
html[data-theme="light"] .module-deck-preview::after { opacity:.1; mix-blend-mode:multiply; }
html[data-theme="light"] .deck-topbar { background:rgba(249,246,240,.9); }
html[data-theme="light"] .deck-search input { border-color:rgba(23,19,15,.2); color:#17130f; background:rgba(255,255,255,.56); }
html[data-theme="light"] .deck-search input::placeholder { color:#746b61; }
html[data-theme="light"] .scene-map-frame,
html[data-theme="light"] .discover-card,
html[data-theme="light"] .discover-feedback,
html[data-theme="light"] .radio-console,
html[data-theme="light"] .settings-board,
html[data-theme="light"] .community-board,
html[data-theme="light"] .deck-player,
html[data-theme="light"] .deck-player-context-card,
html[data-theme="light"] .deck-player-error,
html[data-theme="light"] .deck-player-queue,
html[data-theme="light"] .deck-full-player,
html[data-theme="light"] .deck-navigator,
html[data-theme="light"] .deck-search-results,
html[data-theme="light"] .deck-account-menu,
html[data-theme="light"] .scene-signal-toast,
html[data-theme="light"] .map-filter-panel,
html[data-theme="light"] .map-detail-sheet,
html[data-theme="light"] .map-trust-panel { --deck-cream:#f3eee7; --deck-muted:#a69d93; --deck-line:rgba(243,238,231,.14); color:var(--deck-cream); color-scheme:dark; }
.module-deck-preview.module-map { --scene-a:24,222,209; --scene-b:255,77,46; --scene-focus-x:78%; --scene-focus-y:42%; }
.module-deck-preview.module-discover { --scene-a:255,77,46; --scene-b:132,86,255; --scene-focus-x:66%; --scene-focus-y:44%; }
.module-deck-preview.module-radio { --scene-a:24,222,209; --scene-b:242,106,52; --scene-focus-x:58%; --scene-focus-y:34%; }
.module-deck-preview.module-dashboard { --scene-a:244,151,63; --scene-b:24,222,209; --scene-focus-x:74%; --scene-focus-y:28%; }
.module-deck-preview.module-settings { --scene-a:88,126,255; --scene-b:24,222,209; --scene-focus-x:68%; --scene-focus-y:40%; }
.module-deck-preview.module-community { --scene-a:255,77,46; --scene-b:246,188,82; --scene-focus-x:62%; --scene-focus-y:42%; }
.module-deck-preview::before { content:""; position:absolute; inset:-20%; z-index:-2; background:radial-gradient(circle at 16% 44%,rgba(var(--scene-a),.14),transparent 28%),radial-gradient(circle at var(--scene-focus-x) var(--scene-focus-y),rgba(var(--scene-b),.13),transparent 34%),linear-gradient(120deg,#050506 0%,#070811 48%,#031115 100%); transition:background .7s ease; }
.module-deck-preview::after { content:""; position:absolute; inset:0; z-index:-1; opacity:.24; pointer-events:none; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.24'/%3E%3C/svg%3E"); mix-blend-mode:soft-light; }
.scene-atmosphere { position:absolute; z-index:0; inset:76px 0 0; overflow:hidden; pointer-events:none; contain:strict; }
.scene-orbit { width:min(68vw,920px); aspect-ratio:1; position:absolute; top:var(--scene-focus-y); left:var(--scene-focus-x); border:1px solid rgba(var(--scene-b),.075); border-radius:50%; opacity:.7; transform:translate(-50%,-50%); transition:top .7s ease,left .7s ease,border-color .7s ease; }
.scene-orbit::before,.scene-orbit::after { content:""; position:absolute; border:1px solid rgba(var(--scene-a),.065); border-radius:inherit; }
.scene-orbit::before { inset:12%; }
.scene-orbit::after { inset:25%; }
.scene-orbit.orbit-two { width:min(45vw,620px); border-style:dashed; opacity:.34; transform:translate(-50%,-50%) rotate(22deg); }
.scene-frequency { height:82px; position:absolute; right:7%; bottom:96px; left:38%; display:flex; align-items:center; justify-content:center; gap:clamp(4px,.65vw,11px); opacity:.13; mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent); }
.scene-frequency i { width:2px; height:calc(12px + (var(--frequency-index) % 7) * 8px); display:block; border-radius:99px; background:linear-gradient(to top,rgba(var(--scene-a),.9),rgba(var(--scene-b),.9)); transform:scaleY(.35); transform-origin:center; }
.scene-is-playing .scene-frequency { opacity:.3; }
.scene-is-playing .scene-frequency i { animation:sceneFrequency 1.05s ease-in-out calc(var(--frequency-index) * -57ms) infinite alternate; }
.scene-is-playing .scene-orbit.orbit-one { animation:sceneOrbit 16s linear infinite; }
.scene-hype-wave { width:120px; aspect-ratio:1; position:absolute; right:48px; bottom:72px; border:2px solid rgba(var(--scene-b),.7); border-radius:50%; opacity:0; }
.scene-hype-active .scene-hype-wave { animation:sceneHypeWave 1.25s cubic-bezier(.12,.72,.18,1) both; }
.scene-signal-toast { position:absolute; z-index:90; top:94px; left:50%; display:flex; align-items:center; gap:9px; padding:10px 15px; border:1px solid rgba(24,222,209,.34); border-radius:999px; color:var(--deck-cream); background:rgba(5,8,9,.92); box-shadow:0 18px 60px rgba(0,0,0,.44),0 0 32px rgba(24,222,209,.12); backdrop-filter:blur(20px); font:800 8px var(--f-m,monospace); letter-spacing:.1em; transform:translateX(-50%); animation:signalToastIn .38s cubic-bezier(.2,.86,.2,1) both; }
.scene-signal-toast > span { width:7px; height:7px; border-radius:50%; background:var(--deck-cyan); box-shadow:0 0 14px var(--deck-cyan); }
.deck-icon { width:22px; height:22px; flex:0 0 auto; }
.deck-topbar { height:calc(76px + var(--deck-safe-top)); position:relative; z-index:40; display:flex; align-items:center; gap:16px; padding:calc(9px + var(--deck-safe-top)) calc(22px + var(--deck-safe-right)) 9px calc(22px + var(--deck-safe-left)); border-bottom:1px solid var(--deck-line); background:rgba(3,4,5,.88); backdrop-filter:blur(20px); }
.deck-logo { width:58px; height:58px; position:relative; flex:0 0 auto; padding:0; overflow:hidden; border:1px solid rgba(243,238,231,.25); border-radius:16px; background:#090807; box-shadow:0 0 26px rgba(255,77,46,.12); cursor:pointer; touch-action:manipulation; transform-origin:center; }
.deck-logo img { width:100%; height:100%; object-fit:cover; }
.deck-logo.is-pressed { animation:logoButtonPress .62s cubic-bezier(.18,.8,.2,1); }
.deck-logo.is-pressed img { animation:logoImagePulse .62s cubic-bezier(.18,.8,.2,1); }
.deck-search { width:min(48vw,650px); max-width:650px; position:relative; display:flex; align-items:center; gap:12px; overflow:visible; opacity:1; transform:none; transition:width .35s ease,opacity .25s ease,transform .35s ease; pointer-events:auto; }
.deck-search.is-open { width:min(48vw,650px); opacity:1; transform:none; pointer-events:auto; }
.deck-search > .deck-icon { position:absolute; left:16px; z-index:2; color:var(--deck-muted); }
.deck-search input { width:100%; height:48px; padding:0 18px 0 49px; border:1px solid rgba(243,238,231,.24); border-radius:999px; outline:none; color:var(--deck-cream); background:rgba(243,238,231,.055); font:600 14px var(--f-b,Arial,sans-serif); }
.deck-search input:focus { border-color:var(--deck-cyan); box-shadow:0 0 0 3px rgba(24,222,209,.12); }
.deck-search-results { position:absolute; top:55px; left:0; right:0; display:grid; gap:3px; padding:8px; border:1px solid var(--deck-line); border-radius:15px; background:#0c0d0e; box-shadow:0 24px 70px rgba(0,0,0,.5); }
.deck-search-results > small { padding:5px 8px; color:var(--deck-cyan); font:800 7px var(--f-m,monospace); letter-spacing:.14em; }
.deck-search-loading { display:grid; gap:7px; padding:6px 8px 10px; }
.deck-search-loading i { height:9px; border-radius:999px; background:linear-gradient(90deg,rgba(243,238,231,.04),rgba(243,238,231,.14),rgba(243,238,231,.04)); background-size:220% 100%; animation:searchShimmer 1.15s ease-in-out infinite; }
.deck-search-loading i:nth-child(2) { width:78%; animation-delay:-.2s; }
.deck-search-loading i:nth-child(3) { width:56%; animation-delay:-.4s; }
.deck-search-results > p { margin:0; padding:12px 8px; color:var(--deck-muted); font-size:10px; }
.deck-search-results > a { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-radius:9px; color:var(--deck-cream); background:transparent; text-align:left; text-decoration:none; }
.deck-search-results > a:hover,.deck-search-results > a:focus-visible { background:rgba(243,238,231,.07); outline:none; }
.deck-search-results > a > span { min-width:0; display:grid; }
.deck-search-results > a strong { overflow:hidden; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.deck-search-results > a small { overflow:hidden; color:var(--deck-muted); font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
.deck-search-results > a b { color:var(--deck-cyan); }
.deck-active-label { display:grid; margin-left:auto; text-align:right; }
.deck-active-label span { color:var(--deck-cyan); font:700 9px var(--f-m,monospace); letter-spacing:.16em; text-transform:uppercase; }
.deck-active-label strong { font:800 16px var(--f-d,Arial,sans-serif); text-transform:uppercase; letter-spacing:.03em; }
.deck-sample-badge { padding:6px 8px; border:1px solid rgba(255,77,46,.45); border-radius:999px; color:var(--deck-orange); font:800 7px var(--f-m,monospace); letter-spacing:.12em; white-space:nowrap; }
.deck-profile { width:42px; height:42px; display:grid; place-items:center; flex:0 0 auto; padding:0; border:1px solid var(--deck-line); border-radius:50%; color:#050607; background:linear-gradient(145deg,var(--deck-cyan),#f6b191); box-shadow:0 8px 24px rgba(0,0,0,.24); font:900 15px var(--f-d,Arial,sans-serif); }
.deck-profile[aria-expanded="true"] { box-shadow:0 0 0 3px rgba(24,222,209,.16),0 12px 30px rgba(0,0,0,.34); }
.deck-account-menu { width:240px; position:absolute; z-index:8; top:68px; right:18px; display:grid; overflow:hidden; border:1px solid var(--deck-line); border-radius:16px; color:var(--deck-cream); background:rgba(8,9,10,.98); box-shadow:0 24px 70px rgba(0,0,0,.55); backdrop-filter:blur(24px); }
.deck-account-menu > div { display:grid; gap:3px; padding:16px; }
.deck-account-menu > div span { color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.deck-account-menu > div strong { font-size:13px; }
.deck-account-menu > div small { color:var(--deck-muted); font-size:9px; }
.deck-account-menu > a { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-top:1px solid var(--deck-line); color:var(--deck-orange); background:rgba(255,77,46,.035); font-size:11px; font-weight:800; text-decoration:none; }
.deck-stage { height:calc(100dvh - 76px - var(--deck-safe-top)); min-height:564px; }
.deck-stage > .deck-module { transition:opacity .18s ease,transform .18s ease; }
.deck-stage.transition-up-out > .deck-module { opacity:0; transform:translateY(-48px); }
.deck-stage.transition-down-out > .deck-module { opacity:0; transform:translateY(48px); }
.deck-stage.transition-up-in > .deck-module { animation:stageInUp .36s cubic-bezier(.2,.78,.2,1) forwards; }
.deck-stage.transition-down-in > .deck-module { animation:stageInDown .36s cubic-bezier(.2,.78,.2,1) forwards; }
.deck-module { height:100%; display:grid; align-items:center; gap:clamp(30px,4vw,68px); padding:clamp(28px,5vh,64px) clamp(26px,5vw,82px) 114px; animation:moduleIn .5s cubic-bezier(.2,.75,.2,1); }
.deck-module > * { min-width:0; }
.module-deck-preview button,.module-deck-preview a,.module-deck-preview input,.module-deck-preview select { font-family:var(--f-b,Arial,sans-serif); }
.module-deck-preview button:not(:disabled),.module-deck-preview a { cursor:pointer; }
.module-deck-preview button,.module-deck-preview a { transition:border-color .2s ease,background-color .2s ease,color .2s ease,box-shadow .2s ease,opacity .2s ease,transform .2s ease; }
.module-deck-preview button:focus-visible,.module-deck-preview a:focus-visible,.module-deck-preview input:focus-visible,.module-deck-preview select:focus-visible { outline:2px solid var(--deck-cyan); outline-offset:3px; }
.deck-kicker { display:block; color:var(--deck-cyan); font:800 10px var(--f-m,monospace); letter-spacing:.18em; text-transform:uppercase; }
.deck-module h1 { width:100%; max-width:100%; margin:14px 0 18px; color:var(--deck-cream); font:900 clamp(48px,5.7vw,88px)/.94 var(--f-d,Arial,sans-serif); letter-spacing:-.05em; text-transform:uppercase; overflow-wrap:normal; word-break:normal; }
.deck-module p { max-width:580px; margin:0; color:var(--deck-muted); font:500 clamp(14px,1.25vw,18px)/1.55 var(--f-b,Arial,sans-serif); }
.deck-button { min-height:46px; padding:0 22px; border:1px solid rgba(243,238,231,.22); border-radius:14px; color:var(--deck-cream); background:linear-gradient(180deg,rgba(243,238,231,.075),rgba(243,238,231,.025)); box-shadow:inset 0 1px rgba(255,255,255,.07),0 10px 30px rgba(0,0,0,.14); font:800 12px var(--f-b,Arial,sans-serif); transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease; }
.deck-button:hover { border-color:rgba(24,222,209,.5); box-shadow:inset 0 1px rgba(255,255,255,.1),0 12px 36px rgba(0,0,0,.22); transform:translateY(-1px); }
.deck-button-primary { border-color:transparent; color:#03100f; background:linear-gradient(135deg,#31eee1,var(--deck-cyan)); box-shadow:0 10px 34px rgba(24,222,209,.22); }
.deck-player { position:absolute; z-index:18; left:calc(18px + var(--deck-safe-left)); right:calc(18px + var(--deck-safe-right)); bottom:calc(12px + var(--deck-safe-bottom)); height:78px; display:grid; grid-template-columns:minmax(250px,.9fr) auto minmax(100px,1.2fr) minmax(110px,.45fr) 44px auto; align-items:center; gap:14px; padding:10px 15px; border:1px solid rgba(243,238,231,.2); border-radius:18px; background:radial-gradient(circle at 10% 50%,rgba(var(--art-rgb,255,77,46),.16),transparent 32%),rgba(8,9,10,.88); box-shadow:0 -15px 60px rgba(0,0,0,.34); backdrop-filter:blur(26px); }
.deck-player.context-map { border-color:rgba(24,222,209,.22); }
.deck-player.context-discover { border-color:rgba(255,77,46,.28); }
.deck-player.context-radio { box-shadow:0 -15px 60px rgba(0,0,0,.34),0 0 46px rgba(24,222,209,.07); }
.deck-player-context-card { min-width:290px; position:absolute; right:92px; bottom:88px; display:grid; gap:2px; padding:13px 42px 13px 15px; border:1px solid rgba(24,222,209,.28); border-radius:15px; color:var(--deck-cream); background:rgba(7,9,10,.96); box-shadow:0 20px 70px rgba(0,0,0,.52); backdrop-filter:blur(24px); animation:venueContextIn .42s cubic-bezier(.18,.82,.2,1) both; }
.deck-player-context-card > span { color:var(--deck-cyan); font:800 7px var(--f-m,monospace); letter-spacing:.13em; }
.deck-player-context-card > strong { font-size:12px; }
.deck-player-context-card > small { max-width:320px; overflow:hidden; color:var(--deck-muted); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.deck-player-context-card > button { width:28px; height:28px; position:absolute; top:9px; right:9px; border:0; border-radius:50%; color:var(--deck-muted); background:rgba(243,238,231,.05); }
.deck-player-error { max-width:min(520px,calc(100% - 24px)); position:absolute; right:12px; bottom:88px; padding:9px 13px; border:1px solid rgba(255,77,46,.35); border-radius:999px; color:var(--deck-cream); background:rgba(15,7,5,.94); box-shadow:0 16px 50px rgba(0,0,0,.42); font:800 8px var(--f-m,monospace); letter-spacing:.04em; }
.deck-player button:disabled,.deck-full-player button:disabled,.discover-actions button:disabled,.radio-live-art button:disabled { opacity:.34; cursor:not-allowed; filter:saturate(.35); }
.deck-player > img { border-radius:10px; object-fit:cover; }
.deck-player-copy { min-width:0; display:grid; }
.deck-player-copy > span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.16em; }
.deck-player-copy > div { min-width:0; display:flex; align-items:baseline; gap:7px; overflow:hidden; white-space:nowrap; }
.deck-player-copy strong { font:800 17px var(--f-d,Arial,sans-serif); }
.deck-player-copy small,.deck-player-copy i { color:var(--deck-muted); font-style:normal; }
.deck-player-track-button { min-width:0; display:grid; grid-template-columns:52px minmax(0,1fr); align-items:center; gap:14px; padding:0; border:0; color:var(--deck-cream); background:transparent; text-align:left; }
.deck-player-track-button > img { width:52px; height:52px; border-radius:10px; object-fit:cover; }
.deck-player-copy > span:first-child { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.16em; }
.deck-player-marquee { min-width:0; display:block; overflow:hidden; white-space:nowrap; }
.deck-player-marquee-track { width:100%; display:flex; }
.deck-player-marquee-track.is-scrolling { width:max-content; animation:playerMarquee 18s linear infinite; }
.deck-player-marquee-copy { min-width:0; display:flex; align-items:baseline; gap:7px; }
.deck-player-marquee-track.is-scrolling .deck-player-marquee-copy { flex:0 0 auto; padding-right:38px; }
.deck-player-controls { display:flex; align-items:center; gap:4px; }
.deck-player-controls button,.deck-player-queue-button { width:34px; height:34px; display:grid; place-items:center; border:0; border-radius:50%; color:var(--deck-cream); background:transparent; }
.deck-player-controls .deck-player-play { width:46px; height:46px; border:1px solid var(--deck-cyan); background:rgba(24,222,209,.06); }
.deck-player-controls button:hover,.deck-player-queue-button:hover { background:rgba(243,238,231,.08); }
.deck-player-progress { height:2px; overflow:hidden; background:rgba(243,238,231,.15); }
.deck-player-progress span { width:42%; height:100%; display:block; background:var(--deck-cyan); }
.deck-player-volume { display:flex; align-items:center; gap:8px; color:var(--deck-muted); }
.deck-player-volume .deck-icon { width:18px; height:18px; }
.deck-player-volume input { width:100%; accent-color:var(--deck-cyan); }
.deck-player-queue-button { border:1px solid var(--deck-line); border-radius:10px; }
.deck-player-hype { min-width:104px; height:42px; position:relative; display:grid; grid-template-columns:auto auto; align-items:center; justify-content:center; column-gap:7px; overflow:visible; border:1px solid var(--deck-cyan); border-radius:10px; color:var(--deck-cyan); background:rgba(24,222,209,.025); font:800 10px var(--f-m,monospace); letter-spacing:.1em; touch-action:manipulation; }
.deck-player-hype > small { color:var(--deck-muted); font:700 7px var(--f-m,monospace); letter-spacing:0; }
.deck-player-hype.is-hyped { color:#03100f; background:var(--deck-cyan); box-shadow:0 0 0 1px rgba(24,222,209,.35),0 0 30px rgba(24,222,209,.2); animation:hypeButtonSet .42s cubic-bezier(.18,.86,.2,1); }
.deck-player-hype.is-hyped > small { color:rgba(3,16,15,.65); }
.deck-player-queue { width:310px; position:absolute; right:96px; bottom:86px; display:grid; padding:12px; border:1px solid var(--deck-line); border-radius:16px; background:rgba(8,9,10,.97); box-shadow:0 24px 70px rgba(0,0,0,.55); backdrop-filter:blur(24px); }
.deck-player-queue > span { padding:6px 8px 10px; color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.14em; }
.deck-player-queue > button { display:grid; grid-template-columns:1fr auto; padding:11px 8px; border:0; border-top:1px solid rgba(243,238,231,.09); color:var(--deck-cream); background:transparent; text-align:left; }
.deck-player-queue > button strong { font-size:12px; }
.deck-player-queue > button small { color:var(--deck-muted); font-size:9px; }
.queue-heading { display:flex; align-items:center; justify-content:space-between; padding:5px 6px 10px; color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.14em; }
.queue-heading button { border:0; color:var(--deck-muted); background:transparent; font-size:9px; }
.queue-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; padding:10px 6px; border-top:1px solid rgba(243,238,231,.09); }
.queue-row > span:first-child { min-width:0; display:grid; }
.queue-row strong { overflow:hidden; color:var(--deck-cream); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.queue-row small { color:var(--deck-muted); font-size:8px; }
.queue-row.ad { color:var(--deck-orange); background:rgba(255,77,46,.045); }
.queue-row.ad strong { color:var(--deck-orange); font:800 9px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; }
.queue-row-actions { display:flex; }
.queue-row-actions button { width:25px; height:25px; border:0; color:var(--deck-muted); background:transparent; }
.queue-row-actions button:disabled { opacity:.2; }
.deck-player-queue > p { padding:14px 8px; color:var(--deck-muted); font-size:10px; }
.deck-full-player { position:fixed; z-index:120; inset:0; display:grid; grid-template-columns:minmax(300px,.85fr) minmax(0,1fr) minmax(250px,.58fr); align-items:center; gap:clamp(24px,3vw,48px); padding:max(clamp(72px,9vh,110px),calc(56px + env(safe-area-inset-top,0px))) max(clamp(30px,5vw,72px),env(safe-area-inset-right,0px)) max(clamp(72px,9vh,110px),calc(56px + env(safe-area-inset-bottom,0px))) max(clamp(30px,5vw,72px),env(safe-area-inset-left,0px)); color:var(--deck-cream); background:radial-gradient(circle at 20% 45%,rgba(var(--art-rgb,255,77,46),.24),transparent 36%),radial-gradient(circle at 76% 35%,rgba(24,222,209,.13),transparent 36%),rgba(3,4,5,.98); backdrop-filter:blur(30px); }
.full-player-close { width:48px; height:48px; position:absolute; top:22px; right:24px; display:grid; place-items:center; border:1px solid var(--deck-line); border-radius:50%; color:var(--deck-cream); background:rgba(243,238,231,.04); }
.full-player-art { width:100%; max-width:520px; aspect-ratio:1; position:relative; overflow:hidden; border-radius:30px; box-shadow:0 50px 130px rgba(0,0,0,.58); }
.full-player-art img { object-fit:cover; }
.full-player-main { min-width:0; }
.full-player-main h2 { max-width:100%; margin:14px 0 2px; font:900 clamp(46px,5vw,76px)/.88 var(--f-d,Arial,sans-serif); letter-spacing:-.055em; text-transform:uppercase; }
.full-player-main > a { color:var(--deck-cyan); font-weight:800; text-decoration:none; }
.full-player-main > p { margin:26px 0; color:var(--deck-muted); font-style:italic; }
.full-player-progress { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; color:var(--deck-muted); font:700 8px var(--f-m,monospace); }
.full-player-progress > div { height:3px; background:rgba(243,238,231,.14); }
.full-player-progress i { width:44%; height:100%; display:block; background:var(--deck-cyan); }
.full-player-controls { display:flex; align-items:center; justify-content:center; gap:20px; margin:24px 0; }
.full-player-controls button { width:48px; height:48px; display:grid; place-items:center; border:0; border-radius:50%; color:var(--deck-cream); background:transparent; }
.full-player-controls button:nth-child(2) { width:72px; height:72px; border:1px solid var(--deck-cyan); background:rgba(24,222,209,.07); }
.full-player-actions { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.full-player-actions button { min-height:42px; border:1px solid var(--deck-line); border-radius:9px; color:var(--deck-cream); background:transparent; font-size:10px; }
.full-player-actions button[aria-pressed="true"] { border-color:var(--deck-cyan); color:var(--deck-cyan); }
.full-player-notes { margin-top:26px; padding-top:18px; border-top:1px solid var(--deck-line); }
.full-player-notes span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.full-player-notes p { margin-top:8px; color:var(--deck-muted); font-size:11px; }
.full-player-queue { max-height:70vh; overflow:auto; padding:18px; border:1px solid var(--deck-line); border-radius:22px; background:rgba(243,238,231,.025); }
.deck-scrim { position:absolute; z-index:29; inset:calc(76px + var(--deck-safe-top)) 0 0; border:0; opacity:0; visibility:hidden; background:rgba(0,0,0,.76); backdrop-filter:blur(7px); transition:opacity .3s ease,visibility .3s; }
.deck-scrim.is-open { opacity:1; visibility:visible; }
.deck-navigator { width:min(500px,92vw); position:absolute; z-index:35; top:calc(76px + var(--deck-safe-top)); bottom:0; left:0; display:grid; grid-template-rows:auto 1fr auto; padding:28px 24px calc(22px + var(--deck-safe-bottom)) calc(24px + var(--deck-safe-left)); border-right:1px solid var(--deck-line); background:rgba(6,7,8,.96); transform:translateX(-105%); transition:transform .4s cubic-bezier(.2,.78,.2,1); }
.deck-navigator.is-open { transform:none; }
.deck-nav-heading { display:grid; gap:5px; padding:0 12px 18px; border-bottom:1px solid var(--deck-line); }
.deck-nav-heading span { color:var(--deck-orange); font:800 10px var(--f-m,monospace); letter-spacing:.17em; }
.deck-nav-heading small { color:var(--deck-muted); }
.deck-navigator nav { display:grid; align-content:center; }
.deck-navigator nav button { display:grid; grid-template-columns:34px minmax(0,1fr) 20px; grid-template-rows:auto auto; align-items:center; column-gap:12px; min-height:66px; padding:8px 12px; border:0; border-bottom:1px solid rgba(243,238,231,.09); color:var(--deck-cream); background:transparent; text-align:left; }
.deck-navigator nav button > span { color:var(--deck-muted); font:700 9px var(--f-m,monospace); }
.deck-navigator nav button > strong { min-width:0; grid-column:2; grid-row:1; overflow:hidden; font:900 22px var(--f-d,Arial,sans-serif); text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
.deck-navigator nav button > small { min-width:0; grid-column:2; grid-row:2; overflow:hidden; color:var(--deck-muted); text-overflow:ellipsis; white-space:nowrap; }
.deck-navigator nav button > i { grid-column:3; grid-row:1/3; color:var(--deck-cyan); font-style:normal; }
.deck-navigator nav button[aria-current="page"] { color:#050607; background:var(--deck-cream); }
.deck-navigator nav button[aria-current="page"] span,.deck-navigator nav button[aria-current="page"] small { color:#4e4944; }
.deck-nav-footer { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; padding-top:14px; border-top:1px solid var(--deck-line); color:var(--deck-muted); font:800 8px var(--f-m,monospace); letter-spacing:.1em; text-align:center; text-transform:uppercase; }
.deck-nav-footer span:first-child { color:var(--deck-cyan); }
.deck-nav-footer span:last-child { color:var(--deck-orange); }
.deck-nav-footer b { color:rgba(243,238,231,.28); font-weight:400; }
.deck-nav-footer small { width:100%; margin-top:4px; color:rgba(166,157,147,.72); font-size:7px; letter-spacing:.04em; text-transform:none; }
.deck-nav-footer kbd { min-width:18px; display:inline-grid; place-items:center; margin:0 3px 0 8px; padding:2px 5px; border:1px solid rgba(243,238,231,.16); border-radius:4px; color:var(--deck-cream); background:rgba(243,238,231,.05); box-shadow:inset 0 -1px rgba(255,255,255,.08); font:700 7px var(--f-m,monospace); }
.deck-demo-state { position:absolute; z-index:14; inset:0; display:grid; place-content:center; justify-items:center; padding:30px; background:rgba(3,4,5,.9); backdrop-filter:blur(18px); text-align:center; }
.deck-demo-state > span { color:var(--deck-cyan); font:900 52px var(--f-d,Arial,sans-serif); }
.deck-demo-state h2 { margin:12px 0 8px; font:900 clamp(34px,4vw,58px) var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.deck-demo-state p { max-width:520px; color:var(--deck-muted); }
.deck-demo-state button { margin-top:20px; padding:12px 18px; border:1px solid var(--deck-cyan); border-radius:999px; color:var(--deck-cyan); background:transparent; }
.deck-demo-state.state-error > span,.deck-demo-state.state-playback > span { color:var(--deck-orange); }
.deck-demo-state.state-loading > span { animation:loadingPulse 1s ease-in-out infinite alternate; }

/* Scene map */
.deck-map-module { grid-template-columns:minmax(310px,.78fr) minmax(530px,1.22fr); }
.deck-map-module .deck-module-copy h1 { font-size:clamp(46px,4.35vw,66px); line-height:.95; }
.deck-map-module .deck-module-copy h1 { font-size:clamp(52px,5.45vw,82px); }
.deck-location-line { display:flex; align-items:center; gap:12px; margin:28px 0 20px; color:var(--deck-cyan); }
.deck-location-line span { display:grid; }
.deck-location-line strong { color:var(--deck-cream); font-size:14px; }
.deck-location-line small { color:var(--deck-muted); font-size:11px; }
.scene-map-frame { height:min(72vh,720px); min-height:470px; position:relative; overflow:hidden; border:1px solid rgba(243,238,231,.18); border-radius:32px; background:radial-gradient(circle at 55% 50%,rgba(24,222,209,.08),transparent 47%),rgba(2,5,7,.58); box-shadow:inset 0 0 100px rgba(0,0,0,.5),0 34px 90px rgba(0,0,0,.26); }
.map-menu-button { width:50px; height:50px; position:absolute; z-index:8; top:18px; left:18px; display:grid; place-items:center; border:1px solid var(--deck-line); border-radius:14px; color:var(--deck-cream); background:rgba(4,5,6,.82); backdrop-filter:blur(12px); }
.map-filter-panel { width:min(350px,calc(100% - 34px)); max-height:calc(100% - 98px); position:absolute; z-index:7; top:80px; left:18px; display:grid; overflow:auto; padding:18px; border:1px solid var(--deck-line); border-radius:18px; background:rgba(6,7,8,.96); box-shadow:0 20px 60px rgba(0,0,0,.45); backdrop-filter:blur(18px); }
.map-filter-panel > button { display:flex; justify-content:space-between; padding:13px 4px; border:0; border-bottom:1px solid rgba(243,238,231,.09); color:var(--deck-muted); background:transparent; text-align:left; }
.map-filter-panel > button[aria-pressed="true"] { color:var(--deck-cream); }
.map-filter-panel > button[aria-pressed="true"] span { color:var(--deck-cyan); }
.map-filter-heading { padding:14px 4px 3px; color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.map-scale-picker { display:grid; gap:8px; padding:14px 0 8px; border-bottom:1px solid var(--deck-line); }
.map-scale-picker > span,.map-genre > span { color:var(--deck-muted); font:800 8px var(--f-m,monospace); letter-spacing:.1em; text-transform:uppercase; }
.map-scale-picker > div { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
.map-scale-picker button { min-height:31px; padding:0 5px; border:1px solid var(--deck-line); border-radius:8px; color:var(--deck-muted); background:rgba(243,238,231,.02); font:800 7px var(--f-m,monospace); text-transform:uppercase; }
.map-scale-picker button[aria-pressed="true"] { border-color:var(--deck-cyan); color:#04100f; background:var(--deck-cyan); }
.map-result-count { padding-top:12px; color:var(--deck-muted); font:700 8px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; }
.map-data-source { color:var(--deck-orange); font:700 7px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; }
.map-data-source.source-live { color:var(--deck-cyan); }
.is-native-shell .deck-player-volume { display:none; }
.map-date { display:grid; gap:6px; padding-top:12px; color:var(--deck-muted); font-size:10px; }
.map-date input { color:var(--deck-cream); color-scheme:dark; border:1px solid var(--deck-line); border-radius:8px; padding:9px; background:#111; }
.map-genre { display:grid; gap:6px; padding-top:12px; }
.map-genre select { width:100%; height:38px; padding:0 10px; border:1px solid var(--deck-line); border-radius:9px; color:var(--deck-cream); color-scheme:dark; background:#101112; }
.map-filter-panel > .map-hype-filter { justify-content:flex-start; gap:9px; margin-top:10px; padding:10px; border:1px solid rgba(24,222,209,.28); border-radius:9px; color:var(--deck-cyan); background:rgba(24,222,209,.035); }
.map-filter-panel > .map-hype-filter[aria-pressed="true"] { color:#04100f; background:var(--deck-cyan); }
.map-filter-panel > .map-hype-filter span { width:18px; height:18px; display:grid; place-items:center; border:1px solid currentColor; border-radius:50%; }
.scene-globe { width:min(66vh,620px); aspect-ratio:1; position:absolute; top:50%; left:55%; touch-action:none; transform:translate(-50%,-54%); }
.globe-aura { position:absolute; inset:-14%; border-radius:50%; background:radial-gradient(circle,rgba(24,222,209,.16),rgba(255,77,46,.07) 35%,transparent 68%); filter:blur(18px); }
.globe-orbit { position:absolute; inset:-8%; border:1px solid rgba(24,222,209,.18); border-radius:50%; }
.globe-orbit-two { inset:-16%; border-color:rgba(255,77,46,.14); }
.globe-sphere { position:absolute; inset:0; overflow:hidden; border:1px solid rgba(243,238,231,.28); border-radius:50%; background:radial-gradient(circle at 34% 28%,rgba(24,222,209,.27),transparent 32%),radial-gradient(circle at 72% 66%,rgba(255,77,46,.25),transparent 40%),#05080a; box-shadow:inset -34px -30px 90px rgba(0,0,0,.8),inset 25px 15px 45px rgba(24,222,209,.09),0 0 70px rgba(24,222,209,.12); }
.globe-grid { width:100%; height:100%; overflow:visible; }
.globe-grid circle,.globe-grid ellipse { fill:none; stroke:rgba(243,238,231,.12); stroke-width:1; }
.globe-grid .globe-land { fill:rgba(243,238,231,.075); stroke:rgba(243,238,231,.18); stroke-width:2; }
.globe-grid .globe-signal { fill:none; stroke-width:5; filter:drop-shadow(0 0 7px rgba(24,222,209,.7)); }
.scene-local-map { position:absolute; inset:0; overflow:hidden; touch-action:none; }
.real-map-surface,.real-map-canvas { position:absolute; inset:0; }
.real-map-surface { z-index:0; overflow:hidden; background:#071013; }
.real-map-canvas { opacity:0; transition:opacity .45s ease; }
.real-map-surface.is-loaded .real-map-canvas { opacity:1; }
.real-map-canvas,.real-map-canvas .maplibregl-map,.real-map-canvas .maplibregl-canvas-container,.real-map-canvas .maplibregl-canvas { width:100%; height:100%; }
.real-map-canvas .maplibregl-canvas { outline:none; }
.real-map-canvas .maplibregl-ctrl-logo,.real-map-canvas .maplibregl-ctrl-attrib { display:none; }
.real-map-surface::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(115deg,rgba(255,77,46,.11),transparent 37%,rgba(24,222,209,.1)),linear-gradient(180deg,rgba(3,6,8,.08),rgba(3,6,8,.34)); mix-blend-mode:screen; }
.real-map-loading,.real-map-fallback { position:absolute; z-index:3; inset:0; display:grid; place-content:center; justify-items:center; padding:36px; background:radial-gradient(circle at 50% 44%,rgba(24,222,209,.12),transparent 32%),#071013; text-align:center; }
.real-map-loading { grid-template-columns:repeat(3,8px); gap:7px; }
.real-map-loading span { width:8px; height:8px; border-radius:50%; background:var(--deck-cyan); box-shadow:0 0 18px rgba(24,222,209,.55); animation:mapLoader .7s ease-in-out infinite alternate; }
.real-map-loading span:nth-child(2) { animation-delay:-.22s; }
.real-map-loading span:nth-child(3) { animation-delay:-.44s; }
.real-map-loading strong,.real-map-loading small { grid-column:1/-1; }
.real-map-loading strong { margin-top:10px; font:900 16px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.real-map-loading small { color:var(--deck-muted); font:700 7px var(--f-m,monospace); letter-spacing:.11em; text-transform:uppercase; }
.real-map-fallback strong { font:900 24px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.real-map-fallback span { max-width:420px; margin:8px 0 18px; color:var(--deck-muted); font-size:11px; }
.real-map-fallback button { padding:10px 16px; border:1px solid var(--deck-cyan); border-radius:999px; color:var(--deck-cyan); background:rgba(24,222,209,.05); font-weight:800; }
.real-map-marker { min-width:max-content; display:flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid var(--deck-cyan); border-radius:999px; color:var(--deck-cyan); background:rgba(3,7,9,.92); box-shadow:0 14px 28px rgba(0,0,0,.38); backdrop-filter:blur(12px); }
.real-map-marker > span { width:8px; height:8px; flex:0 0 auto; border-radius:50%; background:currentColor; box-shadow:0 0 13px currentColor; }
.real-map-marker > strong { max-width:180px; overflow:hidden; font:800 8px var(--f-m,monospace); letter-spacing:.06em; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
.real-map-marker > em { padding:3px 5px; border-radius:999px; color:#06100f; background:var(--deck-cyan); font:900 6px var(--f-m,monospace); font-style:normal; letter-spacing:.08em; }
.real-map-marker.signal-live > span { animation:pinPulse 1.3s ease-out infinite; }
.real-map-marker.signal-rising > em { color:#160804; background:var(--deck-orange); }
.real-map-marker.signal-upcoming > em { color:var(--deck-muted); background:rgba(243,238,231,.1); }
.real-map-marker.marker-painted { border-color:var(--deck-orange); color:var(--deck-orange); }
.real-map-marker:hover,.real-map-marker:focus-visible { color:var(--deck-cream); background:rgba(10,15,17,.98); box-shadow:0 16px 38px rgba(0,0,0,.52),0 0 0 4px rgba(24,222,209,.1); }
.real-map-marker.is-selected { border-color:var(--deck-cream); color:var(--deck-cream); background:rgba(24,222,209,.22); }
.real-map-marker.is-selected > span { animation:pinPulse 1.35s ease-out infinite; }
.real-map-user { width:16px; height:16px; border:3px solid #e9ffff; border-radius:50%; background:var(--deck-cyan); box-shadow:0 0 0 12px rgba(24,222,209,.13),0 0 24px rgba(24,222,209,.8); pointer-events:none; }
.map-scale-context { min-width:190px; position:absolute; z-index:3; top:20px; right:82px; display:grid; justify-items:end; pointer-events:none; text-align:right; }
.map-scale-context span { color:var(--deck-orange); font:800 7px var(--f-m,monospace); letter-spacing:.13em; }
.map-scale-context strong { font:900 20px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.map-scale-context small { color:var(--deck-muted); font-size:8px; }
.map-zoom-controls { position:absolute; z-index:4; top:18px; right:18px; display:grid; overflow:hidden; border:1px solid var(--deck-line); border-radius:11px; background:rgba(4,5,6,.86); }
.map-zoom-controls button { width:38px; height:34px; border:0; color:var(--deck-cream); background:transparent; font-size:18px; }
.map-zoom-controls button + button { border-top:1px solid var(--deck-line); }
.map-zoom-controls button:disabled { opacity:.25; }
.map-trust-toggle { position:absolute; z-index:4; top:98px; right:18px; display:flex; align-items:center; gap:7px; padding:8px 10px; border:1px solid rgba(243,238,231,.15); border-radius:999px; color:var(--deck-muted); background:rgba(4,5,6,.82); font:800 7px var(--f-m,monospace); letter-spacing:.07em; text-transform:uppercase; backdrop-filter:blur(14px); }
.map-trust-toggle > span { color:var(--deck-cyan); text-shadow:0 0 10px var(--deck-cyan); }
.map-trust-toggle:hover,.map-trust-toggle[aria-expanded="true"] { border-color:rgba(24,222,209,.45); color:var(--deck-cream); }
.map-trust-panel { width:min(270px,calc(100% - 36px)); position:absolute; z-index:5; top:136px; right:18px; display:grid; gap:7px; padding:14px; border:1px solid rgba(24,222,209,.24); border-radius:14px; color:var(--deck-muted); background:rgba(4,7,8,.94); box-shadow:0 22px 60px rgba(0,0,0,.46); backdrop-filter:blur(22px); animation:panelReveal .28s var(--motion-spring) both; transform-origin:top right; }
.map-trust-panel > span { color:var(--deck-cyan); font:900 7px var(--f-m,monospace); letter-spacing:.12em; }
.map-trust-panel p { margin:0; font-size:9px; line-height:1.45; }
.map-trust-panel b { color:var(--deck-cream); }
.local-map-svg { width:100%; height:100%; }
.scene-local-map[data-zoom="state"] .map-minor-roads,.scene-local-map[data-zoom="region"] .map-minor-roads,.scene-local-map[data-zoom="nation"] .map-minor-roads,.scene-local-map[data-zoom="global"] .map-minor-roads { opacity:.4; }
.scene-local-map[data-zoom="region"] .local-map-svg,.scene-local-map[data-zoom="nation"] .local-map-svg,.scene-local-map[data-zoom="global"] .local-map-svg { transform:scale(.88); opacity:.74; }
.scene-local-map[data-zoom="global"] .local-map-svg { transform:scale(.72) rotate(-3deg); opacity:.55; }
.map-land { fill:#071013; }
.map-county-fill { fill:rgba(243,238,231,.025); stroke:rgba(243,238,231,.26); stroke-width:2; stroke-dasharray:8 7; }
.map-river { opacity:.82; }
.map-minor-roads { fill:none; stroke:rgba(243,238,231,.09); stroke-width:2; }
.map-major-roads { fill:none; stroke:rgba(243,238,231,.28); stroke-width:5; }
.map-major-roads path:nth-child(2) { stroke:rgba(24,222,209,.28); }
.map-major-roads path:nth-child(3) { stroke:rgba(255,77,46,.2); }
.map-road-labels text { fill:rgba(243,238,231,.58); font:700 10px var(--f-m,monospace); letter-spacing:.08em; paint-order:stroke; stroke:#071013; stroke-width:5; }
.map-place-labels text { fill:rgba(243,238,231,.55); font:800 13px var(--f-m,monospace); letter-spacing:.14em; }
.map-place-labels .county-label { fill:var(--deck-cyan); font-size:9px; }
.map-location-accuracy { fill:rgba(24,222,209,.08); stroke:rgba(24,222,209,.32); stroke-width:2; }
.map-location-core { fill:var(--deck-cyan); stroke:#e8ffff; stroke-width:2; filter:drop-shadow(0 0 8px rgba(24,222,209,.9)); }
.map-location-label { fill:var(--deck-cream); font:800 8px var(--f-m,monospace); letter-spacing:.08em; paint-order:stroke; stroke:#071013; stroke-width:4; }
.local-map-vignette { position:absolute; z-index:1; inset:0; pointer-events:none; background:radial-gradient(circle at 48% 48%,transparent 18%,rgba(2,4,5,.13) 62%,rgba(2,4,5,.62) 100%),linear-gradient(115deg,rgba(255,77,46,.06),transparent 35%,rgba(24,222,209,.05)); }
.local-map-content { position:absolute; inset:0; }
.scene-local-map .pin-one { top:39%; left:45%; }
.scene-local-map .pin-two { top:54%; right:13%; }
.scene-local-map .pin-three { bottom:28%; left:36%; }
.scene-local-map .map-radius-readout { right:3%; bottom:15%; }
.map-attribution { position:absolute; z-index:3; right:24px; bottom:70px; display:flex; gap:4px; color:rgba(243,238,231,.48); font:700 7px var(--f-m,monospace); letter-spacing:.04em; }
.map-attribution a { color:inherit; text-decoration:none; }
.map-attribution a:hover { color:var(--deck-cyan); text-decoration:underline; }
.map-pin { position:absolute; z-index:3; display:flex; align-items:center; gap:6px; padding:7px 9px; border:1px solid currentColor; border-radius:999px; color:var(--deck-cyan); background:rgba(3,5,6,.82); font:800 8px var(--f-m,monospace); letter-spacing:.07em; text-transform:uppercase; box-shadow:0 10px 20px rgba(0,0,0,.35); }
.map-pin span { width:7px; height:7px; border-radius:50%; background:currentColor; box-shadow:0 0 10px currentColor; }
.map-pin.pin-one { top:29%; left:11%; }
.map-pin.pin-two { top:47%; right:8%; color:var(--deck-orange); }
.map-pin.pin-three { bottom:20%; left:23%; }
.map-empty-state { position:absolute; inset:0; display:grid; place-content:center; justify-items:center; padding:40px; background:rgba(3,5,6,.68); text-align:center; }
.map-empty-state strong { font:900 24px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.map-empty-state span { margin:8px 0 16px; color:var(--deck-muted); font-size:11px; }
.map-empty-state button { padding:10px 14px; border:1px solid var(--deck-cyan); border-radius:999px; color:var(--deck-cyan); background:transparent; }
.map-radius-readout { position:absolute; right:-2%; bottom:2%; color:var(--deck-muted); font:700 9px var(--f-m,monospace); text-align:right; text-transform:uppercase; }
.map-radius-readout > span { color:var(--deck-cream); font:900 38px var(--f-d,Arial,sans-serif); }
.map-radius-readout small { color:var(--deck-cyan); }
.map-bottom-controls { position:absolute; right:24px; bottom:18px; left:24px; display:grid; grid-template-columns:1fr auto; align-items:end; gap:20px; }
.map-level-rail { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:4px; padding:5px; border:1px solid var(--deck-line); border-radius:12px; background:rgba(5,7,8,.82); }
.map-level-rail button { min-width:0; display:grid; justify-items:center; gap:4px; padding:6px 3px; border:0; border-radius:8px; color:var(--deck-muted); background:transparent; font:700 7px var(--f-m,monospace); text-transform:uppercase; }
.map-level-rail button > span { width:6px; height:6px; border-radius:50%; background:currentColor; }
.map-level-rail button[aria-current="step"] { color:#04100f; background:var(--deck-cyan); }
.map-place-detail { min-width:300px; display:grid; grid-template-columns:auto 1fr auto; align-items:center; column-gap:8px; padding:10px 13px; border:1px solid var(--deck-line); border-radius:12px; background:rgba(5,7,8,.86); }
.map-place-detail strong { font-size:12px; }
.map-place-detail small { grid-column:2; color:var(--deck-muted); font-size:9px; }
.map-open-page { grid-column:3; grid-row:1/3; color:var(--deck-cyan); font-size:10px; }
.map-live-dot { width:8px; height:8px; grid-row:1/3; border-radius:50%; background:var(--deck-orange); box-shadow:0 0 12px var(--deck-orange); }
.map-detail-sheet { width:min(390px,calc(100% - 36px)); position:absolute; z-index:12; top:18px; right:18px; display:grid; grid-template-columns:92px 1fr; gap:14px; padding:16px; border:1px solid var(--deck-line); border-radius:20px; color:var(--deck-cream); background:rgba(7,8,9,.96); box-shadow:0 26px 80px rgba(0,0,0,.5); backdrop-filter:blur(20px); }
.map-detail-sheet > img { border-radius:12px; object-fit:cover; }
.map-detail-close { width:32px; height:32px; position:absolute; top:8px; right:8px; display:grid; place-items:center; border:0; border-radius:50%; color:var(--deck-muted); background:rgba(243,238,231,.06); }
.map-detail-close .deck-icon { width:16px; height:16px; }
.map-detail-title { min-width:0; display:grid; align-content:center; padding-right:24px; }
.map-detail-title > span { color:var(--deck-cyan); font:800 7px var(--f-m,monospace); letter-spacing:.08em; }
.map-detail-title h2 { margin:4px 0; font:900 22px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.map-detail-title strong { overflow:hidden; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.map-detail-title small { color:var(--deck-muted); font-size:9px; }
.map-detail-signal { grid-column:1/-1; display:grid; gap:3px; padding:12px 0; border-top:1px solid var(--deck-line); border-bottom:1px solid var(--deck-line); }
.map-detail-signal span { color:var(--deck-orange); font:800 9px var(--f-m,monospace); }
.map-detail-signal small { color:var(--deck-muted); }
.map-upcoming-events { grid-column:1/-1; display:grid; }
.map-upcoming-events > span { padding:2px 0 7px; color:var(--deck-cyan); font:800 7px var(--f-m,monospace); letter-spacing:.1em; }
.map-upcoming-events > button { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto; padding:9px 0; border:0; border-top:1px solid rgba(243,238,231,.08); color:var(--deck-cream); background:transparent; text-align:left; }
.map-upcoming-events strong,.map-upcoming-events small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.map-upcoming-events strong { font-size:10px; }
.map-upcoming-events small { grid-column:1; color:var(--deck-muted); font-size:8px; }
.map-upcoming-events i { grid-column:2; grid-row:1/3; align-self:center; color:var(--deck-cyan); font-style:normal; }
.map-detail-actions { grid-column:1/-1; display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
.map-detail-actions a,.map-detail-actions button { min-height:36px; display:grid; place-items:center; border:1px solid var(--deck-line); border-radius:8px; color:var(--deck-cream); background:transparent; font-size:9px; text-decoration:none; }
.map-detail-actions .primary { border-color:transparent; color:#04100f; background:var(--deck-cyan); }

/* Discover */
.discover-module { grid-template-columns:minmax(360px,.84fr) minmax(400px,1.16fr); }
.discover-copy h1 { max-width:100%; font-size:clamp(50px,5.1vw,78px); }
.discover-count { display:flex; align-items:center; gap:16px; margin-top:32px; }
.discover-count strong { color:var(--deck-cyan); font:900 54px var(--f-d,Arial,sans-serif); }
.discover-count span { color:var(--deck-muted); font:700 9px/1.45 var(--f-m,monospace); letter-spacing:.1em; text-transform:uppercase; }
.discover-stage { height:min(69vh,650px); position:relative; display:grid; grid-template-rows:minmax(0,1fr) 64px; place-items:center; row-gap:12px; }
.discover-stage::before,.discover-stage::after { content:""; width:min(35vw,400px); aspect-ratio:.75; position:absolute; border:1px solid rgba(243,238,231,.11); border-radius:28px; background:rgba(243,238,231,.025); transform:translate(44px,-30px) rotate(7deg); }
.discover-stage::after { transform:translate(78px,14px) rotate(13deg); }
.discover-card { width:min(35vw,400px); aspect-ratio:.75; position:relative; z-index:2; grid-row:1; overflow:hidden; border:1px solid rgba(243,238,231,.22); border-radius:28px; background:#08090a; box-shadow:0 40px 100px rgba(0,0,0,.52); cursor:grab; touch-action:pan-y; transition:transform .18s ease; }
.discover-card:active { cursor:grabbing; transition:none; }
.discover-card img { object-fit:cover; }
.discover-card-gradient { position:absolute; inset:0; background:linear-gradient(180deg,transparent 32%,rgba(0,0,0,.2) 48%,rgba(0,0,0,.96) 100%); }
.discover-card-copy { position:absolute; right:26px; bottom:28px; left:26px; display:grid; }
.discover-card-copy > span { color:var(--deck-cyan); font:800 9px var(--f-m,monospace); letter-spacing:.12em; text-transform:uppercase; }
.discover-card-copy h2 { margin:8px 0 0; font:900 clamp(30px,3.4vw,48px)/.92 var(--f-d,Arial,sans-serif); letter-spacing:-.045em; overflow-wrap:anywhere; text-transform:uppercase; }
.discover-card-copy p { color:var(--deck-cream); font-size:16px; }
.discover-card-copy small { color:var(--deck-muted); font-size:11px; }
.discover-why { max-width:310px; display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:7px; margin-top:11px; padding-top:10px; border-top:1px solid rgba(243,238,231,.14); }
.discover-why b { color:var(--deck-cyan); font:900 7px var(--f-m,monospace); letter-spacing:.1em; white-space:nowrap; }
.discover-why i { min-width:0; overflow:hidden; color:rgba(243,238,231,.68); font:500 8px var(--f-m,monospace); font-style:normal; text-overflow:ellipsis; white-space:nowrap; }
.swipe-outcome { position:absolute; z-index:5; top:14%; left:4%; padding:9px 14px; border:2px solid var(--deck-orange); border-radius:7px; opacity:0; color:var(--deck-orange); font:900 22px var(--f-d,Arial,sans-serif); transform:rotate(-9deg); }
.swipe-outcome-save { right:2%; left:auto; border-color:var(--deck-cyan); color:var(--deck-cyan); transform:rotate(9deg); }
.swipe-outcome.is-visible { opacity:1; }
.discover-actions { position:relative; z-index:6; grid-row:2; display:flex; justify-content:center; gap:16px; }
.discover-actions button { min-width:116px; height:50px; display:flex; align-items:center; justify-content:center; gap:8px; padding:0 18px; border:1px solid var(--deck-orange); border-radius:999px; color:var(--deck-orange); background:#08090a; font-weight:800; white-space:nowrap; }
.discover-actions button.save { min-width:180px; border-color:var(--deck-cyan); color:#04100f; background:var(--deck-cyan); }
.discover-action-short { display:none; }
.discover-feedback { position:absolute; z-index:9; top:10px; left:50%; display:flex; align-items:center; gap:14px; padding:10px 14px; border:1px solid var(--deck-line); border-radius:999px; color:var(--deck-cream); background:rgba(6,7,8,.92); box-shadow:0 12px 40px rgba(0,0,0,.35); transform:translateX(-50%); }
.discover-feedback.save { border-color:rgba(24,222,209,.5); }
.discover-feedback.skip { border-color:rgba(255,77,46,.5); }
.discover-feedback span { font:800 9px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; }
.discover-feedback button { border:0; color:var(--deck-cyan); background:transparent; font-size:10px; text-decoration:underline; }

/* Radio */
.radio-module { grid-template-columns:minmax(300px,.68fr) minmax(620px,1.32fr); }
.radio-heading h1 { font-size:clamp(44px,4.8vw,72px); line-height:.92; }
.radio-scope { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:26px; }
.radio-scope button { min-height:42px; padding:0 14px; border:1px solid var(--deck-line); border-radius:12px; color:var(--deck-muted); background:linear-gradient(180deg,rgba(243,238,231,.05),rgba(243,238,231,.015)); font:800 9px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; transition:.2s ease; }
.radio-scope button:hover,.radio-scope button[aria-pressed="true"] { border-color:rgba(24,222,209,.55); color:var(--deck-cyan); background:rgba(24,222,209,.08); transform:translateY(-1px); }
.radio-console { min-height:570px; display:grid; grid-template-rows:auto auto 1fr; overflow:hidden; border:1px solid var(--deck-line); border-radius:28px; background:rgba(5,6,7,.72); box-shadow:0 38px 90px rgba(0,0,0,.33); }
.radio-topline { min-height:152px; display:grid; grid-template-columns:126px minmax(0,1fr) auto; align-items:center; gap:20px; padding:18px 22px; border-bottom:1px solid var(--deck-line); background:radial-gradient(circle at 10% 50%,rgba(255,77,46,.14),transparent 32%); }
.radio-live-art { width:116px; aspect-ratio:1; position:relative; display:grid; place-items:center; overflow:hidden; border:1px solid rgba(243,238,231,.18); border-radius:50%; background:#09090a; }
.radio-live-art > button { width:48px; height:48px; z-index:2; display:grid; place-items:center; border:1px solid var(--deck-cream); border-radius:50%; color:var(--deck-cream); background:rgba(5,6,7,.84); }
.radio-rings { width:100%; aspect-ratio:1; position:absolute; display:grid; place-items:center; border:1px solid rgba(255,77,46,.2); border-radius:50%; }
.radio-rings span { position:absolute; inset:10%; border:1px solid rgba(243,238,231,.12); border-radius:50%; }
.radio-rings span:nth-child(2){inset:22%}.radio-rings span:nth-child(3){inset:34%}.radio-rings span:nth-child(4){inset:46%;background:var(--deck-orange);box-shadow:0 0 34px rgba(255,77,46,.45)}
.radio-now { min-width:0; display:grid; gap:3px; }
.radio-now span { color:var(--deck-orange); font:800 9px var(--f-m,monospace); letter-spacing:.14em; }
.radio-now strong { overflow:hidden; font:900 clamp(19px,1.65vw,24px)/1 var(--f-d,Arial,sans-serif); text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
.radio-now small { color:var(--deck-muted); }
.radio-favorites-toggle { min-height:42px; display:flex; align-items:center; gap:8px; padding:0 14px; border:1px solid rgba(255,77,46,.32); border-radius:12px; color:var(--deck-orange); background:rgba(255,77,46,.045); font-weight:800; }
.radio-favorites-toggle[aria-pressed="true"] { color:#160a07; background:var(--deck-orange); }
.radio-filters { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:end; gap:10px; padding:14px 18px; border-bottom:1px solid var(--deck-line); }
.radio-filters label { display:grid; gap:6px; color:var(--deck-muted); font:700 9px var(--f-m,monospace); letter-spacing:.1em; text-transform:uppercase; }
.radio-filters select,.settings-board select { width:100%; height:43px; padding:0 12px; border:1px solid var(--deck-line); border-radius:11px; color:var(--deck-cream); color-scheme:dark; background:linear-gradient(180deg,#141617,#0e0f10); box-shadow:inset 0 1px rgba(255,255,255,.04); }
.radio-results { min-height:0; overflow:auto; padding:12px 16px 16px; }
.radio-results-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; padding:4px 3px 9px; }
.radio-results-heading span { color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.radio-results-heading small { overflow:hidden; color:var(--deck-muted); font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
.radio-results article { min-width:0; display:grid; grid-template-columns:38px minmax(0,1fr) auto auto 36px; align-items:center; gap:12px; min-height:62px; margin-top:7px; padding:8px 10px; border:1px solid rgba(243,238,231,.1); border-radius:14px; background:linear-gradient(105deg,rgba(243,238,231,.045),rgba(243,238,231,.012)); transition:.2s ease; }
.radio-results article:hover { border-color:rgba(24,222,209,.32); transform:translateY(-1px); }
.radio-result-play,.radio-favorite { width:36px; height:36px; display:grid; place-items:center; border:1px solid var(--deck-line); border-radius:50%; color:var(--deck-cream); background:rgba(243,238,231,.035); }
.radio-result-play .deck-icon { width:17px; height:17px; }
.radio-results article > span { min-width:0; display:grid; }
.radio-results article strong { overflow:hidden; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
.radio-results article small { overflow:hidden; color:var(--deck-muted); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.radio-results article i { color:var(--deck-cyan); font:800 8px var(--f-m,monospace); font-style:normal; white-space:nowrap; }
.radio-results article b { color:var(--deck-orange); font:800 8px var(--f-m,monospace); }
.radio-favorite { border-radius:11px; color:var(--deck-muted); }
.radio-favorite[aria-pressed="true"] { border-color:rgba(255,77,46,.5); color:var(--deck-orange); background:rgba(255,77,46,.08); }
.radio-empty { display:grid; place-items:center; gap:12px; min-height:160px; color:var(--deck-muted); }
.radio-empty button { padding:9px 12px; border:1px solid var(--deck-cyan); border-radius:11px; color:var(--deck-cyan); background:transparent; }

/* Dashboard */
.dashboard-module { grid-template-columns:minmax(330px,.72fr) minmax(620px,1.28fr); align-items:stretch; padding-top:clamp(22px,3.5vh,42px); }
.dashboard-heading { min-height:0; overflow:auto; padding-right:4px; }
.dashboard-heading h1 { font-size:clamp(39px,3.7vw,56px); line-height:.94; overflow-wrap:normal; word-break:normal; }
.role-picker { display:flex; flex-wrap:wrap; gap:8px; margin-top:30px; }
.role-picker button { min-width:84px; height:40px; padding:0 13px; border:1px solid var(--deck-line); border-radius:12px; color:var(--deck-muted); background:linear-gradient(180deg,rgba(243,238,231,.05),rgba(243,238,231,.012)); font:800 9px var(--f-m,monospace); text-transform:uppercase; transition:.2s ease; }
.role-picker button:hover { border-color:rgba(24,222,209,.4); color:var(--deck-cream); transform:translateY(-1px); }
.role-picker button[aria-pressed="true"] { border-color:var(--deck-cyan); color:#04100f; background:var(--deck-cyan); }
.role-picker .role-manage-button { min-width:110px; border-style:dashed; color:var(--deck-cyan); }
.role-manager { display:grid; gap:8px; margin-top:10px; padding:13px; border:1px solid var(--deck-line); border-radius:14px; background:rgba(4,5,6,.72); }
.role-manager > span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.1em; text-transform:uppercase; }
.role-manager > p { font-size:10px; }
.role-manager > div { display:flex; flex-wrap:wrap; gap:6px; }
.role-manager button { display:flex; align-items:center; gap:6px; padding:7px 9px; border:1px solid var(--deck-line); border-radius:9px; color:var(--deck-muted); background:rgba(243,238,231,.025); font:800 8px var(--f-m,monospace); text-transform:uppercase; }
.role-manager button[aria-pressed="true"] { border-color:rgba(24,222,209,.45); color:var(--deck-cyan); }
.dashboard-build { display:grid; gap:7px; margin-top:16px; padding:15px; border:1px solid rgba(255,77,46,.27); border-radius:16px; background:linear-gradient(135deg,rgba(255,77,46,.07),rgba(243,238,231,.018)); }
.dashboard-build > span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.11em; }
.dashboard-build strong { font:900 16px/1.08 var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.dashboard-build p { font-size:11px; line-height:1.45; }
.dashboard-build a { width:max-content; padding:7px 0; border:0; color:var(--deck-cyan); background:transparent; font-size:9px; font-weight:800; text-decoration:none; }
.dashboard-signal { display:grid; gap:12px; }
.dashboard-workspace { min-height:0; overflow:auto; padding-right:4px; }
.dashboard-next { display:grid; grid-template-columns:1fr auto; align-items:center; column-gap:16px; padding:16px 18px; border:1px solid rgba(24,222,209,.35); border-radius:16px; background:rgba(24,222,209,.055); }
.dashboard-next > span { grid-column:1/-1; color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.dashboard-next strong { font:900 18px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.dashboard-next a { grid-column:2; grid-row:2; padding:9px 12px; border:1px solid rgba(24,222,209,.28); border-radius:9px; color:var(--deck-cyan); background:rgba(24,222,209,.05); font-size:10px; text-decoration:none; }
.dashboard-metrics { display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--deck-line); border-bottom:1px solid var(--deck-line); }
.dashboard-metrics div { min-width:0; display:grid; gap:4px; padding:13px 14px; border-right:1px solid var(--deck-line); border-bottom:1px solid var(--deck-line); }
.dashboard-metrics div:nth-child(3n) { border-right:0; }
.dashboard-metrics div:nth-last-child(-n+3) { border-bottom:0; }
.dashboard-metrics span { color:var(--deck-muted); font:700 8px var(--f-m,monospace); letter-spacing:.1em; text-transform:uppercase; }
.dashboard-metrics strong { overflow:hidden; font:900 clamp(25px,2.4vw,39px)/1 var(--f-d,Arial,sans-serif); text-overflow:ellipsis; white-space:nowrap; }
.signal-chart { height:300px; position:relative; display:flex; align-items:end; gap:clamp(9px,1.4vw,20px); padding:38px 28px 30px; overflow:hidden; border:1px solid var(--deck-line); border-radius:24px; background:linear-gradient(180deg,rgba(24,222,209,.06),transparent); }
.signal-chart > span { flex:1; min-width:12px; background:linear-gradient(180deg,var(--deck-cyan),rgba(24,222,209,.08)); box-shadow:0 0 18px rgba(24,222,209,.16); }
.signal-chart > span:nth-of-type(3n) { background:linear-gradient(180deg,var(--deck-orange),rgba(255,77,46,.09)); }
.signal-chart > strong { position:absolute; top:18px; left:22px; color:var(--deck-muted); font:800 9px var(--f-m,monospace); letter-spacing:.14em; }
.signal-grid { position:absolute; inset:60px 0 30px; background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(25% - 1px),rgba(243,238,231,.08) 25%); }
.dashboard-recommendations,.dashboard-insights { display:grid; overflow:hidden; border:1px solid var(--deck-line); border-radius:16px; background:rgba(243,238,231,.018); }
.dashboard-recommendations > div:first-child { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; padding:12px 14px 9px; }
.dashboard-recommendations > div:first-child span,.dashboard-insights > span { color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.dashboard-recommendations > div:first-child small { color:var(--deck-muted); font-size:8px; text-align:right; }
.dashboard-recommendations > button { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) auto 16px; align-items:center; gap:12px; padding:11px 14px; border:0; border-top:1px solid rgba(243,238,231,.09); color:var(--deck-cream); background:transparent; text-align:left; }
.dashboard-recommendations > button:hover { background:rgba(243,238,231,.04); }
.dashboard-recommendations > button > span { min-width:0; display:grid; }
.dashboard-recommendations strong,.dashboard-recommendations small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dashboard-recommendations strong { font-size:11px; }
.dashboard-recommendations small { color:var(--deck-muted); font-size:8px; }
.dashboard-recommendations i { padding:5px 7px; border:1px solid rgba(255,77,46,.35); border-radius:999px; color:var(--deck-orange); font:800 7px var(--f-m,monospace); font-style:normal; white-space:nowrap; }
.dashboard-recommendations b { color:var(--deck-cyan); }
.dashboard-insights > span { padding:12px 14px 8px; }
.dashboard-insights > div { display:grid; grid-template-columns:28px minmax(0,1fr); align-items:start; gap:8px; padding:8px 14px; border-top:1px solid rgba(243,238,231,.08); }
.dashboard-insights > div strong { color:var(--deck-orange); font:800 8px var(--f-m,monospace); }
.dashboard-insights > div p { max-width:none; font-size:10px; line-height:1.35; }
.dashboard-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.dashboard-actions a { min-width:0; display:flex; justify-content:space-between; gap:8px; padding:11px 12px; border:1px solid var(--deck-line); border-radius:11px; color:var(--deck-muted); background:linear-gradient(180deg,rgba(243,238,231,.045),rgba(243,238,231,.012)); text-align:left; font-size:9px; text-decoration:none; }
.dashboard-actions a.primary { color:var(--deck-cream); }
.dashboard-actions a span { color:var(--deck-cyan); }

/* Settings */
.settings-module { grid-template-columns:minmax(360px,.82fr) minmax(560px,1.18fr); }
.settings-heading h1 { font-size:clamp(44px,3.85vw,58px); line-height:.96; }
.settings-board { max-height:min(72vh,700px); overflow-x:hidden; overflow-y:auto; border:1px solid var(--deck-line); border-radius:28px; background:rgba(5,6,7,.65); scrollbar-color:rgba(24,222,209,.52) rgba(243,238,231,.04); scrollbar-width:thin; }
.settings-section { display:grid; padding:24px 28px; border-bottom:1px solid var(--deck-line); }
.settings-section > span { margin-bottom:8px; color:var(--deck-cyan); font:800 9px var(--f-m,monospace); letter-spacing:.14em; }
.settings-section label { min-height:55px; display:flex; align-items:center; justify-content:space-between; gap:22px; }
.settings-section label > span { display:grid; }
.settings-section label strong { font-size:14px; }
.settings-section label small { color:var(--deck-muted); font-size:10px; }
.settings-section input[type="checkbox"] { width:44px; height:24px; flex:0 0 auto; accent-color:var(--deck-cyan); }
.settings-board select { min-width:130px; }
.settings-appearance,.settings-accessibility { grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:24px; }
.settings-appearance > span,.settings-accessibility > span { grid-column:1/-1; }
.settings-appearance label,.settings-accessibility label { min-width:0; }
.settings-appearance select { width:min(180px,52%); }
.settings-accessibility label:nth-of-type(n+3) { border-top:1px solid rgba(243,238,231,.07); }
.settings-foot { display:flex; align-items:center; gap:12px; padding:18px 28px; }
.settings-save-status { padding:0 28px 12px; color:var(--deck-cyan); font:800 8px var(--f-m,monospace); letter-spacing:.08em; text-align:right; text-transform:uppercase; }
.settings-foot span { margin-right:auto; color:var(--deck-orange); font:800 9px var(--f-m,monospace); text-transform:uppercase; }
.settings-foot button { padding:9px 12px; border:1px solid var(--deck-line); border-radius:11px; color:var(--deck-cream); background:linear-gradient(180deg,rgba(243,238,231,.055),rgba(243,238,231,.015)); box-shadow:inset 0 1px rgba(255,255,255,.05); font-size:10px; }
.settings-foot button:hover,.settings-alpha-states button:hover { border-color:rgba(24,222,209,.45); color:var(--deck-cyan); background:rgba(24,222,209,.05); }
.settings-alpha-states > p { margin:0 0 10px; color:var(--deck-muted); font-size:10px; }
.settings-alpha-states > div { display:flex; flex-wrap:wrap; gap:6px; }
.settings-alpha-states > div button { padding:7px 9px; border:1px solid var(--deck-line); border-radius:999px; color:var(--deck-muted); background:transparent; font:700 8px var(--f-m,monospace); text-transform:uppercase; }
.settings-alpha-states > div button[aria-pressed="true"] { border-color:var(--deck-cyan); color:var(--deck-cyan); }

/* Community */
.community-module { grid-template-columns:minmax(360px,.78fr) minmax(600px,1.22fr); align-items:stretch; padding-top:clamp(24px,4vh,48px); }
.community-manifesto { min-width:0; display:grid; align-content:center; }
.community-manifesto h1 { font-size:clamp(40px,3.8vw,58px); line-height:.96; }
.community-manifesto p { max-width:500px; }
.community-board { min-height:0; display:grid; grid-template-rows:auto 1fr; overflow:hidden; border:1px solid var(--deck-line); border-radius:24px; background:rgba(5,6,7,.68); box-shadow:0 38px 90px rgba(0,0,0,.28); }
.community-subnav { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); padding:8px; border-bottom:1px solid var(--deck-line); background:rgba(243,238,231,.018); }
.community-subnav button { min-height:42px; padding:0 9px; border:0; border-radius:10px; color:var(--deck-muted); background:transparent; font:800 8px var(--f-m,monospace); letter-spacing:.08em; text-transform:uppercase; }
.community-subnav button:hover { color:var(--deck-cream); background:rgba(243,238,231,.045); }
.community-subnav button[aria-current="page"] { color:#04100f; background:var(--deck-cyan); box-shadow:0 8px 26px rgba(24,222,209,.18); }
.community-panel { min-height:0; overflow:auto; padding:clamp(20px,2.6vw,34px); }
.community-panel > span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.12em; }
.community-vote-panel h2 { max-width:690px; margin:18px 0 12px; font:900 clamp(28px,3vw,44px)/.98 var(--f-d,Arial,sans-serif); letter-spacing:-.035em; text-transform:uppercase; }
.community-vote-panel > p { max-width:680px; font-size:13px; }
.community-vote-tally { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:18px; margin-top:26px; }
.community-vote-tally > strong { color:var(--deck-cyan); font:900 clamp(42px,5vw,72px)/1 var(--f-d,Arial,sans-serif); }
.community-vote-tally > span { display:grid; gap:8px; color:var(--deck-muted); font-size:9px; }
.community-vote-tally i { width:100%; height:5px; display:block; border-radius:999px; background:var(--deck-cyan); box-shadow:0 0 18px rgba(24,222,209,.25); }
.community-vote-actions { display:flex; gap:10px; margin-top:24px; }
.community-vote-actions button,.community-dmca > div a,.community-dmca > div button { min-height:42px; padding:0 15px; border:1px solid var(--deck-line); border-radius:11px; color:var(--deck-cream); background:linear-gradient(180deg,rgba(243,238,231,.055),rgba(243,238,231,.015)); font-size:10px; font-weight:800; text-decoration:none; }
.community-vote-actions button[aria-pressed="true"] { border-color:var(--deck-cyan); color:#04100f; background:var(--deck-cyan); }
.community-vote-panel > small { display:block; margin-top:12px; color:var(--deck-cyan); }
.community-principles { display:grid; grid-template-columns:1fr 1fr; padding:0; }
.community-principles article { min-height:190px; padding:24px; border-right:1px solid var(--deck-line); border-bottom:1px solid var(--deck-line); }
.community-principles article:nth-child(2n) { border-right:0; }
.community-principles article > strong { color:var(--deck-orange); font:800 9px var(--f-m,monospace); }
.community-principles h2 { margin:16px 0 8px; font:900 19px/1.05 var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.community-principles p { font-size:11px; }
.community-policy-list { display:grid; align-content:center; gap:10px; }
.community-policy-list article { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 18px; padding:18px; border:1px solid var(--deck-line); border-radius:14px; background:rgba(243,238,231,.018); }
.community-policy-list article > span { color:var(--deck-orange); font:800 8px var(--f-m,monospace); letter-spacing:.1em; }
.community-policy-list article > strong { grid-column:1; font:900 16px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.community-policy-list article > p { grid-column:1; font-size:10px; }
.community-policy-list article > a { grid-column:2; grid-row:1/4; align-self:center; color:var(--deck-cyan); font-size:9px; font-weight:800; text-decoration:none; white-space:nowrap; }
.community-dmca { display:grid; align-content:center; }
.community-dmca ol { display:grid; gap:0; margin:20px 0; padding:0; list-style:none; counter-reset:dmca; }
.community-dmca li { display:grid; grid-template-columns:44px 1fr; padding:14px 0; border-top:1px solid var(--deck-line); counter-increment:dmca; }
.community-dmca li::before { content:"0" counter(dmca); grid-row:1/3; color:var(--deck-orange); font:800 9px var(--f-m,monospace); }
.community-dmca li strong { font:900 16px var(--f-d,Arial,sans-serif); text-transform:uppercase; }
.community-dmca li p { max-width:none; font-size:10px; }
.community-dmca > div { display:flex; gap:9px; }
.community-dmca > div a { display:grid; place-items:center; color:var(--deck-cyan); }
.community-dmca > div button { border-color:var(--deck-cyan); color:#04100f; background:var(--deck-cyan); }

/* Motion and interaction polish */
.module-deck-preview { --motion-fast:160ms; --motion-base:280ms; --motion-slow:520ms; --motion-ease:cubic-bezier(.2,.8,.2,1); --motion-spring:cubic-bezier(.2,1.14,.34,1); --module-accent:var(--deck-cyan); --module-glow:rgba(24,222,209,.14); contain:paint; }
.module-deck-preview.module-discover { --module-accent:var(--deck-cyan); --module-glow:rgba(24,222,209,.16); }
.module-deck-preview.module-radio { --module-accent:var(--deck-orange); --module-glow:rgba(255,77,46,.15); }
.module-deck-preview.module-dashboard { --module-accent:#d7ff59; --module-glow:rgba(215,255,89,.09); }
.module-deck-preview.module-settings { --module-accent:#a786ff; --module-glow:rgba(167,134,255,.1); }
.module-deck-preview.module-community { --module-accent:#ffb451; --module-glow:rgba(255,180,81,.1); }
.module-deck-preview::before { background:radial-gradient(circle at 17% 44%,rgba(255,77,46,.14),transparent 27%),radial-gradient(circle at 78% 39%,var(--module-glow),transparent 31%),linear-gradient(120deg,#050506 0%,#070811 48%,#031115 100%); animation:ambientDrift 16s ease-in-out infinite alternate; will-change:transform; }
.module-deck-preview.is-page-hidden * { animation-play-state:paused!important; }
.deck-stage { contain:layout paint style; }
.deck-stage > .deck-module { transition:opacity var(--motion-base) ease,transform var(--motion-base) var(--motion-ease); will-change:opacity,transform; }
.deck-stage.transition-up-out > .deck-module { opacity:0; transform:translate3d(0,-34px,0) scale(.988); }
.deck-stage.transition-down-out > .deck-module { opacity:0; transform:translate3d(0,34px,0) scale(.988); }
.deck-stage.transition-up-in > .deck-module { animation:stageInUp .48s var(--motion-spring) forwards; }
.deck-stage.transition-down-in > .deck-module { animation:stageInDown .48s var(--motion-spring) forwards; }
.deck-module { transform:translateZ(0); }
.deck-active-label { animation:deckMetaIn .34s var(--motion-ease) both; }
.deck-button:active,.deck-player-controls button:active,.deck-player-queue-button:active,.deck-player-hype:active,.map-zoom-controls button:active,.discover-actions button:active,.radio-result-play:active,.radio-favorite:active { transform:translateY(1px) scale(.965); }

.deck-search-results,.deck-account-menu,.deck-player-queue,.map-detail-sheet { animation:panelReveal .3s var(--motion-spring) both; transform-origin:top center; }
.deck-scrim { transition:opacity var(--motion-base) ease,visibility var(--motion-base); }
.deck-navigator { pointer-events:none; transition:transform .46s var(--motion-ease),box-shadow .46s ease; }
.deck-navigator.is-open { pointer-events:auto; box-shadow:34px 0 100px rgba(0,0,0,.4); }
.deck-nav-heading,.deck-nav-footer { opacity:0; transform:translate3d(-14px,0,0); }
.deck-navigator.is-open .deck-nav-heading,.deck-navigator.is-open .deck-nav-footer { animation:navItemIn .34s var(--motion-ease) .08s both; }
.deck-navigator.is-open .deck-nav-footer { animation-delay:.34s; }
.deck-navigator nav button { opacity:0; transform:translate3d(-18px,0,0); }
.deck-navigator.is-open nav button { animation:navItemIn .36s var(--motion-spring) calc(70ms + var(--nav-index) * 42ms) both; }
.deck-navigator nav button:hover { padding-left:17px; color:var(--module-accent); background:rgba(243,238,231,.04); }
.deck-navigator nav button[aria-current="page"] { box-shadow:0 10px 34px rgba(0,0,0,.28); }

.local-map-svg { transition:opacity var(--motion-base) ease,transform var(--motion-slow) var(--motion-ease); }
.local-map-content { transition:opacity var(--motion-fast) ease,transform var(--motion-base) var(--motion-ease); }
.scene-local-map.is-refreshing .local-map-content { opacity:.18; transform:scale(.985); }
.scene-local-map.is-refreshing .real-map-canvas { opacity:.38; }
.map-result-loader { position:absolute; z-index:14; top:50%; left:50%; display:flex; gap:6px; opacity:0; pointer-events:none; transform:translate(-50%,-50%); transition:opacity var(--motion-fast) ease; }
.map-result-loader span { width:8px; height:8px; border-radius:50%; background:var(--deck-cyan); box-shadow:0 0 16px rgba(24,222,209,.55); animation:mapLoader .7s ease-in-out infinite alternate; }
.map-result-loader span:nth-child(2) { animation-delay:-.22s; }
.map-result-loader span:nth-child(3) { animation-delay:-.44s; }
.scene-local-map.is-refreshing .map-result-loader { opacity:1; }
.local-map-content .map-pin { animation:pinEnter .42s var(--motion-spring) both; transform-origin:center bottom; }
.local-map-content .pin-two { animation-delay:.07s; }
.local-map-content .pin-three { animation-delay:.14s; }
.map-pin:hover { z-index:8; color:var(--deck-cream); background:rgba(11,16,17,.94); box-shadow:0 12px 32px rgba(0,0,0,.48),0 0 0 4px rgba(24,222,209,.08); transform:translateY(-2px); }
.map-pin.is-selected { color:var(--deck-cream); background:rgba(24,222,209,.18); }
.map-pin.is-selected span { animation:pinPulse 1.35s ease-out infinite; }
.map-filter-panel,.map-empty-state { animation:panelReveal .32s var(--motion-spring) both; }

.discover-stage::before { transform:translate(44px,-24px) rotate(6deg); }
.discover-stage::after { display:none; }
.discover-signal-wash { width:min(38vw,440px); aspect-ratio:.75; position:absolute; z-index:1; grid-row:1; border-radius:34px; opacity:calc(var(--swipe-strength) * .82); background:radial-gradient(circle at 50% 70%,rgba(24,222,209,.58),transparent 68%); filter:blur(22px); pointer-events:none; transform:scale(calc(.96 + var(--swipe-strength) * .08)); transition:opacity var(--motion-fast) ease,transform var(--motion-fast) ease; }
.discover-stage.intent-skip .discover-signal-wash { background:radial-gradient(circle at 50% 70%,rgba(255,77,46,.56),transparent 68%); }
.discover-next-card { width:min(35vw,400px); aspect-ratio:.75; position:absolute; z-index:0; grid-row:1; overflow:hidden; border:1px solid rgba(243,238,231,.12); border-radius:28px; background:#08090a; transform:translate3d(42px,-18px,0) rotate(6deg) scale(.965); }
.discover-next-card::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(2,3,4,.1),rgba(2,3,4,.72)); }
.discover-next-card img { width:100%; height:100%; object-fit:cover; opacity:.58; }
.discover-next-card span { position:absolute; z-index:2; right:20px; bottom:18px; color:rgba(243,238,231,.58); font:800 7px var(--f-m,monospace); letter-spacing:.14em; }
.discover-card { transition:transform .44s var(--motion-spring),box-shadow var(--motion-base) ease,opacity var(--motion-base) ease; will-change:transform; animation:discoverCardIn .48s var(--motion-spring) both; }
.discover-card.is-dragging { cursor:grabbing; transition:none; box-shadow:0 48px 120px rgba(0,0,0,.62),0 0 0 1px rgba(243,238,231,.14); }
.discover-card.is-save { opacity:.12; }
.discover-card.is-skip { opacity:.12; }
.swipe-outcome { transition:opacity var(--motion-fast) ease,transform var(--motion-fast) var(--motion-spring); }
.swipe-outcome:not(.is-visible) { transform:rotate(-9deg) scale(.8); }
.swipe-outcome-save:not(.is-visible) { transform:rotate(9deg) scale(.8); }
.swipe-outcome.is-visible { opacity:1; }
.discover-feedback { animation:feedbackIn .32s var(--motion-spring) both; }
.discover-actions button:hover { box-shadow:0 12px 34px rgba(255,77,46,.16); transform:translateY(-2px); }
.discover-actions button.save:hover { box-shadow:0 14px 38px rgba(24,222,209,.26); }

.deck-player { overflow:visible; isolation:isolate; transition:border-color var(--motion-base) ease,box-shadow var(--motion-base) ease,transform var(--motion-base) var(--motion-ease); }
.deck-player-aura { position:absolute; z-index:-1; inset:-16px 8%; border-radius:50%; opacity:0; pointer-events:none; background:radial-gradient(ellipse,rgba(24,222,209,.2),transparent 66%); filter:blur(18px); transition:opacity var(--motion-slow) ease; }
.deck-player.is-playing .deck-player-aura { opacity:.48; animation:playerAura 3.8s ease-in-out infinite alternate; }
.deck-player-art { width:52px; height:52px; position:relative; display:block; overflow:hidden; border-radius:10px; background:#0c0d0e; }
.deck-player-art img { width:100%; height:100%; display:block; object-fit:cover; animation:artworkIn .4s var(--motion-spring) both; }
.deck-player-copy { animation:deckMetaIn .34s var(--motion-ease) both; }
.deck-player-waveform { position:absolute; right:4px; bottom:4px; left:4px; height:23px; display:flex; align-items:end; justify-content:center; gap:2px; padding:3px; border-radius:5px; opacity:0; background:linear-gradient(180deg,transparent,rgba(2,4,5,.8)); transition:opacity var(--motion-base) ease; }
.deck-player-waveform.is-playing { opacity:1; }
.deck-player-waveform i { width:2px; height:var(--bar-height); display:block; border-radius:999px; background:var(--deck-cyan); box-shadow:0 0 4px rgba(24,222,209,.5); transform-origin:center bottom; }
.deck-player-waveform.is-playing i { animation:waveform .72s ease-in-out var(--bar-delay) infinite alternate; }
.deck-player.is-playing .deck-player-progress span { animation:progressDrift 8s linear infinite alternate; }
.deck-player-hype { position:relative; overflow:visible; }
.deck-player-hype.is-hyped { color:#04100f; background:var(--deck-cyan); box-shadow:0 0 26px rgba(24,222,209,.26); }
.hype-burst { position:absolute; inset:50%; pointer-events:none; }
.hype-burst b { width:4px; height:4px; position:absolute; display:block; border-radius:50%; opacity:0; background:var(--deck-cyan); }
.deck-player-hype.is-hyped .hype-burst b { animation:hypeBurst .62s var(--motion-ease) both; }
.hype-burst b:nth-child(1) { --burst-x:-36px; --burst-y:-21px; }
.hype-burst b:nth-child(2) { --burst-x:34px; --burst-y:-25px; animation-delay:.04s!important; }
.hype-burst b:nth-child(3) { --burst-x:-29px; --burst-y:25px; animation-delay:.08s!important; }
.hype-burst b:nth-child(4) { --burst-x:38px; --burst-y:20px; animation-delay:.12s!important; }
.hype-burst b:nth-child(5) { --burst-x:-8px; --burst-y:-38px; animation-delay:.02s!important; }
.hype-burst b:nth-child(6) { --burst-x:10px; --burst-y:39px; animation-delay:.1s!important; }
.hype-burst b:nth-child(7) { --burst-x:-42px; --burst-y:2px; animation-delay:.06s!important; }
.hype-burst b:nth-child(8) { --burst-x:44px; --burst-y:-1px; animation-delay:.14s!important; }
.deck-player-queue { transform-origin:bottom right; }
.deck-full-player { animation:fullPlayerIn .42s var(--motion-ease) both; }
.full-player-art { animation:fullArtworkIn .58s var(--motion-spring) both; }
.full-player-main { animation:fullCopyIn .48s var(--motion-ease) .08s both; }
.full-player-queue { animation:fullCopyIn .48s var(--motion-ease) .14s both; }
.full-player-art .deck-player-waveform { right:28px; bottom:24px; left:28px; height:70px; gap:5px; padding:12px; border-radius:16px; }
.full-player-art .deck-player-waveform i { width:5px; transform:scaleY(2.3); }

.deck-demo-state { animation:stateReveal .3s var(--motion-ease) both; }
.deck-demo-state > span { margin-top:18px; color:var(--deck-cyan); font:800 9px var(--f-m,monospace); letter-spacing:.18em; text-transform:uppercase; }
.deck-demo-state h2 { margin:10px 0 8px; }
.deck-demo-state button { display:flex; align-items:center; gap:28px; min-width:190px; justify-content:space-between; }
.deck-demo-state button b { font-size:18px; }
.demo-state-visual { width:148px; height:104px; position:relative; display:grid; grid-template-columns:repeat(3,1fr); align-items:end; gap:8px; padding:16px; border:1px solid var(--deck-line); border-radius:24px; overflow:hidden; background:rgba(243,238,231,.025); box-shadow:0 28px 70px rgba(0,0,0,.34); }
.demo-state-visual span { min-height:24%; border-radius:7px; background:linear-gradient(180deg,rgba(24,222,209,.7),rgba(24,222,209,.08)); animation:stateBars .9s ease-in-out infinite alternate; }
.demo-state-visual span:nth-child(2) { height:82%; animation-delay:-.3s; }
.demo-state-visual span:nth-child(3) { height:54%; animation-delay:-.6s; }
.demo-state-visual i { position:absolute; inset:10px; border:1px solid rgba(243,238,231,.08); border-radius:18px; }
.state-empty .demo-state-visual span,.state-offline .demo-state-visual span { opacity:.18; animation:none; }
.state-error .demo-state-visual span,.state-playback .demo-state-visual span { background:linear-gradient(180deg,rgba(255,77,46,.78),rgba(255,77,46,.08)); }
.state-error .demo-state-visual i { border-color:rgba(255,77,46,.38); transform:rotate(8deg); }
.state-offline .demo-state-visual i { border-style:dashed; }

@keyframes ambientDrift { from{transform:translate3d(-1.5%,-1%,0) scale(1.01)} to{transform:translate3d(1.5%,1%,0) scale(1.035)} }
@keyframes navItemIn { from{opacity:0;transform:translate3d(-18px,0,0)} to{opacity:1;transform:none} }
@keyframes panelReveal { from{opacity:0;transform:translate3d(0,-8px,0) scale(.98)} to{opacity:1;transform:none} }
@keyframes pinEnter { from{opacity:0;transform:translate3d(0,12px,0) scale(.72)} to{opacity:1;transform:none} }
@keyframes pinPulse { 0%{box-shadow:0 0 0 0 currentColor} 70%,100%{box-shadow:0 0 0 10px transparent} }
@keyframes mapLoader { from{transform:translateY(5px);opacity:.28} to{transform:translateY(-5px);opacity:1} }
@keyframes discoverCardIn { from{opacity:.35;transform:translate3d(0,22px,0) scale(.97)} to{opacity:1;transform:none} }
@keyframes feedbackIn { from{opacity:0;transform:translate3d(-50%,-10px,0) scale(.94)} to{opacity:1;transform:translate3d(-50%,0,0) scale(1)} }
@keyframes artworkIn { from{opacity:.3;transform:scale(1.1)} to{opacity:1;transform:none} }
@keyframes deckMetaIn { from{opacity:0;transform:translate3d(0,6px,0)} to{opacity:1;transform:none} }
@keyframes waveform { from{transform:scaleY(.35);opacity:.5} to{transform:scaleY(1);opacity:1} }
@keyframes progressDrift { from{width:42%} to{width:64%} }
@keyframes playerAura { from{transform:scale(.96);opacity:.22} to{transform:scale(1.04);opacity:.54} }
@keyframes hypeBurst { 0%{opacity:0;transform:translate(0,0) scale(.3)} 25%{opacity:1} 100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) scale(1)} }
@keyframes fullPlayerIn { from{opacity:0} to{opacity:1} }
@keyframes fullArtworkIn { from{opacity:0;transform:translate3d(-28px,0,0) scale(.95)} to{opacity:1;transform:none} }
@keyframes fullCopyIn { from{opacity:0;transform:translate3d(24px,0,0)} to{opacity:1;transform:none} }
@keyframes stateReveal { from{opacity:0} to{opacity:1} }
@keyframes stateBars { from{transform:scaleY(.45);opacity:.35} to{transform:scaleY(1);opacity:1} }
@keyframes sceneFrequency { 0%{transform:scaleY(.24);filter:brightness(.8)} 55%{transform:scaleY(1);filter:brightness(1.35)} 100%{transform:scaleY(.52);filter:brightness(1)} }
@keyframes sceneOrbit { from{transform:translate(-50%,-50%) rotate(0)} to{transform:translate(-50%,-50%) rotate(360deg)} }
@keyframes sceneHypeWave { 0%{opacity:.85;transform:scale(.25)} 70%{opacity:.22} 100%{opacity:0;transform:scale(8)} }
@keyframes signalToastIn { from{opacity:0;transform:translate(-50%,-12px) scale(.94)} to{opacity:1;transform:translate(-50%,0) scale(1)} }
@keyframes venueContextIn { from{opacity:0;transform:translate3d(0,12px,0) scale(.96)} to{opacity:1;transform:none} }
@keyframes hypeButtonSet { 0%{transform:scale(.9)} 58%{transform:scale(1.08)} 100%{transform:scale(1)} }
@keyframes searchShimmer { from{background-position:200% 0} to{background-position:-20% 0} }

@keyframes moduleIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
@keyframes playerMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes logoButtonPress { 0%{transform:scale(1) rotate(0);box-shadow:0 0 26px rgba(255,77,46,.12)} 28%{transform:scale(.86) rotate(-5deg);box-shadow:0 0 0 4px rgba(24,222,209,.16),0 0 38px rgba(255,77,46,.38)} 62%{transform:scale(1.06) rotate(2deg)} 100%{transform:scale(1) rotate(0)} }
@keyframes logoImagePulse { 0%{filter:saturate(1) brightness(1)} 32%{filter:saturate(1.7) brightness(1.28)} 100%{filter:saturate(1) brightness(1)} }
@keyframes stageInUp { from{opacity:0;transform:translate3d(0,34px,0) scale(.988)} to{opacity:1;transform:none} }
@keyframes stageInDown { from{opacity:0;transform:translate3d(0,-34px,0) scale(.988)} to{opacity:1;transform:none} }
@keyframes loadingPulse { from{opacity:.3} to{opacity:1} }
@media (max-width:1050px) {
  .deck-module { gap:30px; padding-inline:34px; }
  .deck-map-module,.discover-module,.radio-module,.dashboard-module,.settings-module,.community-module { grid-template-columns:minmax(280px,.75fr) minmax(440px,1.25fr); }
  .deck-module h1 { font-size:clamp(46px,6vw,68px); }
  .scene-map-frame { min-height:450px; }
  .deck-player { grid-template-columns:minmax(210px,.8fr) auto minmax(80px,1fr) minmax(90px,.4fr) 42px auto; gap:9px; }
  .deck-full-player { grid-template-columns:minmax(270px,.72fr) minmax(330px,1fr); }
  .full-player-queue { display:none; }
}
@media (max-width:800px) {
  .module-deck-preview { --mobile-hero-size:clamp(32px,9.2vw,40px); min-height:620px; }
  .deck-topbar { height:calc(68px + var(--deck-safe-top)); gap:10px; padding:calc(7px + var(--deck-safe-top)) calc(12px + var(--deck-safe-right)) 7px calc(12px + var(--deck-safe-left)); }
  .deck-logo { width:52px; height:52px; border-radius:14px; }
  .deck-search,.deck-search.is-open { width:calc(100vw - 150px); max-width:none; }
  .deck-search input { height:44px; font-size:12px; }
  .deck-active-label { display:none; }
  .deck-sample-badge { display:none; }
  .deck-profile { width:40px; height:40px; margin-left:auto; display:grid; }
  .deck-account-menu { top:62px; right:10px; }
  .deck-stage { height:calc(100dvh - 68px - var(--deck-safe-top)); min-height:552px; }
  .deck-module { display:block; overflow-x:hidden; overflow-y:auto; padding:28px 18px 102px; }
  .deck-module h1 { margin:6px 0 10px; font-size:var(--mobile-hero-size); line-height:.96; }
  .deck-module p { font-size:13px; }
  .deck-kicker { font-size:8px; }
  .deck-player { right:calc(8px + var(--deck-safe-right)); bottom:calc(8px + var(--deck-safe-bottom)); left:calc(8px + var(--deck-safe-left)); height:66px; grid-template-columns:minmax(0,1fr) auto; gap:8px; padding:8px; border-radius:15px; }
  .deck-player-track-button { grid-template-columns:44px minmax(0,1fr); gap:9px; }
  .deck-player-art { width:44px; height:44px; }
  .deck-player-progress,.deck-player-volume,.deck-player-queue-button,.deck-player-hype { display:none; }
  .deck-player-controls { gap:0; }
  .deck-player-controls button { width:30px; height:34px; }
  .deck-player-controls .deck-player-play { width:40px; height:40px; }
  .deck-player-copy strong { font-size:14px; }
  .deck-player-copy small { font-size:10px; }
  .deck-player-context-card { min-width:0; right:0; bottom:76px; left:0; }
  .scene-signal-toast { top:calc(76px + var(--deck-safe-top)); max-width:calc(100% - 28px); font-size:7px; text-align:center; }
  .deck-scrim { inset:calc(68px + var(--deck-safe-top)) 0 0; }
  .deck-navigator { top:calc(68px + var(--deck-safe-top)); width:100%; padding:18px calc(12px + var(--deck-safe-right)) calc(14px + var(--deck-safe-bottom)) calc(12px + var(--deck-safe-left)); }
  .deck-navigator nav button { min-height:58px; grid-template-columns:28px minmax(0,1fr) 16px; }
  .deck-navigator nav button > strong { font-size:18px; }
  .deck-navigator nav button > small { font-size:9px; }
  .deck-map-module { display:grid; grid-template-columns:1fr; grid-template-rows:auto minmax(420px,1fr); }
  .deck-map-module .deck-module-copy h1 { font-size:var(--mobile-hero-size); }
  .deck-map-module .deck-module-copy p,.deck-location-line,.deck-map-module .deck-button { display:none; }
  .scene-map-frame { width:100%; height:auto; min-height:430px; border-radius:22px; }
  .scene-globe { width:min(92vw,500px); left:53%; }
  .map-attribution { right:12px; bottom:88px; max-width:210px; flex-wrap:wrap; justify-content:flex-end; font-size:6px; text-align:right; }
  .map-trust-toggle { top:88px; right:12px; }
  .map-trust-panel { top:126px; right:12px; }
  .scene-local-map .map-radius-readout { bottom:22%; }
  .map-bottom-controls { right:12px; bottom:12px; left:12px; display:block; }
  .map-place-detail { min-width:0; }
  .map-detail-sheet { top:70px; right:10px; width:calc(100% - 20px); }
  .map-detail-sheet { bottom:10px; height:auto; overflow:auto; }
  .map-bottom-controls > label { display:none; }
  .map-level-rail { margin-bottom:8px; }
  .map-place-detail { width:100%; }
  .map-radius-readout { right:5%; bottom:18%; }
  .discover-module { display:grid; grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .discover-copy h1 { font-size:var(--mobile-hero-size); }
  .discover-copy p,.discover-count { display:none; }
  .discover-stage { height:auto; min-height:480px; }
  .discover-card,.discover-next-card,.discover-signal-wash,.discover-stage::before,.discover-stage::after { width:min(72vw,300px); }
  .discover-card-copy h2 { font-size:36px; }
  .discover-actions { bottom:4px; }
  .discover-feedback { top:0; }
  .radio-module,.dashboard-module,.settings-module { display:grid; grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .radio-heading h1,.dashboard-heading h1,.settings-heading h1,.community-manifesto h1 { font-size:var(--mobile-hero-size); line-height:.96; }
  .radio-heading p,.dashboard-heading p,.settings-heading p { display:none; }
  .radio-scope { grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; margin-top:12px; }
  .radio-scope button { min-height:34px; padding:0 5px; font-size:7px; }
  .radio-console { min-height:520px; margin-top:14px; grid-template-rows:auto auto 1fr; }
  .radio-topline { min-height:104px; grid-template-columns:76px minmax(0,1fr) auto; gap:12px; padding:12px; }
  .radio-live-art { width:72px; }
  .radio-live-art > button { width:38px; height:38px; }
  .radio-now strong { font-size:18px; }
  .radio-favorites-toggle { width:38px; padding:0; justify-content:center; }
  .radio-favorites-toggle span { display:none; }
  .radio-filters { grid-template-columns:1fr 1fr; gap:8px; padding:10px 12px; }
  .radio-filters label:nth-child(3) { display:none; }
  .radio-filters select { height:38px; font-size:10px; }
  .radio-results { padding:8px 10px 14px; }
  .radio-results article { grid-template-columns:34px minmax(0,1fr) auto 32px; gap:8px; min-height:56px; }
  .radio-results article i { display:none; }
  .radio-result-play,.radio-favorite { width:32px; height:32px; }
  .radio-results-heading small { display:none; }
  .dashboard-module { overflow:auto; }
  .role-picker { margin-top:16px; }
  .role-picker button { min-width:66px; height:34px; padding:0 9px; font-size:8px; }
  .dashboard-build { margin-top:12px; }
  .dashboard-signal { margin-top:18px; }
  .dashboard-next { grid-template-columns:1fr auto; }
  .dashboard-metrics div { padding:12px 8px; }
  .dashboard-metrics strong { font-size:26px; }
  .dashboard-actions { grid-template-columns:1fr; }
  .settings-board { max-height:none; margin-top:22px; border-radius:20px; overflow:visible; }
  .settings-section { padding:16px; }
  .settings-appearance,.settings-accessibility { grid-template-columns:1fr; }
  .settings-appearance > span,.settings-accessibility > span { grid-column:auto; }
  .settings-accessibility label:nth-of-type(n+2) { border-top:1px solid rgba(243,238,231,.07); }
  .settings-foot { flex-wrap:wrap; padding:14px 16px; }
  .settings-foot span { width:100%; }
  .community-module { display:block; overflow:auto; }
  .community-manifesto p { font-size:12px; }
  .community-board { min-height:470px; margin-top:20px; }
  .community-principles article { min-height:150px; padding:16px; }
  .deck-full-player { display:block; overflow:auto; padding:calc(72px + env(safe-area-inset-top,0px)) calc(20px + env(safe-area-inset-right,0px)) calc(110px + env(safe-area-inset-bottom,0px)) calc(20px + env(safe-area-inset-left,0px)); }
  .full-player-art { width:min(78vw,380px); margin:0 auto 30px; border-radius:24px; }
  .full-player-main h2 { font-size:54px; }
  .full-player-queue { display:block; max-height:none; margin-top:28px; }
}
@media (hover:none) and (pointer:coarse) {
  .module-deck-preview button,.module-deck-preview a,.module-deck-preview input,.module-deck-preview select { -webkit-tap-highlight-color:transparent; }
  .module-deck-preview button,.module-deck-preview a { min-height:44px; }
  .module-deck-preview .real-map-marker { min-height:32px; }
  .deck-player-controls button { min-height:34px; }
  .deck-nav-footer small { display:none; }
}
@media (max-width:480px) {
  .module-deck-preview { --mobile-hero-size:clamp(30px,8.8vw,34px); }
  .deck-search,.deck-search.is-open { width:calc(100vw - 144px); }
  .deck-navigator nav button { grid-template-columns:24px minmax(0,1fr) 14px; column-gap:7px; }
  .deck-navigator nav button > strong { font-size:16px; }
  .deck-module { padding-top:20px; }
  .deck-map-module .deck-module-copy h1,.discover-copy h1,.radio-heading h1,.dashboard-heading h1,.settings-heading h1,.community-manifesto h1 { font-size:var(--mobile-hero-size); }
  .scene-map-frame { min-height:390px; }
  .discover-stage { min-height:440px; }
  .discover-actions { gap:10px; }
  .discover-actions button { min-width:92px; padding:0 15px; }
  .discover-actions button.save { min-width:108px; }
  .discover-action-full { display:none; }
  .discover-action-short { display:inline; }
  .map-detail-sheet { grid-template-columns:70px 1fr; }
  .map-detail-sheet > img { width:70px; height:70px; }
  .real-map-marker > em { display:none; }
  .map-trust-panel { width:calc(100% - 24px); }
  .map-detail-actions { grid-template-columns:1fr 1fr; }
  .map-detail-actions a { display:none; }
  .radio-topline { grid-template-columns:64px minmax(0,1fr) 34px; gap:9px; }
  .radio-live-art { width:62px; }
  .radio-now strong { font-size:15px; }
  .radio-scope button { font-size:6px; }
  .radio-results article b { display:none; }
  .radio-results article { grid-template-columns:32px minmax(0,1fr) 30px; }
  .dashboard-metrics { grid-template-columns:repeat(2,1fr); }
  .dashboard-metrics div:nth-child(3n) { border-right:1px solid var(--deck-line); }
  .dashboard-metrics div:nth-child(2n) { border-right:0; }
  .dashboard-metrics div:nth-last-child(-n+3) { border-bottom:1px solid var(--deck-line); }
  .dashboard-metrics div:nth-last-child(-n+2) { border-bottom:0; }
  .dashboard-recommendations > button { grid-template-columns:minmax(0,1fr) 16px; }
  .dashboard-recommendations i { display:none; }
  .community-subnav { grid-template-columns:1fr 1fr; gap:5px; }
  .community-subnav button { min-height:36px; }
  .community-panel { padding:18px; }
  .community-vote-panel h2 { font-size:28px; }
  .community-vote-tally { grid-template-columns:1fr; gap:8px; }
  .community-vote-actions { display:grid; grid-template-columns:1fr 1fr; }
  .community-principles { grid-template-columns:1fr; }
  .community-principles article { min-height:0; border-right:0; }
  .community-principles article p { display:none; }
  .community-policy-list article { grid-template-columns:1fr; }
  .community-policy-list article > a { grid-column:1; grid-row:auto; margin-top:8px; }
  .full-player-actions { grid-template-columns:1fr; }
}
@media (max-height:560px) and (orientation:landscape) {
  .deck-module { padding-top:16px; padding-bottom:82px; }
  .deck-module h1,.deck-map-module .deck-module-copy h1,.discover-copy h1,.radio-heading h1,.dashboard-heading h1,.settings-heading h1,.community-manifesto h1 { margin:4px 0 8px; font-size:32px; line-height:.96; }
  .deck-map-module { grid-template-columns:.7fr 1.3fr; grid-template-rows:1fr; }
  .deck-map-module .deck-module-copy { display:block; }
  .scene-map-frame { min-height:320px; }
  .deck-player { height:58px; }
  .deck-navigator nav button { min-height:42px; }
}
@media (prefers-reduced-motion:reduce) {
  .module-deck-preview * { scroll-behavior:auto!important; animation:none!important; transition:none!important; }
  .deck-player-marquee-track.is-scrolling { width:100%; }
  .deck-player-marquee-track.is-scrolling .deck-player-marquee-copy:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
  .deck-player-marquee-track.is-scrolling .deck-player-marquee-copy[aria-hidden="true"] { display:none; }
}
.module-deck-preview.reduce-motion * { scroll-behavior:auto!important; animation:none!important; transition:none!important; }
.module-deck-preview.reduce-motion .deck-player-marquee-track.is-scrolling { width:100%; }
.module-deck-preview.reduce-motion .deck-player-marquee-track.is-scrolling .deck-player-marquee-copy:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
.module-deck-preview.reduce-motion .deck-player-marquee-track.is-scrolling .deck-player-marquee-copy[aria-hidden="true"] { display:none; }
`;
