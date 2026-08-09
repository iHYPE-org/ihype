import Link from 'next/link';
import { getStationState } from '@/lib/radioStation';
import { AlwaysOnStation } from '@/components/AlwaysOnStation';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'iHYPE Station — Always On',
  description: 'The always-on iHYPE auto-DJ. Free-use tracks from independent artists, playing around the clock. Audio only.',
};

export default async function StationPage() {
  const state = await getStationState();
  const t = await getServerT();

  return (
    <div className="station-page">
      <style>{STATION_PAGE_CSS}</style>
      <header className="station-page-head">
        <span className="station-page-eyebrow">{t('radioStationPage.eyebrow', 'IHYPE RADIO')}</span>
        <h1 className="station-page-title">{t('radioStationPage.title', 'The station never stops.')}</h1>
        <p className="station-page-sub">
          {t('radioStationPage.subtitle', "A round-the-clock auto-DJ spinning free-use tracks from independent artists — everyone's tuned to the same moment. When a DJ goes live, you'll hear them here first.")}
        </p>
      </header>

      <AlwaysOnStation initial={state} />

      <p className="station-page-foot">
        {t('radioStationPage.footPrefix', 'Want your tracks in rotation?')} <Link href="/pages">{t('radioStationPage.footLink', 'Set up your page')}</Link> {t('radioStationPage.footSuffix', 'and enable free-use.')}
      </p>
    </div>
  );
}

const STATION_PAGE_CSS = `
.station-page { max-width: 560px; margin: 0 auto; padding: 40px 16px 64px; }
.station-page-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--accent); }
.station-page-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.0; letter-spacing: -0.03em; color: var(--ink); margin: 10px 0 12px; }
.station-page-sub { font-family: 'Work Sans', sans-serif; font-size: 15px; line-height: 1.6; color: var(--ink-a60); max-width: 52ch; margin: 0 0 28px; }
.station-page-foot { font-family: 'Work Sans', sans-serif; font-size: 13px; color: var(--ink-a45); margin-top: 24px; }
.station-page-foot a { color: var(--accent); }
`;
