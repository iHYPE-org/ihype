import Link from 'next/link';
import { getStationState } from '@/lib/radioStation';
import { AlwaysOnStation } from '@/components/AlwaysOnStation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'iHYPE Station — Always On',
  description: 'The always-on iHYPE auto-DJ. Free-use tracks from independent artists, playing around the clock. Audio only.',
};

export default async function StationPage() {
  const state = await getStationState();

  return (
    <main className="station-page">
      <style>{STATION_PAGE_CSS}</style>
      <header className="station-page-head">
        <span className="station-page-eyebrow">IHYPE RADIO</span>
        <h1 className="station-page-title">The station never stops.</h1>
        <p className="station-page-sub">
          A round-the-clock auto-DJ spinning free-use tracks from independent artists — everyone&apos;s
          tuned to the same moment. When a DJ goes live, you&apos;ll hear them here first.
        </p>
      </header>

      <AlwaysOnStation initial={state} />

      <p className="station-page-foot">
        Want your tracks in rotation? <Link href="/pages">Set up your page</Link> and enable free-use.
      </p>
    </main>
  );
}

const STATION_PAGE_CSS = `
.station-page { max-width: 560px; margin: 0 auto; padding: 40px 16px 64px; }
.station-page-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: #ff5029; }
.station-page-title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: #f0ebe5; margin: 10px 0 12px; }
.station-page-sub { font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.6; color: rgba(240,235,229,0.6); max-width: 52ch; margin: 0 0 28px; }
.station-page-foot { font-family: 'DM Sans', sans-serif; font-size: 13px; color: rgba(240,235,229,0.45); margin-top: 24px; }
.station-page-foot a { color: #ff5029; }
`;
