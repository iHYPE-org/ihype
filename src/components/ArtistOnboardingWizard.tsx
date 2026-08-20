'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { useMarkOnboarded } from '@/lib/use-mark-onboarded';

// Step 2 is verification. Artists previously had no such step at all, while
// the DJ and venue wizards both did — an artist claimed a stage name and the
// account was live against it, which for a platform whose whole proposition
// is paying the right person 70% is the wrong asymmetry.
type Step = 0 | 1 | 2 | 3 | 4;

const PROGRESS: Record<Step, number> = { 0: 20, 1: 40, 2: 60, 3: 80, 4: 100 };

export function ArtistOnboardingWizard({
  profileId,
  slug,
  initialName,
  initialGenre,
  initialLink,
  initialVerificationStatus,
}: {
  profileId: string;
  slug: string;
  initialName: string;
  initialGenre: string;
  initialLink: string;
  initialVerificationStatus: string;
}) {
  const { t } = useI18n();
  const alreadyVerified = initialVerificationStatus === 'VERIFIED';
  const [step, setStep] = useState<Step>(0);
  const [proofLink, setProofLink] = useState(initialLink);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySubmitted, setVerifySubmitted] = useState(
    initialVerificationStatus === 'PENDING' || alreadyVerified,
  );
  const [name, setName] = useState(initialName);
  const [genre, setGenre] = useState(initialGenre);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Step 4 is the done screen, reached either by connecting payouts or by the
  // explicit Skip. Both count: skipping an optional step is still finishing.
  useMarkOnboarded(profileId, step === 4);

  async function submitVerification() {
    if (verifySubmitting) return;
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const form = new FormData();
      form.set('profileId', profileId);
      form.set('name', name.trim());
      if (genre.trim()) form.set('genres', genre.trim());
      if (proofLink.trim()) form.set('link', proofLink.trim());
      if (proofFile) form.set('file', proofFile);

      const res = await fetch('/api/verify', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(body.error ?? t('artistOnboardingWizard.verifyFailed', 'Submission failed — try again.'));
        return;
      }
      setVerifySubmitted(true);
      setStep(3);
    } catch {
      setVerifyError(t('artistOnboardingWizard.networkError', 'Network error — try again.'));
    } finally {
      setVerifySubmitting(false);
    }
  }

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
        setSaveError(d.error ?? t('artistOnboardingWizard.saveProfileFailed', 'Failed to save your page. Please try again.'));
        return;
      }
      if (!genreRes.ok) {
        const d = await genreRes.json().catch(() => ({}));
        setSaveError(d.error ?? t('artistOnboardingWizard.saveGenreFailed', 'Failed to save your genre. Please try again.'));
        return;
      }
      setStep(1);
    } catch {
      setSaveError(t('artistOnboardingWizard.networkError', 'Network error — try again.'));
    } finally {
      setSaving(false);
    }
  }

  function goVerify() {
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
        setPayoutError(data.error ?? t('artistOnboardingWizard.payoutStartFailed', 'Could not start payouts setup. Please try again.'));
        setPayoutBusy(false);
        return;
      }
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
        return;
      }
      setPayoutError(t('artistOnboardingWizard.payoutNoLink', 'Stripe did not return an onboarding link. Please try again.'));
      setPayoutBusy(false);
    } catch {
      setPayoutError(t('artistOnboardingWizard.networkError', 'Network error — try again.'));
      setPayoutBusy(false);
    }
  }

  function skipPayouts() {
    setStep(4);
  }

  return (
    <div className="aow-page">
      <div className="aow-card">
        <div className="aow-progress-track">
          <div className="aow-progress-fill" style={{ width: `${PROGRESS[step]}%` }} />
        </div>

        {step === 0 && (
          <div>
            <div className="aow-eyebrow">{t('artistOnboardingWizard.step1Eyebrow', 'Step 1 of 4')}</div>
            <h1 className="aow-title">{t('artistOnboardingWizard.step1Title', 'Set up your page.')}</h1>
            <p className="aow-sub">{t('artistOnboardingWizard.step1Sub', 'This becomes your public artist page — fans find you here.')}</p>

            <label className="aow-field">
              <span className="aow-label">{t('artistOnboardingWizard.stageNameLabel', 'Stage name')}</span>
              <input
                className="aow-input"
                onChange={(e) => setName(e.target.value)}
                placeholder={t('artistOnboardingWizard.stageNamePlaceholder', 'Midnight Echo')}
                type="text"
                value={name}
              />
            </label>
            <label className="aow-field">
              <span className="aow-label">{t('artistOnboardingWizard.genreLabel', 'Genre')}</span>
              <input
                className="aow-input"
                onChange={(e) => setGenre(e.target.value)}
                placeholder={t('artistOnboardingWizard.genrePlaceholder', 'Deep House')}
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
              {saving ? t('artistOnboardingWizard.saving', 'Saving…') : t('artistOnboardingWizard.continue', 'Continue →')}
            </button>
            <div className="aow-alt-link">
              {t('artistOnboardingWizard.orPrefix', 'or')} <Link href="/pages?tab=creator">{t('artistOnboardingWizard.aiPageCreator', 'build it in the Page Creator →')}</Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="aow-eyebrow">{t('artistOnboardingWizard.step2Eyebrow', 'Step 2 of 4')}</div>
            <h1 className="aow-title">{t('artistOnboardingWizard.step2Title', 'List your first event.')}</h1>
            <p className="aow-sub">{t('artistOnboardingWizard.step2Sub', 'Optional — you can always add this later from Event Creator.')}</p>

            <div className="aow-reminder-card">
              <div className="aow-reminder-label">{t('artistOnboardingWizard.reminderLabel', 'Reminder')}</div>
              <div className="aow-reminder-text">
                {t('artistOnboardingWizard.reminderText', 'Every ticket splits 70% to you, 20% venue, 10% promoters. iHYPE takes $0 — locked in our charter.')}
              </div>
            </div>

            <Link className="aow-btn aow-btn-solid" href="/events/new">
              {t('artistOnboardingWizard.createEvent', 'Create an event →')}
            </Link>
            <button className="aow-btn aow-btn-ghost" onClick={goVerify} type="button">
              {t('artistOnboardingWizard.skipForNow', 'Skip for now')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="aow-eyebrow">{t('artistOnboardingWizard.step3Eyebrow', 'Step 3 of 4')}</div>
            <h1 className="aow-title">{t('artistOnboardingWizard.verifyTitle', 'Verify your identity.')}</h1>
            <p className="aow-sub">
              {t('artistOnboardingWizard.verifySub', 'Artist accounts are verified before payouts are released — 70% of a ticket has to reach the person who actually played. Reviewed within 48 hours.')}
            </p>

            <div className="aow-reminder-card" style={{ marginBottom: 18 }}>
              <div className="aow-reminder-label">{t('artistOnboardingWizard.proofLabel', 'What counts as proof')}</div>
              <div className="aow-reminder-text">
                {t('artistOnboardingWizard.proofText', 'A Spotify, Bandcamp or SoundCloud profile with at least one published track · A screenshot of a past booking or contract · A social profile showing your music')}
              </div>
            </div>

            <label className="aow-field">
              <span className="aow-label">{t('artistOnboardingWizard.proofLinkLabel', 'Website, Bandcamp, or SoundCloud')}</span>
              <input
                className="aow-input"
                inputMode="url"
                onChange={(e) => setProofLink(e.target.value)}
                placeholder="https://"
                value={proofLink}
              />
            </label>

            <label className="aow-field">
              <span className="aow-label">{t('artistOnboardingWizard.proofFileLabel', 'Or attach a document (JPEG, PNG or PDF, max 8 MB)')}</span>
              <input
                accept="image/jpeg,image/png,application/pdf"
                className="aow-input"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                type="file"
              />
            </label>

            <p className="aow-alt-link" style={{ textAlign: 'left', marginTop: 0 }}>
              {t('artistOnboardingWizard.proofHint', 'One of the two is enough — whichever shows the music is yours.')}
            </p>

            {verifyError && <p className="aow-error">{verifyError}</p>}

            {verifySubmitted ? (
              <>
                <p className="aow-sub" style={{ marginBottom: 0 }}>
                  {alreadyVerified
                    ? t('artistOnboardingWizard.verifyAlready', 'This page is already verified.')
                    : t('artistOnboardingWizard.verifyPending', 'Submitted — a human is reviewing it. You can carry on setting up meanwhile.')}
                </p>
                <button className="aow-btn aow-btn-solid" onClick={() => setStep(3)} type="button">
                  {t('artistOnboardingWizard.continue', 'Continue →')}
                </button>
              </>
            ) : (
              <button
                className="aow-btn aow-btn-solid"
                disabled={verifySubmitting || (!proofFile && !proofLink.trim())}
                onClick={submitVerification}
                type="button"
              >
                {verifySubmitting
                  ? t('artistOnboardingWizard.submitting', 'Submitting…')
                  : t('artistOnboardingWizard.submitForReview', 'Submit for review →')}
              </button>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="aow-eyebrow">{t('artistOnboardingWizard.step4Eyebrow', 'Step 4 of 4')}</div>
            <h1 className="aow-title">{t('artistOnboardingWizard.step3Title', 'Connect payouts.')}</h1>
            <p className="aow-sub">
              {t('artistOnboardingWizard.step3Sub', 'Your 70% share pays out automatically after each show, via Stripe Connect.')}
            </p>

            {payoutError && <div className="aow-error">{payoutError}</div>}

            <button
              className="aow-btn aow-btn-solid"
              disabled={payoutBusy}
              onClick={connectStripe}
              type="button"
            >
              {payoutBusy ? t('artistOnboardingWizard.connecting', 'Connecting…') : t('artistOnboardingWizard.connectStripe', 'Connect with Stripe →')}
            </button>
            <button className="aow-btn aow-btn-ghost" disabled={payoutBusy} onClick={skipPayouts} type="button">
              {t('artistOnboardingWizard.doThisLater', "I'll do this later")}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="aow-done">
            <div className="aow-done-icon">
              <svg fill="none" height="28" stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="28">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <h1 className="aow-title" style={{ textAlign: 'center' }}>{t('artistOnboardingWizard.doneTitle', "You're set up.")}</h1>
            <p className="aow-sub" style={{ textAlign: 'center', maxWidth: '34ch', margin: '8px auto 24px' }}>
              {t('artistOnboardingWizard.doneSub', 'Your page is live. Fans can find you, hype your tracks, and buy tickets to your shows.')}
            </p>
            <Link className="aow-btn aow-btn-solid" href={`/artists/${slug}/dashboard`}>
              {t('artistOnboardingWizard.goToMyPage', 'Go to my page →')}
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .aow-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 60px 24px; }
        .aow-card { width: 100%; max-width: 440px; border: 1px solid var(--line); border-radius: var(--radius-2xl); background: var(--bg2); padding: 22px 18px 18px; }
        .aow-progress-track { width: 100%; height: 10px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden; margin-bottom: 28px; }
        .aow-progress-fill { height: 100%; border-radius: var(--radius-pill); background: var(--accent); transition: width .25s ease; }
        .aow-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 10px; }
        .aow-title { font-family: var(--font-display); font-weight: 800; font-size: 1.625rem; letter-spacing: -.03em; margin: 0 0 8px; color: var(--ink); }
        .aow-sub { font-size: 0.9375rem; color: var(--ink-a65, var(--ink-2)); line-height: 1.65; margin: 0 0 24px; }
        .aow-field { display: block; margin-bottom: 14px; }
        .aow-label { display: block; font-family: var(--font-mono); font-size: 0.9375rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a65, var(--ink-2)); margin-bottom: 6px; }
        .aow-input { box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line-2); background: var(--bg3, transparent); color: var(--ink); font-size: 0.9375rem; font-family: inherit; }
        .aow-input:focus { outline: none; border-color: var(--accent); }
        .aow-btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 10px 20px; border-radius: var(--radius-md); font-size: 0.9375rem; font-weight: 700; text-decoration: none; border: none; cursor: pointer; box-sizing: border-box; margin-top: 20px; }
        .aow-btn:disabled { opacity: .55; cursor: default; }
        .aow-btn-solid { background: var(--accent); color: var(--ink-on-accent); }
        .aow-btn-ghost { background: transparent; color: var(--ink-a65, var(--ink-2)); margin-top: 8px; }
        .aow-btn-ghost:hover { color: var(--ink); }
        .aow-alt-link { text-align: center; margin-top: 14px; font-size: 0.9375rem; color: var(--ink-a65, var(--ink-3)); }
        .aow-alt-link a { color: var(--accent-text); text-decoration: none; }
        .aow-error { font-size: 0.9375rem; color: var(--accent-text); margin-bottom: 4px; }
        .aow-reminder-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg3, transparent); padding: 20px; }
        .aow-reminder-label { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65, var(--ink-3)); margin-bottom: 10px; }
        .aow-reminder-text { font-family: var(--font-mono); font-size: 0.9375rem; color: var(--ink-a65, var(--ink-2)); line-height: 1.6; }
        .aow-done { text-align: center; }
        .aow-done-icon { width: 60px; height: 60px; border-radius: var(--radius-lg); background: rgba(var(--accent-rgb),.12); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
      `}</style>
    </div>
  );
}
