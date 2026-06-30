import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getSceneWrapped, type SceneWrapped } from '@/lib/sceneWrapped';
import { WrappedShareButton } from '@/components/WrappedShareButton';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Scene · iHYPE',
  description: 'Your month in the scene — shows, hypes, and discoveries on iHYPE.',
  openGraph: {
    title: 'My month in the scene',
    description: 'Shows, hypes, and discoveries on iHYPE.',
    siteName: 'iHYPE',
    type: 'website',
    images: [{ url: `/api/og?${new URLSearchParams({ title: 'My Scene', subtitle: 'Shows · hypes · discoveries', type: 'wrapped' }).toString()}`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'My month in the scene', description: 'Shows, hypes, and discoveries on iHYPE.' },
  // Personal page — don't index, but it's still shareable via direct link/OG.
  robots: { index: false, follow: false },
};

function buildShareText(w: SceneWrapped): string {
  const loc = w.city ? ` in ${w.city}` : '';
  const bits = [
    w.showsAttended > 0 ? `${w.showsAttended} show${w.showsAttended === 1 ? '' : 's'}` : null,
    w.hypesGiven > 0 ? `${w.hypesGiven} hypes` : null,
    w.discoveries > 0 ? `${w.discoveries} new artist${w.discoveries === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return `My ${w.monthLabel}${loc} on iHYPE: ${bits.join(' · ') || 'just getting started'}.`;
}

export default async function WrappedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/me/wrapped');
  }

  const w = await getSceneWrapped(session.user.id);
  const shareText = buildShareText(w);

  return (
    <main className="wrapped-page">
      <style>{WRAPPED_CSS}</style>

      <div className="wrapped-card">
        <div className="wrapped-orb wrapped-orb-a" aria-hidden="true" />
        <div className="wrapped-orb wrapped-orb-b" aria-hidden="true" />

        <header className="wrapped-head">
          <span className="wrapped-eyebrow">MY SCENE · {w.monthLabel.toUpperCase()} {w.year}</span>
          <h1 className="wrapped-title">
            {w.city ? <>{w.city}<br />in {w.monthLabel}</> : <>Your {w.monthLabel}<br />in the scene</>}
          </h1>
        </header>

        {w.isEmpty ? (
          <div className="wrapped-empty">
            <p>Your scene is quiet so far this month.</p>
            <p className="wrapped-empty-sub">Hype an artist or RSVP a show — your card fills in as you go.</p>
            <Link href="/discover" className="wrapped-cta">Discover artists</Link>
          </div>
        ) : (
          <>
            <div className="wrapped-grid">
              <Stat value={w.showsAttended} label="Shows" color="#22e5d4" />
              <Stat value={w.hypesGiven} label="Hypes given" color="#ff5029" />
              <Stat value={w.discoveries} label="New artists" color="#b983ff" />
              <Stat value={w.streak} label="Day streak" color="#ff3e9a" />
            </div>

            <div className="wrapped-highlights">
              {w.topArtist && <Highlight label="Most played" value={w.topArtist} />}
              {w.topVenue && <Highlight label="Top venue" value={w.topVenue} />}
              {w.topGenre && <Highlight label="Your sound" value={w.topGenre} />}
            </div>
          </>
        )}

        <footer className="wrapped-foot">
          <span className="wrapped-foot-brand">iHYPE</span>
          <span className="wrapped-foot-meta">0% fees · 45/45/10</span>
        </footer>
      </div>

      <div className="wrapped-actions">
        <WrappedShareButton shareText={shareText} monthLabel={w.monthLabel} />
        <Link href="/home" className="wrapped-back">Back to workbench</Link>
      </div>
    </main>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="wrapped-stat">
      <div className="wrapped-stat-value" style={{ color }}>{value}</div>
      <div className="wrapped-stat-label">{label}</div>
    </div>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="wrapped-hl">
      <span className="wrapped-hl-label">{label}</span>
      <span className="wrapped-hl-value">{value}</span>
    </div>
  );
}

const WRAPPED_CSS = `
.wrapped-page {
  min-height: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: 20px; padding: 32px 16px 64px;
}
.wrapped-card {
  position: relative; overflow: hidden;
  width: 100%; max-width: 420px;
  background: #100d09;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 28px;
  padding: 32px 28px;
  box-shadow: 0 0 80px rgba(185,131,255,0.10);
}
.wrapped-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(8px); }
.wrapped-orb-a { top: -90px; right: -70px; width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(255,80,41,0.22) 0%, transparent 70%); }
.wrapped-orb-b { bottom: -80px; left: -60px; width: 220px; height: 220px;
  background: radial-gradient(circle, rgba(185,131,255,0.20) 0%, transparent 70%); }
.wrapped-head { position: relative; margin-bottom: 28px; }
.wrapped-eyebrow {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 0.16em; color: rgba(240,235,229,0.5);
}
.wrapped-title {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: 38px; line-height: 0.98; letter-spacing: -0.03em;
  color: #f0ebe5; margin: 10px 0 0;
}
.wrapped-grid {
  position: relative; display: grid; grid-template-columns: 1fr 1fr;
  gap: 12px; margin-bottom: 20px;
}
.wrapped-stat {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 18px 16px;
}
.wrapped-stat-value {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: 40px; line-height: 1; letter-spacing: -0.03em;
}
.wrapped-stat-label {
  font-family: 'DM Sans', sans-serif; font-size: 13px;
  color: rgba(240,235,229,0.55); margin-top: 6px;
}
.wrapped-highlights { position: relative; display: flex; flex-direction: column; gap: 8px; }
.wrapped-hl {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
}
.wrapped-hl-label {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase; color: rgba(240,235,229,0.45);
}
.wrapped-hl-value {
  font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
  color: #f0ebe5; max-width: 60%; text-align: right;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wrapped-empty { position: relative; text-align: center; padding: 24px 8px 8px; }
.wrapped-empty p { font-family: 'DM Sans', sans-serif; color: #f0ebe5; font-size: 16px; margin: 0 0 6px; }
.wrapped-empty-sub { color: rgba(240,235,229,0.5) !important; font-size: 14px !important; }
.wrapped-cta, .wrapped-share-btn {
  display: inline-block; margin-top: 16px;
  font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
  padding: 12px 22px; border-radius: 9999px; border: none; cursor: pointer;
  background: linear-gradient(135deg, #ff5029, #ff3e6e); color: #fff;
  text-decoration: none;
}
.wrapped-foot {
  position: relative; display: flex; align-items: center; justify-content: space-between;
  margin-top: 26px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06);
}
.wrapped-foot-brand { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 16px; color: #f0ebe5; letter-spacing: -0.03em; }
.wrapped-foot-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: rgba(240,235,229,0.4); }
.wrapped-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.wrapped-back { font-family: 'DM Sans', sans-serif; font-size: 14px; color: rgba(240,235,229,0.55); text-decoration: none; }
.wrapped-back:hover { color: #f0ebe5; }
`;
