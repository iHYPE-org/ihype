import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Charter · iHYPE',
  description: 'iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales.',
};

export default function CharterPage() {
  return (
    <div className="charter-wrap">
      <Link href="/legal" className="charter-back">← Legal</Link>
      <div className="charter-label">The iHYPE Charter</div>
      <h1 className="charter-h1">We take nothing.</h1>
      <p className="charter-sub">
        iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. Not a policy. A constraint. Changing it would require dissolving the company.
      </p>

      <div className="charter-split-bar">
        <div style={{ flex: 45, background: 'var(--accent)' }} />
        <div style={{ flex: 45, background: 'var(--role-venue)' }} />
        <div style={{ flex: 10, background: 'var(--role-fan)' }} />
      </div>

      <p className="charter-split-display">
        <span className="charter-accent">45%</span> artist ·{' '}
        <span className="charter-venue">45%</span> venue ·{' '}
        <span className="charter-fan">10%</span> promoters ·{' '}
        0% iHYPE.
      </p>

      <div className="charter-callout">
        <p>This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around.</p>
      </div>

      <h2 className="charter-h2">Why lock it in?</h2>
      <p className="charter-p">Because every platform that started with good intentions eventually faced a board meeting where fees made sense. We wanted to make that conversation impossible. The charter is the answer to &quot;what if the company needs revenue?&quot; — the answer is: find another way. Not this.</p>

      <h2 className="charter-h2">What &quot;locked in&quot; means</h2>
      <p className="charter-p">The 45/45/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it.</p>

      <h2 className="charter-h2">How iHYPE makes money</h2>
      <p className="charter-p">iHYPE earns revenue through optional creator tools, promoted discovery placement, and radio show distribution — none of which touch the ticket split. The split is untouchable. Everything else is fair game.</p>

      <h2 className="charter-h2">Promoters and the 10%</h2>
      <p className="charter-p">The 10% promoter pool is distributed to everyone who shared a referral link that contributed to ticket sales for an event. Fans, DJs, artists — anyone can be a promoter. The split is calculated per-event at settlement.</p>

      <hr className="charter-hr" />

      <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', lineHeight: 1.7 }}>
        Questions about the charter: <a href="mailto:admin@ihype.org" style={{ color: 'var(--ink-2)' }}>admin@ihype.org</a><br />
        iHYPE Inc. · Founded Portland, ME · 2026 · <a href="https://ihype.org" style={{ color: 'var(--ink-2)' }}>ihype.org</a>
      </p>

      <style>{`
        .charter-wrap { max-width: 640px; margin: 0 auto; padding: 80px 32px 100px; }
        .charter-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .65rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); }
        .charter-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 2.8rem; letter-spacing: -.04em; line-height: 1.0; margin: 16px 0 8px; color: var(--ink); }
        .charter-sub { font-size: 1rem; color: var(--ink-2); line-height: 1.7; margin-bottom: 3rem; }
        .charter-split-display { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: 1.8rem; letter-spacing: -.03em; color: var(--ink); line-height: 1.2; margin: 1.5rem 0; }
        .charter-accent { color: var(--accent); }
        .charter-venue { color: var(--role-venue); }
        .charter-fan { color: var(--role-fan); }
        .charter-split-bar { display: flex; height: 8px; border-radius: var(--radius-pill, 9999px); overflow: hidden; margin: 1.5rem 0 2.5rem; gap: 3px; }
        .charter-split-bar div { border-radius: var(--radius-pill, 9999px); }
        .charter-h2 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 700; font-size: 1.1rem; letter-spacing: -.02em; color: var(--ink); margin: 2.5rem 0 .7rem; }
        .charter-p { font-size: .95rem; color: var(--ink-2); line-height: 1.8; margin-bottom: 1rem; }
        .charter-callout { background: rgba(255,80,41,.06); border: 1px solid rgba(255,80,41,.15); border-radius: 12px; padding: 20px 24px; margin: 2rem 0; }
        .charter-callout p { margin: 0; color: var(--ink); }
        .charter-hr { border: none; border-top: 1px solid var(--line); margin: 2.5rem 0; }
        .charter-back { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 2rem; }
        .charter-back:hover { color: var(--ink-2); }
      `}</style>
    </div>
  );
}
