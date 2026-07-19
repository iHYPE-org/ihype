'use client';

import { useState } from 'react';
import Link from 'next/link';

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface Props {
  profileId: string;
  slug: string;
  initialName: string;
  initialCity: string;
  initialGenre: string;
  initialLink: string;
  initialVerificationStatus: VerificationStatus;
}

const GENRE_OPTIONS = ['', 'Deep House', 'Tech House', 'Techno', 'Electronic', 'Indie', 'Ambient'];
const STEP_LABELS = ['Basics', 'Sound', 'Radio schedule', 'Verify'];

export function DJOnboardingWizard({
  profileId,
  slug,
  initialName,
  initialCity,
  initialGenre,
  initialLink,
  initialVerificationStatus,
}: Props) {
  // Already verified/pending DJs land straight on a status screen instead of
  // re-running a wizard whose steps 1/2 would just re-save the same fields.
  const [step, setStep] = useState(initialVerificationStatus === 'PENDING' || initialVerificationStatus === 'VERIFIED' ? 4 : 0);
  const [name, setName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [genre, setGenre] = useState(initialGenre);
  const [link, setLink] = useState(initialLink);
  // Radio-schedule preference (Weekly / Occasional) is a real, selectable UI
  // choice per the approved design — but there is no schema field for it
  // anywhere on Profile, and nothing else in the app reads a DJ's
  // schedule-frequency preference. This is a deliberate no-op: it advances
  // local wizard state only and is never sent to any API.
  const [schedule, setSchedule] = useState<'weekly' | 'occasional'>('occasional');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'submitted' | 'already' | 'error'>(
    initialVerificationStatus === 'PENDING' ? 'submitted' : initialVerificationStatus === 'VERIFIED' ? 'already' : 'idle'
  );

  const noBasics = !name.trim() || !city.trim();

  async function saveBasics() {
    if (noBasics) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, name: name.trim(), city: city.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save — try again.');
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSound() {
    setSaving(true);
    setError(null);
    try {
      // profile-editor-schema.ts has no `genre`/`genres` field — Profile.genres
      // is only ever written by POST /api/verify (step 4 below). So this step
      // only persists the link here; genre is carried in local state and sent
      // along with the verification submission.
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, links: link.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save — try again.');
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function submitVerification() {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('profileId', profileId);
      form.set('name', name.trim());
      form.set('city', city.trim());
      if (genre) form.set('genres', genre);
      if (link.trim()) form.set('link', link.trim());
      const res = await fetch('/api/verify', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitState('error');
        setError(body.error || 'Submission failed — try again.');
        return;
      }
      setSubmitState('submitted');
      setStep(4);
    } catch {
      setSubmitState('error');
      setError('Submission failed — try again.');
    } finally {
      setSaving(false);
    }
  }

  const pct = [20, 40, 60, 80, 100][Math.min(step, 3)];

  return (
    <div className="djo-page">
      {step < 4 && (
        <>
          <div className="djo-eyebrow">Step {step + 1} of 4 · DJ setup</div>
          <div className="djo-progress-track">
            <div className="djo-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {error && step < 4 && <div className="djo-error">{error}</div>}

      {step === 0 && (
        <div className="djo-step">
          <div className="djo-h1">Set up your DJ page.</div>
          <p className="djo-sub">Host radio shows, build a crate, and earn promoter cuts on every ticket you drive.</p>
          <label className="djo-field">
            <span className="djo-label">DJ / stage name</span>
            <input className="djo-input" onChange={(e) => setName(e.target.value)} placeholder="e.g. Nyla Park" value={name} />
          </label>
          <label className="djo-field">
            <span className="djo-label">City</span>
            <input className="djo-input" onChange={(e) => setCity(e.target.value)} placeholder="e.g. San Francisco, CA" value={city} />
          </label>
          <div className="djo-actions">
            <button className="djo-btn djo-btn-solid" disabled={noBasics || saving} onClick={saveBasics}>
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="djo-step">
          <div className="djo-h1">Your sound.</div>
          <p className="djo-sub">Helps fans and other DJs find you. You can add tracks to your crate later.</p>
          <label className="djo-field">
            <span className="djo-label">Primary genre</span>
            <select className="djo-input" onChange={(e) => setGenre(e.target.value)} value={genre}>
              {GENRE_OPTIONS.map((g) => (
                <option key={g || 'none'} value={g}>{g || 'Select a genre'}</option>
              ))}
            </select>
          </label>
          <label className="djo-field">
            <span className="djo-label">SoundCloud, Mixcloud, or website</span>
            <input className="djo-input" onChange={(e) => setLink(e.target.value)} placeholder="https://" value={link} />
          </label>
          <div className="djo-crate-label">Your crate</div>
          <div className="djo-crate-empty">
            <svg fill="none" height="26" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="26">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <div>Your crate is empty. Add tracks once your page is verified — you can upload or pull cleared free-use samples.</div>
          </div>
          <div className="djo-actions">
            <button className="djo-btn djo-btn-solid" disabled={saving} onClick={saveSound}>{saving ? 'Saving…' : 'Continue →'}</button>
            <button className="djo-btn djo-btn-outline" disabled={saving} onClick={() => setStep(0)}>Back</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="djo-step">
          <div className="djo-h1">Radio schedule.</div>
          <p className="djo-sub">How often do you want to host live radio shows? You can change this anytime.</p>
          {(['weekly', 'occasional'] as const).map((opt) => (
            <div
              className={`djo-choice ${schedule === opt ? 'djo-choice-on' : ''}`}
              key={opt}
              onClick={() => setSchedule(opt)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSchedule(opt); } }}
              role="button"
              tabIndex={0}
            >
              <div className="djo-choice-dot" />
              <div>
                <div className="djo-choice-title">{schedule === opt ? '✓ ' : ''}{opt === 'weekly' ? 'Weekly' : 'Occasional'}</div>
                <div className="djo-choice-sub">{opt === 'weekly' ? 'One regular slot, every week' : 'Whenever it fits, no fixed slot'}</div>
              </div>
            </div>
          ))}
          <div className="djo-actions">
            {/* Deliberate no-op: this preference has no backing schema field and
                nothing in the app reads it — Continue only advances local state. */}
            <button className="djo-btn djo-btn-solid" onClick={() => setStep(3)}>Continue →</button>
            <button className="djo-btn djo-btn-outline" onClick={() => setStep(1)}>Back</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="djo-step">
          <div className="djo-h1">Verify your DJ page.</div>
          <p className="djo-sub">DJ accounts require verification — protects everyone in the 70/20/10 ecosystem. Reviewed within 48 hours.</p>
          <div className="djo-card">
            <div className="djo-card-eyebrow">What counts as proof</div>
            <div className="djo-card-body">A SoundCloud or Mixcloud profile with at least one public mix &middot; A past event poster or booking confirmation &middot; Social media profile showing DJ work</div>
          </div>
          <div className="djo-actions">
            <button className="djo-btn djo-btn-solid" disabled={saving} onClick={submitVerification}>
              {saving ? 'Submitting…' : 'Submit for review →'}
            </button>
            <button className="djo-btn djo-btn-outline" disabled={saving} onClick={() => setStep(2)}>Back</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="djo-step djo-done">
          {submitState === 'error' ? (
            <>
              <div className="djo-icon djo-icon-err">!</div>
              <div className="djo-h1">Submission failed.</div>
              <p className="djo-sub">{error || 'Something went wrong submitting for review.'}</p>
              <button className="djo-btn djo-btn-solid" onClick={() => setStep(3)}>Try again</button>
            </>
          ) : submitState === 'already' ? (
            <>
              <div className="djo-icon">
                <svg fill="none" height="26" stroke="#22e5d4" strokeLinecap="round" strokeWidth="2.5" viewBox="0 0 24 24" width="26"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="djo-h1">Already verified.</div>
              <p className="djo-sub">{name || 'Your page'} is already a verified DJ page.</p>
              <Link className="djo-btn djo-btn-solid" href={`/promoters/${slug}/dashboard`}>Go to dashboard →</Link>
            </>
          ) : (
            <>
              <div className="djo-icon">
                <svg fill="none" height="26" stroke="#22e5d4" strokeLinecap="round" strokeWidth="2.5" viewBox="0 0 24 24" width="26"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="djo-h1">Submitted.</div>
              <p className="djo-sub">We&rsquo;ll review {name || 'your page'} within 48 hours and email you. You can start building your crate meanwhile.</p>
              <div className="djo-badge">Verified DJ · Pending</div>
              <Link className="djo-btn djo-btn-solid" href={`/promoters/${slug}/dashboard`}>Build your crate →</Link>
            </>
          )}
        </div>
      )}

      <style>{`
        .djo-page { font-family: var(--font-body, 'DM Sans', sans-serif); color: var(--ink); max-width: 480px; margin: 0 auto; padding: 48px 24px 60px; }
        .djo-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 10px; }
        .djo-progress-track { height: 6px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden; }
        .djo-progress-fill { height: 100%; border-radius: var(--radius-pill); background: var(--accent-2, #ff3e9a); transition: width 200ms ease; }
        .djo-error { margin-top: 16px; padding: 12px 14px; border-radius: var(--radius-md); background: rgba(255,80,41,.1); border: 1px solid rgba(255,80,41,.3); color: var(--ink); font-size: 13px; }
        .djo-step { margin-top: 28px; }
        .djo-h1 { font-family: var(--font-display); font-weight: 800; font-size: 27px; letter-spacing: -.03em; margin-bottom: 8px; }
        .djo-sub { font-size: 14px; color: var(--ink-a55); line-height: 1.65; margin: 0 0 24px; }
        .djo-field { display: block; margin-bottom: 14px; }
        .djo-label { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .djo-input { width: 100%; box-sizing: border-box; min-height: 44px; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line-2); background: var(--bg2); color: var(--ink); font-size: 14px; font-family: inherit; }
        .djo-crate-label { margin-top: 20px; margin-bottom: 4px; font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .djo-crate-empty { border: 1.5px dashed var(--line-2); border-radius: var(--radius-lg); padding: 26px 20px; text-align: center; color: var(--ink-a55); }
        .djo-crate-empty svg { margin-bottom: 8px; color: var(--ink-a50); }
        .djo-crate-empty div { font-size: 13px; line-height: 1.5; }
        .djo-choice { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: var(--radius-md); cursor: pointer; margin-bottom: 8px; border: 1px solid var(--line-2); transition: background 150ms; }
        .djo-choice:hover { background: var(--bg3); }
        .djo-choice-on { border-color: var(--accent-2, #ff3e9a); background: rgba(255,62,154,.1); }
        .djo-choice-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-2, #ff3e9a); flex-shrink: 0; }
        .djo-choice-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; }
        .djo-choice-sub { font-size: 12px; color: var(--ink-a55); }
        .djo-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 20px; }
        .djo-card-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-2, #ff3e9a); margin-bottom: 10px; }
        .djo-card-body { font-size: 13.5px; color: var(--ink-a55); line-height: 1.8; }
        .djo-actions { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
        .djo-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; width: 100%; box-sizing: border-box; padding: 10px 20px; border-radius: var(--radius-md); font-size: 14px; font-weight: 700; min-height: 44px; border: none; cursor: pointer; font-family: inherit; }
        .djo-btn:disabled { opacity: .6; cursor: not-allowed; }
        .djo-btn-solid { background: var(--accent-2, #ff3e9a); color: #fff; }
        .djo-btn-outline { background: transparent; color: var(--ink-a55); border: 1px solid var(--line-2); }
        .djo-done { text-align: center; }
        .djo-icon { width: 56px; height: 56px; border-radius: var(--radius-lg); display: grid; place-items: center; margin: 0 auto 16px; background: rgba(34,229,212,.12); border: 2px solid #22e5d4; }
        .djo-icon-err { background: rgba(255,80,41,.12); border: 2px solid var(--accent); color: var(--accent); font-family: var(--font-display); font-weight: 800; font-size: 22px; }
        .djo-badge { display: inline-flex; margin: 0 auto 24px; padding: 4px 12px; border-radius: var(--radius-pill); font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; background: rgba(255,62,154,.12); color: var(--accent-2, #ff3e9a); }
      `}</style>
    </div>
  );
}
