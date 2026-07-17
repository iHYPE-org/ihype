import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal, SplitBar } from '@/components/CharterAnimated';

export const metadata: Metadata = {
  title: 'The Charter · iHYPE',
  description: 'iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales.',
};

export default function CharterPage() {
  return (
    <div className="charter-wrap">
      <div className="charter-glow" aria-hidden="true" />
      <Link href="/legal" className="charter-back">← Legal</Link>
      <div className="charter-label">The iHYPE Charter</div>
      <h1 className="charter-h1">We take<br /><span className="charter-shimmer">nothing.</span></h1>
      <Reveal delayMs={200}>
        <p className="charter-sub">
          iHYPE was incorporated with a single non-negotiable structural commitment: the platform takes nothing from ticket sales. Not a policy. A constraint. Changing it would require dissolving the company.
        </p>
      </Reveal>

      <Reveal delayMs={350}>
        <SplitBar />
      </Reveal>

      <Reveal>
        <div className="charter-callout">
          <p>This is not a pricing strategy. It is a constraint. We built the business model around it, not the other way around.</p>
        </div>
      </Reveal>

      <Reveal>
        <h2 className="charter-h2"><span className="charter-dot charter-dot-pulse" style={{ background: 'var(--accent)' }} />Why lock it in?</h2>
        <p className="charter-p">Because every platform that started with good intentions eventually faced a board meeting where fees made sense. We wanted to make that conversation impossible. The charter is the answer to &quot;what if the company needs revenue?&quot; — the answer is: find another way. Not this.</p>
      </Reveal>

      <Reveal>
        <h2 className="charter-h2"><span className="charter-dot" style={{ background: 'var(--role-venue)' }} />What &quot;locked in&quot; means</h2>
        <p className="charter-p">The 70/20/10 split is a condition of incorporation. Changing it would require dissolving the company and re-incorporating under a different structure. No board vote, no shareholder approval, no acquisition clause overrides it.</p>
      </Reveal>

      <Reveal>
        <h2 className="charter-h2"><span className="charter-dot" style={{ background: 'var(--role-promoter)' }} />How iHYPE makes money</h2>
        <p className="charter-p">iHYPE is funded entirely by advertising, the same way terrestrial radio has always worked — and those ads are restricted to music-related sources only, forever. None of it touches the ticket split. Tickets are processed directly through Stripe; the card-processing fee (2.9% + $0.30; AMEX 3.5% + $0.30) is the only charge above face value, passed through at cost.</p>
      </Reveal>

      <Reveal>
        <h2 className="charter-h2"><span className="charter-dot" style={{ background: 'var(--role-fan)' }} />Promoters and the 10%</h2>
        <p className="charter-p">The 10% promoter pool is distributed to everyone who shared a referral link that contributed to ticket sales for an event. Fans, DJs, artists — anyone can be a promoter. The split is calculated per-event at settlement.</p>
      </Reveal>

      <hr className="charter-hr" />

      <Reveal>
        <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', lineHeight: 1.7 }}>
          Questions about the charter: <a href="mailto:admin@ihype.org" style={{ color: 'var(--ink-2)' }}>admin@ihype.org</a><br />
          iHYPE Inc. · Founded Portland, ME · 2026 · <a href="https://ihype.org" style={{ color: 'var(--ink-2)' }}>ihype.org</a>
        </p>
      </Reveal>

      <style>{`
        @keyframes charterGlow { 0%, 100% { opacity: .5; transform: translateX(-50%) scale(1); } 50% { opacity: 1; transform: translateX(-50%) scale(1.12); } }
        @keyframes charterShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes charterPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,80,41,.35); } 50% { box-shadow: 0 0 0 14px rgba(255,80,41,0); } }
        .charter-wrap { max-width: 680px; margin: 0 auto; padding: 90px 32px 120px; position: relative; }
        .charter-glow { position: fixed; top: -250px; left: 50%; transform: translateX(-50%); width: 800px; height: 600px; background: radial-gradient(circle, rgba(255,80,41,.13), transparent 60%); pointer-events: none; animation: charterGlow 6s ease-in-out infinite; z-index: -1; }
        .charter-label { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .65rem; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-3); position: relative; }
        .charter-h1 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: clamp(3rem, 9vw, 5.4rem); letter-spacing: -.045em; line-height: .95; margin: 20px 0 14px; color: var(--ink); position: relative; }
        .charter-shimmer { background: linear-gradient(110deg, var(--accent) 30%, var(--accent-2) 50%, var(--accent) 70%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: charterShimmer 4s linear infinite; }
        .charter-sub { font-size: 1.08rem; color: var(--ink-2); line-height: 1.7; margin-bottom: 3.5rem; }
        .charter-split-display { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 800; font-size: clamp(1.5rem, 4vw, 2rem); letter-spacing: -.03em; color: var(--ink); line-height: 1.25; margin: 0 0 3.5rem; }
        .charter-accent { color: var(--accent); }
        .charter-venue { color: var(--role-venue); }
        .charter-fan { color: var(--role-fan); }
        .charter-split-bar { display: flex; height: 14px; border-radius: var(--radius-pill, 9999px); overflow: hidden; margin: 0 0 26px; gap: 4px; }
        .charter-split-bar div { border-radius: var(--radius-pill, 9999px); }
        .charter-h2 { font-family: var(--f-d, 'Syne', sans-serif); font-weight: 700; font-size: 1.2rem; letter-spacing: -.02em; color: var(--ink); margin: 0 0 12px; display: flex; align-items: center; gap: 10px; }
        .charter-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .charter-dot-pulse { animation: charterPulse 2.4s infinite; }
        .charter-p { font-size: .98rem; color: var(--ink-2); line-height: 1.8; margin-bottom: 2.5rem; }
        .charter-callout { background: rgba(255,80,41,.06); border: 1px solid rgba(255,80,41,.15); border-radius: 16px; padding: 24px 28px; margin: 0 0 3.25rem; }
        .charter-callout p { margin: 0; color: var(--ink); font-family: var(--f-s, 'Instrument Serif', serif); font-style: italic; font-size: 1.25rem; line-height: 1.55; }
        .charter-hr { border: none; border-top: 1px solid var(--line); margin: 2.5rem 0; }
        .charter-back { font-family: var(--f-m, 'JetBrains Mono', monospace); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 2rem; }
        .charter-back:hover { color: var(--ink-2); }
      `}</style>
    </div>
  );
}
