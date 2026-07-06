import { NextResponse } from 'next/server';

/**
 * iOS Universal Links association file. Served with no file extension, at
 * exactly this path, over HTTPS with no redirect — iOS fetches this once
 * per install (and periodically) and caches it, so it can open ihype.org
 * links directly in the app instead of Safari.
 *
 * Inert (empty `details`) until APPLE_TEAM_ID is set — an app ID needs a
 * real Apple Developer Program Team ID, which doesn't exist yet (see
 * DESIGN_SYNC.md row 111). Once it does: set APPLE_TEAM_ID, add the
 * "Associated Domains" capability (applinks:ihype.org) to the iOS target in
 * Xcode — that capability requires a provisioning profile, so it can't be
 * added by hand-editing the Xcode project file safely from here.
 */
export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = 'com.ihype.app';

  const body = {
    applinks: {
      apps: [],
      details: teamId
        ? [
            {
              appID: `${teamId}.${bundleId}`,
              paths: ['/shows/*', '/artists/*', '/venues/*', '/promoters/*', '/fans/*', '/radio', '/h/*']
            }
          ]
        : []
    }
  };

  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/json' }
  });
}
