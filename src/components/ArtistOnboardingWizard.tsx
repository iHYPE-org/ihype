'use client';

import Link from 'next/link';
import { useState } from 'react';

type Step = 0 | 1 | 2 | 3;

const PROGRESS: Record<Step, number> = { 0: 25, 1: 50, 2: 75, 3: 100 };

export function ArtistOnboardingWizard({
  profileId,
  slug,
  initialName,
  initialGenre,
}: {
  profileId: string;
  slug: string;
  initialName: string;
  initialGenre: string;
}) {
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(initialName);
  const [genre, setGenre] = useState(initialGenre);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  async function goStep1() {
    if (!name.trim() || !genre.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const [profileRes, genreRes] = await Promise.all([
        fetch('/api/profile-editor', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, name: name.trim() }),
        }),
        fetch('/api/profile/genre', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, genre: genre.trim().slice(0, 50) }),
        }),
      ]);

      if (!profileRes.ok) {
        const d = await profileRes.json().catch(() => ({}));
        setSaveError(d.error ?? 'Failed to save your page. Please try again.');
        return;
      }
      if (!genreRes.ok) {
        const d = await genreRes.json().catch(() => ({}));
        setSaveError(d.error ?? 'Failed to save your genre. Please try again.');
        return;
      }
      setStep(1);
    } catch {
      setSaveError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  function goStep2() {
    setStep(2);
  }

  async function connectStripe() {
    if (payoutBusy) return;
    setPayoutBusy(true);
    setPayoutError(null);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayoutError(data.error ?? 'Could not start payouts setup. Please try again.');
        setPayoutBusy(false);
        return;
      }
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
        return;
      }
      setPayoutError('Stripe did not return an onboarding link. Please try again.');
      setPayoutBusy(false);
    } catch {
      setPayoutError('Network error — try again.');
      setPayoutBusy(false);
    }
  }

  function skipPayouts() {
    setStep(3);
  }

  return (
    <div className="aow-page">
      <div className="aow-card">
        <div className="aow-progress-track">
          <div className="aow-progress-fill" style={{ width: `${PROGRESS[step]}%` }} />
        </div>

        {step === 0 && (
          <div>
            <div className="aow-eyebrow">Step 1 of 3</div>
            <h1 className="aow-title">Set up your page.</h1>
            <p className="aow-sub">This becomes your public artist page — fans find you here.</p>

            <label className="aow-field">
              <span className="aow-label">Stage name</span>
              <input
                className="aow-input"
                onChange={(e) => setName(e.target.value)}
                placeholder="Midnight Echo"
                type="text"
                value={name}
              />
            </label>
            <label className="aow-field">
              <span className="aow-label">Genre</span>
              <input
                className="aow-input"
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Deep House"
                type="text"
                value={genre}
              />
            </label>

            {saveError && <div className="aow-error">{saveError}</div>}

            <button
              className="aow-btn aow-btn-solid"
              disabled={!name.trim() || !genre.trim() || saving}
              onClick={goStep1}
              type="button"
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
            <div className="aow-alt-link">
              or <Link href="/pages?tab=creator">build it with the AI Page Creator →</Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="aow-eyebrow">Step 2 of 3</div>
            <h1 className="aow-title">List your first event.</h1>
            <p className="aow-sub">Optional — you can always add this later from Event Creator.</p>

            <div className="aow-reminder-card">
              <div className="aow-reminder-label">Reminder</div>
              <div className="aow-reminder-text">
                Every ticket splits 70% to you, 20% venue, 10% promoters. iHYPE takes $0 — locked in our charter.
              </div>
            </div>

            <Link className="aow-btn aow-btn-solid" href="/events/new">
              Create an event →
            </Link>
            <button className="aow-btn aow-btn-ghost" onClick={goStep2} type="button">
              Skip for now
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="aow-eyebrow">Step 3 of 3</div>
            <h1 className="aow-title">Connect payouts.</h1>
            <p className="aow-sub">
              Your 70% share pays out automatically after each show, via Stripe Connect.
            </p>

            {payoutError && <div className="aow-error">{payoutError}</div>}

            <button
              className="aow-btn aow-btn-solid"
              disabled={payoutBusy}
              onClick={connectStripe}
              type="button"
            >
              {payoutBusy ? 'Connecting…' : 'Connect with Stripe →'}
            </button>
            <button className="aow-btn aow-btn-ghost" disabled={payoutBusy} onClick={skipPayouts} type="button">
              I&rsquo;ll do this later
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="aow-done">
            <div className="aow-done-icon">
              <svg fill="none" height="28" stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="28">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <h1 className="aow-title" style={{ textAlign: 'center' }}>You&rsquo;re set up.</h1>
            <p className="aow-sub" style={{ textAlign: 'center', maxWidth: '34ch', margin: '8px auto 24px' }}>
              Your page is live. Fans can find you, hype your tracks, and buy tickets to your shows.
            </p>
            <Link className="aow-btn aow-btn-solid" href={`/artists/${slug}/dashboard`}>
              Go to my page →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .aow-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 60px 24px; }
        .aow-card { width: 100%; max-width: 440px; border: 1px solid var(--line); border-radius: var(--radius-2xl); background: var(--bg2); padding: 22px 18px 18px; }
        .aow-progress-track { width: 100%; height: 10px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden; margin-bottom: 28px; }
        .aow-progress-fill { height: 100%; border-radius: var(--radius-pill); background: var(--accent); transition: width .25s ease; }
        .aow-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
        .aow-title { font-family: var(--font-display); font-weight: 800; font-size: 26px; letter-spacing: -.03em; margin: 0 0 8px; color: var(--ink); }
        .aow-sub { font-size: 14px; color: var(--ink-a50, var(--ink-2)); line-height: 1.65; margin: 0 0 24px; }
        .aow-field { display: block; margin-bottom: 14px; }
        .aow-label { display: block; font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a50, var(--ink-2)); margin-bottom: 6px; }
        .aow-input { box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line-2); background: var(--bg3, transparent); color: var(--ink); font-size: 14px; font-family: inherit; }
        .aow-input:focus { outline: none; border-color: var(--accent); }
        .aow-btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 10px 20px; border-radius: var(--radius-md); font-size: 14px; font-weight: 700; text-decoration: none; border: none; cursor: pointer; box-sizing: border-box; margin-top: 20px; }
        .aow-btn:disabled { opacity: .55; cursor: default; }
        .aow-btn-solid { background: var(--accent); color: #fff; }
        .aow-btn-ghost { background: transparent; color: var(--ink-a50, var(--ink-2)); margin-top: 8px; }
        .aow-btn-ghost:hover { color: var(--ink); }
        .aow-alt-link { text-align: center; margin-top: 14px; font-size: 12px; color: var(--ink-a35, var(--ink-3)); }
        .aow-alt-link a { color: var(--accent); text-decoration: none; }
        .aow-error { font-size: 12.5px; color: var(--accent); margin-bottom: 4px; }
        .aow-reminder-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg3, transparent); padding: 20px; }
        .aow-reminder-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a35, var(--ink-3)); margin-bottom: 10px; }
        .aow-reminder-text { font-family: var(--font-mono); font-size: 12px; color: var(--ink-a50, var(--ink-2)); line-height: 1.6; }
        .aow-done { text-align: center; }
        .aow-done-icon { width: 60px; height: 60px; border-radius: var(--radius-lg); background: rgba(255,80,41,.12); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
      `}</style>
    </div>
  );
}
