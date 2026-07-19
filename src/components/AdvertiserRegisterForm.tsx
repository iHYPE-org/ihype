'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '@/lib/api-client';
import { getErrorMessage } from '@/components/AuthShared';

export function AdvertiserRegisterForm() {
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await postJson('/api/advertise/register', {
        email: email.trim(),
        companyName: companyName.trim(),
        contactName: contactName.trim() || undefined,
        website: website.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="aar-page">
        <div className="aar-card aar-done">
          <div className="aar-check">✓</div>
          <h1 className="aar-title">Check your inbox.</h1>
          <p className="aar-sub">
            We sent a one-tap sign-in link to <b>{email.trim()}</b>. Open it to finish setting up
            your advertiser account and land straight in your campaign dashboard.
          </p>
          <Link className="aar-link" href="/advertise">← Back to Advertise</Link>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="aar-page">
      <form className="aar-card" onSubmit={submit}>
        <div className="aar-eyebrow">3rd-Party Advertiser Account</div>
        <h1 className="aar-title">Manage your ad campaigns.</h1>
        <p className="aar-sub">
          For music stores, merch printers, live-production companies, and other music-adjacent
          businesses — no artist, venue, or DJ account required, and no public profile page.
        </p>

        <label className="aar-label" htmlFor="companyName">Company name</label>
        <input
          className="aar-input"
          id="companyName"
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="NorthBeat Pedals"
          required
          value={companyName}
        />

        <label className="aar-label" htmlFor="email">Email</label>
        <input
          className="aar-input"
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          required
          type="email"
          value={email}
        />

        <label className="aar-label" htmlFor="contactName">Contact name (optional)</label>
        <input
          className="aar-input"
          id="contactName"
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Jamie Lee"
          value={contactName}
        />

        <label className="aar-label" htmlFor="website">Website (optional)</label>
        <input
          className="aar-input"
          id="website"
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://yourcompany.com"
          type="url"
          value={website}
        />

        {error && <p className="aar-error">{error}</p>}

        <button className="aar-btn" disabled={submitting} type="submit">
          {submitting ? 'Creating account…' : 'Create advertiser account →'}
        </button>

        <p className="aar-fineprint">
          We'll email you a sign-in link — no password to set. Already have an advertiser account?{' '}
          <Link href="/login?callbackUrl=/advertise/dashboard">Sign in</Link>.
        </p>
      </form>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .aar-page { max-width: 460px; margin: 0 auto; padding: 60px 20px 80px; }
  .aar-card { display: flex; flex-direction: column; }
  .aar-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent, #ff5029); margin-bottom: 10px; }
  .aar-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.03em; margin: 0 0 12px; color: var(--ink); }
  .aar-sub { font-size: 13.5px; color: var(--ink-a65); line-height: 1.6; margin: 0 0 28px; }
  .aar-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a55); margin: 14px 0 6px; }
  .aar-label:first-of-type { margin-top: 0; }
  .aar-input { width: 100%; font-size: 14px; color: var(--ink); background: var(--bg2); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px 14px; outline: none; }
  .aar-input:focus { border-color: var(--accent, #ff5029); }
  .aar-error { color: var(--accent, #ff5029); font-size: 12.5px; margin: 14px 0 0; }
  .aar-btn { margin-top: 26px; font-family: var(--font-mono); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; padding: 13px 20px; border-radius: var(--radius-pill); border: none; background: var(--accent, #ff5029); color: #fff; cursor: pointer; }
  .aar-btn:disabled { opacity: .6; cursor: default; }
  .aar-fineprint { font-size: 12px; color: var(--ink-a55); line-height: 1.6; margin-top: 16px; }
  .aar-fineprint a { color: var(--ink-a70); text-decoration: underline; }
  .aar-done { text-align: center; }
  .aar-check { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; background: rgba(34,229,212,.12); border: 2px solid #22e5d4; color: #22e5d4; font-size: 24px; }
  .aar-link { display: inline-block; margin-top: 20px; font-size: 13px; color: var(--ink-a70); text-decoration: underline; }
`;
