import { NextResponse } from 'next/server';
import type { ActivityMapPoint } from '@/lib/activity-stats';
import { buildActivityMapPoints } from '@/lib/activity-stats';
import { getHomePageData } from '@/lib/public-data';
import { detectRequestLocation } from '@/lib/request-location';

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function getDistanceScore(point: ActivityMapPoint, latitude: number, longitude: number) {
  const latitudeDelta = point.latitude - latitude;
  const longitudeDelta = point.longitude - longitude;
  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
}

function findFocusPoint(points: ActivityMapPoint[], viewerLocation: Awaited<ReturnType<typeof detectRequestLocation>>) {
  if (!viewerLocation) {
    return null;
  }

  if (viewerLocation.postalCode) {
    const directPostalMatch = points.find((point) => point.postalCode === viewerLocation.postalCode);
    if (directPostalMatch) {
      return directPostalMatch;
    }
  }

  if (viewerLocation.city) {
    const cityMatch = points.find((point) => normalize(point.city) === normalize(viewerLocation.city));
    if (cityMatch) {
      return cityMatch;
    }
  }

  if (viewerLocation.latitude == null || viewerLocation.longitude == null) {
    return null;
  }

  return points.reduce<ActivityMapPoint | null>((closestPoint, point) => {
    if (!closestPoint) {
      return point;
    }

    return getDistanceScore(point, viewerLocation.latitude!, viewerLocation.longitude!) <
      getDistanceScore(closestPoint, viewerLocation.latitude!, viewerLocation.longitude!)
      ? point
      : closestPoint;
  }, null);
}

export async function GET() {
  const [viewerLocation, homePageData] = await Promise.all([detectRequestLocation(), getHomePageData()]);
  const points = buildActivityMapPoints({
    profiles: homePageData.profiles,
    shows: homePageData.rankedShows
  });
  const focusPoint = findFocusPoint(points, viewerLocation);

  return NextResponse.json(
    { pointId: focusPoint?.id ?? null },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0'
      }
    }
  );
}
