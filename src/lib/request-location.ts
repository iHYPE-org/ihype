import { headers } from 'next/headers';

export type RequestLocation = {
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'edge-headers' | 'ipapi' | 'unknown';
};

type IpApiResponse = {
  city?: string;
  region?: string;
  region_code?: string;
  country_name?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  error?: boolean;
};

function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseCoordinate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasLocationValue(location: RequestLocation) {
  return Boolean(
    location.city ||
      location.stateRegion ||
      location.country ||
      location.postalCode ||
      location.latitude != null ||
      location.longitude != null
  );
}

function isPrivateIpv4(ip: string) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

function isPublicIp(ip: string) {
  return Boolean(ip) && !isPrivateIpv4(ip) && !isPrivateIpv6(ip);
}

function extractIpValue(rawValue?: string | null) {
  if (!rawValue) {
    return null;
  }

  const candidate = rawValue
    .split(',')
    .map((value) => value.trim())
    .find(Boolean);

  if (!candidate) {
    return null;
  }

  if (candidate.includes(':') && candidate.includes('.')) {
    const match = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    return match?.[1] ?? null;
  }

  return candidate.replace(/^\[|\]$/g, '');
}

async function lookupIpApiLocation(ipAddress: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as IpApiResponse;
    if (data.error) {
      return null;
    }

    const location: RequestLocation = {
      city: cleanValue(data.city),
      stateRegion: cleanValue(data.region_code || data.region),
      country: cleanValue(data.country_name),
      postalCode: cleanValue(data.postal),
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      source: 'ipapi'
    };

    return hasLocationValue(location) ? location : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildEdgeLocation(requestHeaders: Headers): RequestLocation {
  return {
    city: cleanValue(requestHeaders.get('cf-ipcity')),
    stateRegion: cleanValue(requestHeaders.get('cf-ipcountry-region')),
    country: cleanValue(requestHeaders.get('cf-ipcountry')),
    postalCode: cleanValue(requestHeaders.get('cf-postal-code')),
    latitude: parseCoordinate(requestHeaders.get('cf-iplatitude')),
    longitude: parseCoordinate(requestHeaders.get('cf-iplongitude')),
    source: 'edge-headers'
  };
}

export async function detectLocationFromHeaders(requestHeaders: Headers): Promise<RequestLocation | null> {
  const edgeLocation = buildEdgeLocation(requestHeaders);

  const ipAddress = [
    requestHeaders.get('cf-connecting-ip'),
    requestHeaders.get('x-real-ip'),
    requestHeaders.get('x-forwarded-for')
  ]
    .map((value) => extractIpValue(value))
    .find((value) => (value ? isPublicIp(value) : false));

  if (ipAddress) {
    const ipLocation = await lookupIpApiLocation(ipAddress);
    if (ipLocation) {
      return {
        city: edgeLocation.city ?? ipLocation.city,
        stateRegion: edgeLocation.stateRegion ?? ipLocation.stateRegion,
        country: edgeLocation.country ?? ipLocation.country,
        postalCode: edgeLocation.postalCode ?? ipLocation.postalCode,
        latitude: edgeLocation.latitude ?? ipLocation.latitude,
        longitude: edgeLocation.longitude ?? ipLocation.longitude,
        source: edgeLocation.postalCode ? 'edge-headers' : ipLocation.source
      };
    }
  }

  return hasLocationValue(edgeLocation) ? edgeLocation : null;
}

export async function detectRequestLocation(): Promise<RequestLocation | null> {
  const requestHeaders = await headers();
  return detectLocationFromHeaders(new Headers(requestHeaders));
}
