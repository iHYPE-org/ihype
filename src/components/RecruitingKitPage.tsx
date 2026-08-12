import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';

type Stat = { value: string; label: string };
type Feature = { emoji: string; title: string; body: string };
type CityHeat = { label: string; score: number };

export type RecruitingKitConfig = {
  role: 'ARTIST' | 'VENUE' | 'FAN';
  tint: string;
  glow: string;
  navCta: string;
  eyebrow: string;
  headline: React.ReactNode;
  heroBody: React.ReactNode;
  applyHeading: string;
  applySub: string;
  applyCta: string;
  applyFinePrint: string;
  stats: Stat[];
  heatLabel: string;
  quote: React.ReactNode;
  checklist: string[];
  featuresEyebrow: string;
  featuresHeadline: string;
  features: Feature[];
  fanFitBody?: React.ReactNode;
};

const HEAT_COLOR = ['var(--heat-fire)', 'var(--heat-hot)', 'var(--heat-warm)', 'var(--heat-cold)'];

/**
 * Shared shell for the 4 recruiting/kit pages (Artist/DJ/Venue/Fan) —
 * DESIGN_SYNC rows 240-243, resolved into real routes once the route +
 * account-creation decision was made. The "Apply"/"Join" CTA links straight
 * into the real, already-fully-wired `/register?role=X` flow (invite gate,
 * magic link, passkey, Turnstile — all real) rather than re-implementing
 * registration here; the design's own inline name/email/genre/city capture
 * form is dropped since none of that data has anywhere real to land before
 * an account exists, and /register + the post-signup onboarding wizard
 * already collect it for real.
 */
export async function RecruitingKitPage({ config, cityHeat }: { config: RecruitingKitConfig; cityHeat: CityHeat[] }) {
  const t = await getServerT();
  const maxScore = Math.max(...cityHeat.map((c) => c.score), 1);

  return (
    <div className="rk-page" style={{ ['--rk-tint' as string]: config.tint, ['--rk-glow' as string]: config.glow }}>
      <nav className="rk-nav">
        <div className="rk-nav-inner">
          <Link className="rk-logo" href="/">iHYPE</Link>
          <Link className="rk-nav-cta" href={`/register?role=${config.role}`}>
            {config.navCta}
          </Link>
        </div>
      </nav>

      <header className="rk-hero">
        <div className="rk-hero-glow" aria-hidden="true" />
        <div className="rk-hero-inner">
          <div className="rk-hero-copy">
            <div className="rk-eyebrow">{config.eyebrow}</div>
            <h1 className="rk-h1">{config.headline}</h1>
            <p className="rk-hero-body">{config.heroBody}</p>
          </div>
          <div className="rk-apply-card">
            <h2 className="rk-apply-heading">{config.applyHeading}</h2>
            <p className="rk-apply-sub">{config.applySub}</p>
            <Link className="rk-apply-btn" href={`/register?role=${config.role}`}>{config.applyCta}</Link>
            <p className="rk-fineprint">{config.applyFinePrint}</p>
          </div>
        </div>

        <div className="rk-stats-wrap">
          <div className="rk-stats">
            {config.stats.map((s) => (
              <div className="rk-stat" key={s.label}>
                <div className="rk-stat-val">{s.value}</div>
                <div className="rk-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {cityHeat.length > 0 && (
            <div className="rk-heat">
              <div className="rk-heat-label">{config.heatLabel}</div>
              <div className="rk-heat-rows">
                {cityHeat.map((c, i) => (
                  <div className="rk-heat-row" key={c.label}>
                    <span className="rk-heat-city">{c.label}</span>
                    <div className="rk-heat-track" role="img" aria-label={`${c.label}: ${c.score.toLocaleString()} ${t('recruitingKitPage.hypes', 'hypes')}`}>
                      <div
                        className="rk-heat-bar"
                        style={{ width: `${Math.max(20, Math.round((c.score / maxScore) * 100))}%`, background: HEAT_COLOR[Math.min(i, HEAT_COLOR.length - 1)] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <section className="rk-charter">
        <div className="rk-charter-inner">
          <div className="rk-quote">{config.quote}</div>
          <ul className="rk-checklist">
            {config.checklist.map((item) => (
              <li key={item}><span className="rk-check">✓</span><span>{item}</span></li>
            ))}
          </ul>
        </div>
        {config.fanFitBody && <p className="rk-fanfit">{config.fanFitBody}</p>}
      </section>

      <section className="rk-features">
        <div className="rk-features-inner">
          <div className="rk-features-eyebrow">{config.featuresEyebrow}</div>
          <h2 className="rk-features-h2">{config.featuresHeadline}</h2>
          <div className="rk-feature-grid">
            {config.features.map((f) => (
              <div className="rk-feature" key={f.title}>
                <div className="rk-feature-emoji">{f.emoji}</div>
                <h3 className="rk-feature-title">{f.title}</h3>
                <p className="rk-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="rk-footer">
        <div className="rk-footer-inner">
          <Link className="rk-logo" href="/">iHYPE</Link>
          <div className="rk-footer-links">
            <Link href="/advertise">{t('recruitingKitPage.footerAdvertise', 'Advertise')}</Link>
            <Link href="/info">{t('recruitingKitPage.footerInfo', 'Info')}</Link>
            <Link href="/support">{t('recruitingKitPage.footerSupport', 'Support')}</Link>
          </div>
        </div>
      </footer>

      <style>{`
        .rk-page { background: radial-gradient(1100px 560px at 50% -12%, color-mix(in srgb, var(--rk-glow) 9%, transparent), transparent 62%), var(--bg); color: var(--ink); }
        .rk-nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(16px); background: color-mix(in srgb, var(--bg) 75%, transparent); border-bottom: 1px solid var(--line); }
        .rk-nav-inner { max-width: 1080px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; height: 62px; }
        .rk-logo { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; letter-spacing: -.04em; color: var(--accent); text-decoration: none; }
        .rk-nav-cta { font-family: var(--font-display); font-weight: 800; font-size: .88rem; background: var(--rk-tint); color: var(--bg); padding: 9px 18px; border-radius: 999px; text-decoration: none; }
        .rk-hero { padding: 100px 0 80px; position: relative; overflow: hidden; }
        .rk-hero-glow { position: absolute; top: -160px; right: -80px; width: 600px; height: 600px; background: radial-gradient(circle, color-mix(in srgb, var(--rk-glow) 20%, transparent), transparent 65%); pointer-events: none; }
        /* minmax(0, …), not 1fr: a bare 1fr floors at MIN-CONTENT, so one long
           unbreakable token — a venue name, a URL — pushes this column past its
           share and scrolls the page sideways above the breakpoint below. */
        .rk-hero-inner { max-width: 1080px; margin: 0 auto; padding: 0 32px; display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 60px; align-items: center; position: relative; }
        .rk-eyebrow { font-family: var(--font-mono); font-size: .7rem; letter-spacing: .2em; text-transform: uppercase; color: var(--rk-tint); margin-bottom: 22px; }
        .rk-h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(2.8rem, 5.5vw, 4.6rem); letter-spacing: -.04em; line-height: .98; }
        .rk-hero-body { font-size: 1.15rem; line-height: 1.6; color: var(--ink-a70); margin-top: 22px; max-width: 48ch; }
        .rk-hero-body strong { color: var(--ink); }
        .rk-apply-card { background: linear-gradient(160deg, var(--bg2), var(--bg)); border: 1px solid color-mix(in srgb, var(--rk-glow) 20%, transparent); border-radius: 22px; padding: 36px 32px; }
        .rk-apply-heading { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; letter-spacing: -.02em; margin-bottom: 10px; }
        .rk-apply-sub { font-size: .92rem; color: var(--ink-a70); line-height: 1.6; margin-bottom: 22px; }
        .rk-apply-btn { display: block; width: 100%; box-sizing: border-box; text-align: center; padding: 14px; border-radius: 12px; background: var(--rk-tint); color: var(--bg); font-family: var(--font-display); font-weight: 800; font-size: 1rem; text-decoration: none; }
        .rk-fineprint { font-family: var(--font-mono); font-size: .68rem; color: var(--ink-a45); margin-top: 12px; text-align: center; letter-spacing: .04em; }
        .rk-stats-wrap { max-width: 1080px; margin: 64px auto 0; padding: 0 32px; }
        .rk-stats { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; }
        .rk-stat { flex: 1; min-width: 90px; padding: 24px 0; text-align: center; border-right: 1px solid var(--line); }
        .rk-stat:last-child { border-right: none; }
        .rk-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 2.2rem; letter-spacing: -.03em; color: var(--rk-tint); }
        .rk-stat-label { font-family: var(--font-mono); font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a55); margin-top: 6px; }
        .rk-heat { padding: 28px 0; border-bottom: 1px solid var(--line); }
        .rk-heat-label { font-family: var(--font-mono); font-size: .62rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a45); margin-bottom: 14px; }
        .rk-heat-rows { display: flex; flex-direction: column; gap: 9px; max-width: 420px; }
        .rk-heat-row { display: flex; align-items: center; gap: 10px; }
        .rk-heat-city { width: 96px; flex-shrink: 0; font-size: .82rem; color: var(--ink-a70); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rk-heat-track { flex: 1; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
        .rk-heat-bar { height: 100%; border-radius: 3px; }
        .rk-charter { background: color-mix(in srgb, var(--rk-glow) 3%, transparent); border-top: 1px solid color-mix(in srgb, var(--rk-glow) 8%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--rk-glow) 8%, transparent); padding: 80px 0; }
        .rk-charter-inner { max-width: 1080px; margin: 0 auto; padding: 0 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .rk-quote { font-family: var(--font-serif, 'Instrument Serif', serif); font-style: italic; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1.12; }
        .rk-quote span { color: var(--rk-tint); }
        .rk-checklist { list-style: none; display: flex; flex-direction: column; gap: 14px; padding: 0; margin: 0; }
        .rk-checklist li { display: flex; align-items: flex-start; gap: 12px; font-size: .96rem; line-height: 1.5; }
        .rk-check { color: var(--rk-tint); font-family: var(--font-display); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
        .rk-fanfit { max-width: 1080px; margin: 40px auto 0; padding: 0 32px; text-align: center; font-size: 1rem; color: var(--ink-a70); line-height: 1.6; }
        .rk-fanfit a { color: var(--rk-tint); text-decoration: underline; }
        .rk-features { padding: 88px 0; }
        .rk-features-inner { max-width: 1080px; margin: 0 auto; padding: 0 32px; }
        .rk-features-eyebrow { font-family: var(--font-mono); font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--rk-tint); }
        .rk-features-h2 { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -.03em; line-height: 1.06; margin: 14px 0 0; }
        .rk-feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 44px; }
        .rk-feature { background: var(--bg2); border: 1px solid var(--line); border-radius: 16px; padding: 26px 22px; }
        .rk-feature-emoji { font-size: 1.8rem; margin-bottom: 14px; }
        .rk-feature-title { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; letter-spacing: -.01em; margin-bottom: 8px; }
        .rk-feature-body { font-size: .92rem; line-height: 1.55; color: var(--ink-a70); margin: 0; }
        .rk-footer { border-top: 1px solid var(--line); padding: 44px 0 56px; }
        .rk-footer-inner { max-width: 1080px; margin: 0 auto; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .rk-footer-links { display: flex; gap: 22px; }
        .rk-footer-links a { font-size: .9rem; color: var(--ink-a70); text-decoration: none; }
        @media (max-width: 860px) {
          .rk-hero-inner { grid-template-columns: 1fr; }
          .rk-charter-inner { grid-template-columns: 1fr; }
          .rk-feature-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .rk-feature-grid { grid-template-columns: 1fr; }
          .rk-stat-val { font-size: 1.6rem; }
        }
      `}</style>
    </div>
  );
}
