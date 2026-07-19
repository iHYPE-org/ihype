'use client';

import { useState } from 'react';
import Link from 'next/link';

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface Props {
  profileId: string;
  slug: string;
  initialName: string;
  initialCity: string;
  initialCapacity: number | null;
  initialRoomType: string;
  initialVerificationStatus: VerificationStatus;
}

const ROOM_TYPES = ['', 'Standing room', 'Seated', 'Mixed', 'Outdoor'];

const STEP_LABELS = ['Basics', 'Room details', 'Booking prefs', 'Verify'];

export default function VenueOnboardingWizard({
  profileId,
  slug,
  initialName,
  initialCity,
  initialCapacity,
  initialRoomType,
  initialVerificationStatus,
}: Props) {
  // If verification already went through before onboarding was (re)opened,
  // land straight on the done screen instead of re-litigating steps 0-3.
  const alreadyVerifiedOrPending = initialVerificationStatus === 'PENDING' || initialVerificationStatus === 'VERIFIED';

  const [step, setStep] = useState(alreadyVerifiedOrPending ? 4 : 0);
  const [name, setName] = useState(initialName || '');
  const [city, setCity] = useState(initialCity || '');
  const [capacity, setCapacity] = useState(initialCapacity ? String(initialCapacity) : '');
  const [roomType, setRoomType] = useState(initialRoomType || '');

  const [savingBasics, setSavingBasics] = useState(false);
  const [basicsError, setBasicsError] = useState<string | null>(null);

  const [savingRoom, setSavingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(initialVerificationStatus === 'PENDING' || initialVerificationStatus === 'VERIFIED');

  const noBasics = !name.trim() || !city.trim();
  const noCapacity = !capacity || Number(capacity) <= 0;

  async function saveBasics() {
    if (noBasics || savingBasics) return;
    setSavingBasics(true);
    setBasicsError(null);
    try {
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, name: name.trim(), city: city.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBasicsError(json.error || 'Could not save — try again.');
        return;
      }
      setStep(1);
    } catch {
      setBasicsError('Network error — try again.');
    } finally {
      setSavingBasics(false);
    }
  }

  async function saveRoomDetails() {
    if (noCapacity || savingRoom) return;
    setSavingRoom(true);
    setRoomError(null);
    try {
      const res = await fetch('/api/profile-editor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, capacity: Number(capacity), roomType: roomType || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRoomError(json.error || 'Could not save — try again.');
        return;
      }
      setStep(2);
    } catch {
      setRoomError('Network error — try again.');
    } finally {
      setSavingRoom(false);
    }
  }

  async function submitForReview() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.set('profileId', profileId);
      formData.set('name', name.trim() || initialName);
      formData.set('city', city.trim() || initialCity);
      // Venues don't have genres — deliberately omitted, /api/verify doesn't require it.

      const res = await fetch('/api/verify', { method: 'POST', body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || 'Could not submit — try again.');
        return;
      }
      setSubmitted(true);
      setStep(4);
    } catch {
      setSubmitError('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pct = [20, 40, 60, 80, 100][step];
  const capacityOrDefault = capacity || '300';
  const nameOrVenue = name.trim() || 'your venue';

  return (
    <div className="von-page">
      <div className="von-eyebrow">Step {Math.min(step + 1, 4)} of 4 · Venue setup</div>
      <div className="von-progress">
        <div className="von-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {step === 0 && (
        <div className="von-step">
          <h1 className="von-title">Set up your venue.</h1>
          <p className="von-sub">This becomes your public venue page. Keep 20% of every ticket — locked in the charter.</p>

          <label className="von-label" htmlFor="von-name">Venue name</label>
          <input
            id="von-name"
            className="von-input"
            placeholder="e.g. The Fillmore"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="von-label" htmlFor="von-city">City</label>
          <input
            id="von-city"
            className="von-input"
            placeholder="e.g. San Francisco, CA"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          {basicsError && <div className="von-error">{basicsError}</div>}

          <button className="von-btn von-btn-solid" disabled={noBasics || savingBasics} onClick={saveBasics}>
            {savingBasics ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="von-step">
          <h1 className="von-title">Room details.</h1>
          <p className="von-sub">Helps artists and fans know what to expect.</p>

          <label className="von-label" htmlFor="von-capacity">Capacity</label>
          <input
            id="von-capacity"
            className="von-input"
            type="number"
            min={1}
            placeholder="e.g. 300"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />

          <label className="von-label" htmlFor="von-room-type">Room type</label>
          <select
            id="von-room-type"
            className="von-input von-select"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
          >
            {ROOM_TYPES.map((opt) => (
              <option key={opt} value={opt}>{opt || 'Select a room type'}</option>
            ))}
          </select>

          {roomError && <div className="von-error">{roomError}</div>}

          <button className="von-btn von-btn-solid" disabled={noCapacity || savingRoom} onClick={saveRoomDetails}>
            {savingRoom ? 'Saving…' : 'Continue →'}
          </button>
          <button className="von-btn von-btn-outline" onClick={() => setStep(0)}>Back</button>
        </div>
      )}

      {step === 2 && (
        <div className="von-step">
          <h1 className="von-title">Booking preferences.</h1>
          <p className="von-sub">You&rsquo;ll see matching artists in your demand radar and booking inbox.</p>

          <div className="von-card">
            <div className="von-card-label">If it sells out ({capacityOrDefault} cap · $18)</div>
            <div className="von-split-bar">
              <div className="von-split-artist" />
              <div className="von-split-venue" />
              <div className="von-split-promoter" />
            </div>
            <div className="von-split-legend">
              70% artist · <span className="von-split-venue-text">20% your venue</span> · 10% promoters · 0% iHYPE
            </div>
          </div>

          <div className="von-sublabel">Booking inbox</div>
          <div className="von-empty">
            <div className="von-empty-text">
              No booking requests yet. Once verified, matching artists start showing up here and in your demand radar.
            </div>
          </div>

          <button className="von-btn von-btn-solid" onClick={() => setStep(3)}>Continue →</button>
          <button className="von-btn von-btn-outline" onClick={() => setStep(1)}>Back</button>
        </div>
      )}

      {step === 3 && (
        <div className="von-step">
          <h1 className="von-title">Verify your venue.</h1>
          <p className="von-sub">
            Venue accounts require verification — protects everyone in the 70/20/10 ecosystem. Reviewed within 48 hours.
          </p>

          <div className="von-card">
            <div className="von-card-label von-card-label-accent">What counts as proof</div>
            <div className="von-proof-text">
              Business license or permits for the venue · Official venue website or Google Maps listing · A recent event poster or booking invoice
            </div>
          </div>

          {submitError && <div className="von-error">{submitError}</div>}

          <button className="von-btn von-btn-solid" disabled={submitting} onClick={submitForReview}>
            {submitting ? 'Submitting…' : 'Submit for review →'}
          </button>
          <button className="von-btn von-btn-outline" disabled={submitting} onClick={() => setStep(2)}>Back</button>
        </div>
      )}

      {step === 4 && (
        <div className="von-step von-step-done">
          <div className="von-done-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22e5d4" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="von-title">{submitted ? 'Submitted.' : 'Almost there.'}</h1>
          <p className="von-sub von-sub-center">
            {submitted
              ? `We'll review ${nameOrVenue} within 48 hours and email you. You can start browsing the demand radar meanwhile.`
              : `Submit ${nameOrVenue} for review to finish setup.`}
          </p>
          {submitted && <div className="von-badge">Verified Venue · Pending</div>}
          <Link className="von-btn von-btn-solid von-btn-link" href={`/venues/${slug}/dashboard`}>
            Explore demand radar →
          </Link>
        </div>
      )}

      <style>{`
        .von-page { font-family: var(--font-body, 'DM Sans', sans-serif); color: var(--ink); background: var(--bg2); min-height: 100vh; max-width: 480px; margin: 0 auto; padding: 48px 24px 60px; }
        .von-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 10px; }
        .von-progress { width: 100%; height: 10px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden; }
        .von-progress-fill { height: 100%; background: #22e5d4; border-radius: var(--radius-pill); transition: width .2s ease; }
        .von-step { margin-top: 28px; }
        .von-step-done { text-align: center; }
        .von-title { font-family: var(--font-display); font-weight: 800; font-size: 27px; letter-spacing: -.03em; margin: 0 0 8px; }
        .von-sub { font-size: 14px; color: var(--ink-a55); line-height: 1.65; margin: 0 0 24px; }
        .von-sub-center { max-width: 34ch; margin-left: auto; margin-right: auto; }
        .von-label { display: block; font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a50); margin: 0 0 6px; }
        .von-input { width: 100%; box-sizing: border-box; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line-2); background: var(--bg3, rgba(255,255,255,.03)); color: var(--ink); font-size: 15px; margin-bottom: 14px; }
        .von-select { appearance: auto; }
        .von-error { color: var(--accent); font-size: 13px; margin: -6px 0 14px; }
        .von-btn { display: flex; align-items: center; justify-content: center; width: 100%; text-decoration: none; padding: 12px 20px; border-radius: var(--radius-md); font-size: 14px; font-weight: 700; min-height: 44px; border: none; cursor: pointer; margin-top: 20px; box-sizing: border-box; }
        .von-btn:disabled { opacity: .5; cursor: not-allowed; }
        .von-btn-solid { background: #22e5d4; color: #08211f; }
        .von-btn-outline { background: transparent; color: var(--ink-a55); border: 1px solid var(--line-2); margin-top: 8px; }
        .von-btn-link { margin-top: 24px; }
        .von-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg3, rgba(255,255,255,.03)); padding: 20px; margin-top: 12px; }
        .von-card-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 10px; }
        .von-card-label-accent { color: #22e5d4; }
        .von-split-bar { display: flex; height: 8px; border-radius: var(--radius-pill); overflow: hidden; gap: 2px; margin-bottom: 10px; }
        .von-split-artist { flex: 70; background: var(--accent); }
        .von-split-venue { flex: 20; background: #22e5d4; }
        .von-split-promoter { flex: 10; background: #b983ff; }
        .von-split-legend { font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-a50); }
        .von-split-venue-text { color: #22e5d4; }
        .von-proof-text { font-size: 13.5px; color: var(--ink-a55); line-height: 1.8; }
        .von-sublabel { margin-top: 20px; margin-bottom: 4px; font-family: var(--font-mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .von-empty { border: 1.5px dashed var(--line-2); border-radius: var(--radius-lg); padding: 26px 20px; text-align: center; }
        .von-empty-text { font-size: 13px; color: var(--ink-a55); line-height: 1.5; }
        .von-done-icon { width: 56px; height: 56px; border-radius: var(--radius-md); display: grid; place-items: center; margin: 0 auto 16px; background: rgba(34,229,212,.12); border: 2px solid #22e5d4; }
        .von-badge { display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em; padding: 5px 14px; border-radius: var(--radius-pill); background: rgba(34,229,212,.15); color: #22e5d4; margin-bottom: 8px; }
      `}</style>
    </div>
  );
}
