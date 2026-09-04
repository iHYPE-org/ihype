'use client';

import { useEffect, useState } from 'react';
import { clearPrivateCaches } from '@/lib/private-cache';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PasskeyManager } from '@/components/AuthScreens';
import { useI18n } from '@/components/I18nProvider';
import { openExternalUrl } from '@/lib/open-external';

interface Prefs {
  newShows: boolean;
  journalPosts: boolean;
  milestones: boolean;
  weeklyDigest: boolean;
  radioLive: boolean;
  crateUploads: boolean;
  bookingRequests: boolean;
}

const ROLE_COLOR: Record<string, string> = { ARTIST: 'var(--role-artist)', VENUE: 'var(--role-venue)' };

/**
 * `label` is required, not optional, and it is the whole point.
 *
 * The wrapping <label> holds only the track and thumb divs — no text — so it
 * gives the checkbox no accessible name. The visible text lives in the sibling
 * <Row>, which a screen reader does not associate with this control. Every
 * toggle on this page therefore announced as an unnamed checkbox: seven of
 * them, all reading "checkbox, checked" and nothing else. Making the prop
 * required means a new toggle cannot repeat that silently.
 */
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className="settings-toggle" style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <input aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
      <div className="settings-toggle-track" />
      <div className="settings-toggle-thumb" />
    </label>
  );
}

// Converts a URL-safe base64 VAPID public key into the Uint8Array shape
// PushManager.subscribe's applicationServerKey expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Shown only when the account has no email at all — which is now the normal
 * state for a fan who signed up with a passkey, since signup stopped asking.
 *
 * Without this the account has no recovery path whatsoever: lose the passkey,
 * lose the account, with nothing support can do. The address is written only
 * after a code sent TO IT comes back, so a typo cannot park recovery on an
 * inbox the user does not own.
 */
function AddRecoveryEmail({ onAdded }: { onAdded: (email: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(payload: Record<string, string>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t('settingsPage.somethingWentWrong', 'Something went wrong.'));
      return data;
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('settingsPage.somethingWentWrong', 'Something went wrong.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-row settings-recovery">
      <div>
        <div className="settings-row-label">{t('settingsPage.recoveryEmailLabel', 'Recovery email')}</div>
        <div className="settings-row-detail">
          {sent
            ? t('settingsPage.recoveryCodeSent', 'Enter the 6-digit code we sent to that address.')
            : t('settingsPage.recoveryEmailDetail', 'Your account has no email. Add one so you can get back in if you lose your passkey.')}
        </div>
        {err ? <div className="settings-recovery-error">{err}</div> : null}
      </div>
      <div className="settings-recovery-controls">
        {sent ? (
          <>
            <input
              aria-label={t('settingsPage.recoveryCodeAria', 'Six-digit verification code')}
              className="settings-input-inline"
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              value={code}
            />
            <button
              className="settings-btn settings-btn-accent"
              disabled={busy || code.length !== 6}
              onClick={async () => {
                const data = await post({ action: 'confirm', email: value.trim().toLowerCase(), code });
                if (data?.verified) onAdded(data.email);
              }}
              type="button"
            >
              {busy ? t('settingsPage.verifying', 'Verifying…') : t('settingsPage.confirm', 'Confirm')}
            </button>
          </>
        ) : (
          <>
            <input
              aria-label={t('settingsPage.recoveryEmailLabel', 'Recovery email')}
              className="settings-input-inline"
              inputMode="email"
              onChange={(e) => setValue(e.target.value)}
              placeholder="you@example.com"
              type="email"
              value={value}
            />
            <button
              className="settings-btn settings-btn-accent"
              disabled={busy || !value.trim()}
              onClick={async () => {
                const data = await post({ action: 'send', email: value.trim().toLowerCase() });
                if (data?.sent) setSent(true);
              }}
              type="button"
            >
              {busy ? t('settingsPage.sending', 'Sending…') : t('settingsPage.sendCode', 'Send code')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, detail, action }: { label: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-detail">{detail}</div>
      </div>
      {action}
    </div>
  );
}

export function MmmSettings() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(true);
  const [role, setRole] = useState('FAN');
  const [isAdult, setIsAdult] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({
    newShows: true, journalPosts: true, milestones: true, weeklyDigest: true,
    radioLive: true, crateUploads: true, bookingRequests: true,
  });
  const [discoverable, setDiscoverable] = useState(true);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);
  const [inviteHexId, setInviteHexId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [payout, setPayout] = useState<{ profileId: string; connected: boolean; started: boolean } | null>(null);
  const [moneyBusy, setMoneyBusy] = useState<'payment' | 'payout' | null>(null);
  const [hypeStats, setHypeStats] = useState<Record<string, number | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        setEmailVerified(Boolean(data.emailVerified));
        setRole(data.role ?? 'FAN');
        setIsAdult(Boolean(data.isEighteenOrOlder));
        if (data.notificationPreference) setPrefs((p) => ({ ...p, ...data.notificationPreference }));
        if (data.creatorProfile) setDiscoverable(Boolean(data.creatorProfile.discoverable));
        if (data.inviteHexId) setInviteHexId(data.inviteHexId);
        setPaymentSaved(Boolean(data.payment?.saved));
        if (data.payout) setPayout(data.payout);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // The HYPE link's scoreboard. Nulls render as em dashes — a figure that
  // could not be read is not 0 (the analytics rule).
  useEffect(() => {
    fetch('/api/me/hype-link-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setHypeStats(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushSupported(true);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function togglePush(next: boolean) {
    setPushBusy(true);
    setPushError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (next) {
        if (Notification.permission === 'denied') {
          throw new Error(t('settingsPage.pushBlocked', 'Notifications are blocked for this site in your browser settings.'));
        }
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (permission !== 'granted') throw new Error(t('settingsPage.pushPermissionDenied', 'Permission was not granted.'));

        const keyRes = await fetch('/api/push/vapid-key');
        const { key } = await keyRes.json();
        if (!key) throw new Error(t('settingsPage.pushNotConfigured', 'Push notifications are not configured yet.'));

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
        const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error(t('settingsPage.pushSubscriptionIncomplete', 'Subscription was incomplete.'));

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
        });
        if (!res.ok) throw new Error(t('settingsPage.pushSaveFailed', 'Could not save your subscription.'));
        setPushSubscribed(true);
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await fetch('/api/push/unsubscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          });
        }
        setPushSubscribed(false);
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : t('settingsPage.somethingWentWrong', 'Something went wrong.'));
    } finally {
      setPushBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), notificationPreference: prefs }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? t('settingsPage.saveFailed', 'Failed to save'));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      }
    } catch {
      setError(t('settingsPage.networkError', 'Network error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscoverable(next: boolean) {
    const prev = discoverable;
    setDiscoverable(next);
    setSavingDiscoverable(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoverable: next }),
      });
      if (!res.ok) setDiscoverable(prev);
    } catch {
      setDiscoverable(prev);
    } finally {
      setSavingDiscoverable(false);
    }
  }

  async function attestAdult() {
    if (!confirm(t('settingsPage.confirmAdult', 'Confirm that you are 18 years of age or older? This unlocks ticket purchases and referral links and cannot be undone.'))) return;
    setAttesting(true);
    setError(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attestEighteenOrOlder: true }),
      });
      if (res.ok) {
        setIsAdult(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t('settingsPage.ageConfirmFailed', 'Could not save your age confirmation.'));
      }
    } catch {
      setError(t('settingsPage.networkError', 'Network error'));
    } finally {
      setAttesting(false);
    }
  }

  async function detachIdentity() {
    if (!confirm(t('settingsPage.confirmDetach', 'Detach your identity from activity history now?'))) return;
    setDetaching(true);
    try {
      await fetch('/api/privacy/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'detach' }),
      });
      alert(t('settingsPage.identityDetached', 'Identity detached — IP and location data have been removed from your activity log.'));
    } finally {
      setDetaching(false);
    }
  }

  /* One sentence, used by the OS share sheet and by the three channel links
     below it, so a member's link never arrives bare with no idea what it is. */
  const hypeLinkShareText = inviteHexId
    ? t(
        'settingsPage.hypeLinkShareText',
        'Come find live music with me on iHYPE — artists keep 70% of every ticket: https://ihype.org/invite/{code}',
      ).replace('{code}', inviteHexId)
    : '';

  async function shareInviteLink() {
    if (!inviteHexId) return;
    const link = `https://ihype.org/invite/${inviteHexId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('settingsPage.shareTitle', 'Join me on iHYPE'), text: t('settingsPage.shareText', 'Join me on iHYPE — music discovery, tickets, and more.'), url: link });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 1800);
      } else {
        window.prompt(t('settingsPage.copyInviteLinkPrompt', 'Copy your invite link'), link);
      }
    } catch {
      // Ignore canceled shares / clipboard failures.
    }
  }

  /* Both money methods run through Stripe's hosted pages — no Stripe.js
     anywhere in this codebase, same pattern as ticket checkout and Connect
     onboarding. The buttons just fetch a URL and go there. */
  async function addPaymentMethod() {
    setMoneyBusy('payment');
    setError(null);
    try {
      const res = await fetch('/api/stripe/payment-method/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnPath: '/app/me/settings' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? t('settingsPage.paymentMethodFailed', 'Could not open the payment form.'));
      await openExternalUrl(data.checkoutUrl, { onReturn: () => router.refresh() });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsPage.paymentMethodFailed', 'Could not open the payment form.'));
      setMoneyBusy(null);
    }
  }

  async function connectPayouts() {
    if (!payout) return;
    setMoneyBusy('payout');
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId: payout.profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.onboardingUrl) throw new Error(data.error ?? t('settingsPage.payoutConnectFailed', 'Could not open payout onboarding.'));
      await openExternalUrl(data.onboardingUrl, { onReturn: () => router.refresh() });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsPage.payoutConnectFailed', 'Could not open payout onboarding.'));
      setMoneyBusy(null);
    }
  }

  async function downloadExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ihype-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('settingsPage.exportFailed', 'Export failed — try again or contact support.'));
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (!confirm(t('settingsPage.confirmDelete', 'Are you sure? This cannot be undone.'))) return;
    const typed = prompt(t('settingsPage.typeDeleteToConfirm', 'Type DELETE to confirm account deletion:'));
    if (typed !== 'DELETE') return;
    const res = await fetch('/api/settings/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (res.ok) {
      alert(t('settingsPage.deletionScheduled', 'Account deletion scheduled. You will receive a confirmation email.'));
      // Same reasoning as the sign-out row, and more pressing: this account is
      // being deleted, so nothing of it should survive in a cache on the device.
      clearPrivateCaches();
      window.location.href = '/api/auth/signout';
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t('settingsPage.deleteAccountFailed', 'Could not delete account.'));
    }
  }

  const isCreator = role === 'ARTIST' || role === 'VENUE';
  const roleColor = ROLE_COLOR[role] ?? 'var(--role-fan)';

  return (
    <div className="settings-page settings-col">
      <Link className="mmm-charter-back" href="/app/me?panel=settings">‹ Me</Link>
      <h1>{t('settingsPage.title', 'Settings')}</h1>

      {loading ? (
        <p style={{ color: 'var(--ink-a65)', fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>{t('settingsPage.loading', 'Loading…')}</p>
      ) : (
        <>
          {/* The HYPE link, first (owner, 2026-08-24: "put HYPE link at top —
              it does a lot"). One link, four jobs: shares liked playlists,
              shares events, invites new members past the alpha gate, and earns
              the 10% promoter share on shows it sells. The scoreboard below is
              /api/me/hype-link-stats — every figure a real table, an em dash
              where one could not be read. */}
          {inviteHexId && (
            <div className="settings-section">
              <div className="settings-section-title">{t('settingsPage.hypeLink', 'Your HYPE link')}</div>
              <div className="settings-group">
                <Row
                  action={
                    <button className="settings-btn settings-btn-ghost" onClick={shareInviteLink} type="button">
                      {inviteCopied ? t('settingsPage.copied', 'Copied ✓') : t('settingsPage.share', 'Share')}
                    </button>
                  }
                  detail={`ihype.org/invite/${inviteHexId}`}
                  label={t('settingsPage.yourHypeLink', 'Share everything through it')}
                />
                {/* Somewhere to send it. "Share" is the OS sheet, which is the
                    right default on a phone and nothing at all on a desktop
                    where `navigator.share` is absent — so the three channels
                    people actually use are here as plain links. Ported from
                    `PagesReferralTab`, a second implementation of this whole
                    section that was mounted on no page and is now deleted: it
                    had these and the scoreboard below has everything else. */}
                <div className="settings-hype-channels">
                  <a className="settings-btn settings-btn-ghost" href={`sms:?body=${encodeURIComponent(hypeLinkShareText)}`}>
                    {t('settingsPage.shareByMessage', 'Message')}
                  </a>
                  <a
                    className="settings-btn settings-btn-ghost"
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(hypeLinkShareText)}`}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {t('settingsPage.shareOnX', 'X')}
                  </a>
                  <a
                    className="settings-btn settings-btn-ghost"
                    href={`mailto:?subject=${encodeURIComponent(t('settingsPage.shareEmailSubject', 'Join me on iHYPE'))}&body=${encodeURIComponent(hypeLinkShareText)}`}
                  >
                    {t('settingsPage.shareByEmail', 'Email')}
                  </a>
                </div>
                <p className="settings-invite-note">
                  {t('settingsPage.hypeLinkNote', 'Your HYPE link shares liked playlists and events, invites new members past the alpha gate, and earns you the 10% promoter share on any show it sells.')}
                </p>
                <div className="settings-hype-stats">
                  {([
                    [t('settingsPage.hypesEarned', 'HYPEs earned'), hypeStats?.hypesEarned],
                    [t('settingsPage.hypesGiven', 'HYPEs given'), hypeStats?.hypesGiven],
                    [t('settingsPage.ticketReferrals', 'Ticket referrals'), hypeStats?.ticketReferrals],
                    [t('settingsPage.dollarsEarned', '$ earned'), typeof hypeStats?.dollarsEarnedCents === 'number' ? `$${(hypeStats.dollarsEarnedCents / 100).toFixed(2)}` : null],
                    [t('settingsPage.newUsers', 'New members from your link'), hypeStats?.newUsers],
                    [t('settingsPage.artistsHyped', 'Artists HYPEd'), hypeStats?.artistsHyped],
                    [t('settingsPage.venuesHyped', 'Venues HYPEd'), hypeStats?.venuesHyped],
                    [t('settingsPage.advertisersHyped', 'Advertisers HYPEd'), hypeStats?.advertisersHyped],
                  ] as Array<[string, number | string | null | undefined]>).map(([statLabel, statValue]) => (
                    <div className="settings-hype-stat" key={statLabel}>
                      <div className="settings-hype-stat-value">{statValue ?? '—'}</div>
                      <div className="settings-hype-stat-label">{statLabel}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Money methods — BOTH, for every role (owner, 2026-08-24:
              "Settings needs payment method AND payout method"). A payment
              method buys tickets; a payout method receives what your HYPE
              link earns — the 10% promoter share lands on any account whose
              link sold the ticket, so neither card is gated on role. Both run
              through Stripe's hosted pages. */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settingsPage.moneyMethods', 'Payment & payouts')}</div>
            <div className="settings-group">
              <div className="settings-row settings-payout-card">
                <div className="settings-payout-ic">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--role-fan)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="settings-row-label">
                    {paymentSaved
                      ? t('settingsPage.paymentMethodSaved', 'Payment method saved with Stripe')
                      : t('settingsPage.noPaymentMethod', 'No payment method on file')}
                  </div>
                  <div className="settings-row-detail">{t('settingsPage.paymentMethodDetail', 'Used for ticket purchases — face value + $0 fees')}</div>
                </div>
                <button className="settings-btn settings-btn-ghost" disabled={moneyBusy === 'payment'} onClick={() => void addPaymentMethod()} type="button">
                  {moneyBusy === 'payment' ? t('settingsPage.opening', 'Opening…') : paymentSaved ? t('settingsPage.update', 'Update') : t('settingsPage.add', 'Add')}
                </button>
              </div>

              <div className="settings-row settings-payout-card">
                <div className="settings-payout-ic">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={roleColor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="settings-row-label">
                    {payout?.connected
                      ? t('settingsPage.payoutConnected', 'Payout method connected')
                      : t('settingsPage.noPayoutDestination', 'No payout destination connected yet')}
                  </div>
                  <div className="settings-row-detail">
                    {isCreator
                      ? t('settingsPage.payoutsLandDetail', 'Payouts land within 2 business days of a show closing')
                      : t('settingsPage.payoutPromoterDetail', 'Receives the 10% promoter share your HYPE link earns')}
                  </div>
                  <div className="settings-split-mini">
                    {isCreator ? (
                      <span style={{ color: roleColor }}>{role === 'VENUE' ? t('settingsPage.splitVenueYou', '20% you') : t('settingsPage.splitArtistYou', '70% you')}</span>
                    ) : (
                      <span style={{ color: 'var(--role-promoter)' }}>{t('settingsPage.splitPromoterYou', '10% you')}</span>
                    )}
                    <span style={{ color: 'var(--ink-a65)' }}>{t('settingsPage.splitArtist', '70% artist')}</span>
                    <span style={{ color: 'var(--ink-a65)' }}>{t('settingsPage.splitVenue', '20% venue')}</span>
                  </div>
                </div>
                {payout && (
                  <button className="settings-btn settings-btn-ghost" disabled={moneyBusy === 'payout'} onClick={() => void connectPayouts()} type="button">
                    {moneyBusy === 'payout' ? t('settingsPage.opening', 'Opening…') : payout.connected ? t('settingsPage.manage', 'Manage') : t('settingsPage.connect', 'Connect')}
                  </button>
                )}
              </div>

              {isCreator && (
                <Row action={<Link className="settings-btn settings-btn-ghost" href="/app/me/payouts?tab=history">{t('settingsPage.view', 'View')}</Link>} detail={t('settingsPage.payoutHistoryDetail', 'Every payout receipt, itemized 70/20/10')} label={t('settingsPage.payoutHistory', 'Payout history')} />
              )}
            </div>
          </div>

          {/* Profile */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settingsPage.profile', 'Profile')}</div>
            <div className="settings-group">
              <Row
                action={<input aria-label={t('settingsPage.displayName', 'Display name')} className="settings-input-inline" onChange={(e) => setName(e.target.value)} value={name} />}
                detail={t('settingsPage.shownOnProfile', 'Shown on your profile')}
                label={t('settingsPage.displayName', 'Display name')}
              />
              {/* An account with no email is now normal (passkey signup asks
                  for nothing), and it is the one with no way back in. The old
                  row rendered an empty address beside a "Verify" button that
                  had nothing to verify. */}
              {email ? (
                <Row
                  action={emailVerified
                    ? <span className="settings-row-detail">{t('settingsPage.contactToChange', 'Contact admin@ihype.org to change')}</span>
                    : <Link className="settings-btn settings-btn-ghost" href="/verify-email">{t('settingsPage.verify', 'Verify')}</Link>}
                  detail={emailVerified ? email : `${email} · ${t('settingsPage.notVerified', 'not verified')}`}
                  label={t('settingsPage.email', 'Email')}
                />
              ) : (
                <AddRecoveryEmail onAdded={(added) => { setEmail(added); setEmailVerified(true); }} />
              )}
              <Row
                action={<Link className="settings-btn settings-btn-ghost" href="/verify">{t('settingsPage.manage', 'Manage')}</Link>}
                detail={role.charAt(0) + role.slice(1).toLowerCase()}
                label={t('settingsPage.role', 'Role')}
              />
              <Row
                action={
                  isAdult ? (
                    <span className="settings-row-detail" style={{ color: 'var(--role-venue)' }}>{t('settingsPage.adultConfirmed', '✓ 18+ confirmed')}</span>
                  ) : (
                    <button className="settings-btn settings-btn-ghost" disabled={attesting} onClick={attestAdult} type="button">
                      {attesting ? t('settingsPage.saving', 'Saving…') : t('settingsPage.imEighteen', "I'm 18 or older")}
                    </button>
                  )
                }
                detail={isAdult ? t('settingsPage.adultUnlockedDetail', 'Ticket purchases and referral links are unlocked') : t('settingsPage.adultRequiredDetail', 'Required to buy tickets or share referral links (13+ to listen)')}
                label={t('settingsPage.ageVerification', 'Age verification')}
              />
            </div>
          </div>

          {/* Notifications. The `id` is load-bearing: ME's Settings panel links
              to /settings#notifications, and without an anchor that row drops
              the member at the top of a long page to hunt for it. */}
          <div className="settings-section" id="notifications">
            <div className="settings-section-title">{t('settingsPage.notifications', 'Notifications')}</div>
            <div className="settings-group">
              <Row action={<Toggle checked={prefs.newShows} label={t('settingsPage.ticketDrops', 'Ticket drops')} onChange={(v) => setPrefs((p) => ({ ...p, newShows: v }))} />} detail={t('settingsPage.ticketDropsDetail', 'When artists you follow announce shows')} label={t('settingsPage.ticketDrops', 'Ticket drops')} />
              <Row action={<Toggle checked={prefs.milestones} label={t('settingsPage.hypeMilestones', 'Hype milestones')} onChange={(v) => setPrefs((p) => ({ ...p, milestones: v }))} />} detail={t('settingsPage.hypeMilestonesDetail', 'When your tracks hit hype thresholds')} label={t('settingsPage.hypeMilestones', 'Hype milestones')} />
              <Row action={<Toggle checked={prefs.journalPosts} label={t('settingsPage.journalPosts', 'Journal posts')} onChange={(v) => setPrefs((p) => ({ ...p, journalPosts: v }))} />} detail={t('settingsPage.journalPostsDetail', 'New posts from creators you follow')} label={t('settingsPage.journalPosts', 'Journal posts')} />
              <Row action={<Toggle checked={prefs.weeklyDigest} label={t('settingsPage.weeklyDigest', 'Weekly digest')} onChange={(v) => setPrefs((p) => ({ ...p, weeklyDigest: v }))} />} detail={t('settingsPage.weeklyDigestDetail', 'A weekly summary of upcoming shows and activity')} label={t('settingsPage.weeklyDigest', 'Weekly digest')} />
              <Row action={<Toggle checked={prefs.radioLive} label={t('settingsPage.radioShows', 'Radio shows')} onChange={(v) => setPrefs((p) => ({ ...p, radioLive: v }))} />} detail={t('settingsPage.radioShowsDetail', 'When a show you follow goes live')} label={t('settingsPage.radioShows', 'Radio shows')} />
              {role === 'ARTIST' && (
                <Row action={<Toggle checked={prefs.crateUploads} label={t('settingsPage.trackUploads', 'Track uploads')} onChange={(v) => setPrefs((p) => ({ ...p, crateUploads: v }))} />} detail={t('settingsPage.crateUploadsDetail', 'When your upload clears screening')} label={t('settingsPage.trackUploads', 'Track uploads')} />
              )}
              {role === 'VENUE' && (
                <Row action={<Toggle checked={prefs.bookingRequests} label={t('settingsPage.bookingRequests', 'Booking requests')} onChange={(v) => setPrefs((p) => ({ ...p, bookingRequests: v }))} />} detail={t('settingsPage.bookingRequestsDetail', 'When an artist requests a slot')} label={t('settingsPage.bookingRequests', 'Booking requests')} />
              )}
              <Row
                action={<Toggle checked={pushSubscribed} disabled={!pushSupported || pushBusy} label={t('settingsPage.pushLabel', 'Push notifications (this browser)')} onChange={(v) => void togglePush(v)} />}
                detail={
                  !pushSupported
                    ? t('settingsPage.pushNotSupported', 'Not supported in this browser')
                    : pushSubscribed
                    ? t('settingsPage.pushEnabledDetail', 'Enabled on this device — separate from the app toggles above')
                    : t('settingsPage.pushPromptDetail', 'Get instant browser alerts on this device, even when iHYPE is closed')
                }
                label={t('settingsPage.pushLabel', 'Push notifications (this browser)')}
              />
              {pushError && <p style={{ color: 'var(--accent-text)', fontSize: '0.9375rem', padding: '0 20px 14px' }}>{pushError}</p>}
            </div>
          </div>

          {/* Security */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settingsPage.security', 'Security')}</div>
            <div className="settings-group settings-passkeys">
              <PasskeyManager />
            </div>
          </div>

          {/* Privacy — id is the "Data controls" deep-link target in the shell drawer. */}
          <div className="settings-section" id="privacy">
            <div className="settings-section-title">{t('settingsPage.privacy', 'Privacy')}</div>
            <div className="settings-group">
              {isCreator && (
                <Row
                  action={<Toggle checked={discoverable} disabled={savingDiscoverable} label={role === 'VENUE' ? t('settingsPage.demandRadarLabel', 'Show me in demand radar') : t('settingsPage.discoveryLabel', 'Show me in discovery')} onChange={toggleDiscoverable} />}
                  detail={role === 'VENUE' ? t('settingsPage.demandRadarDetail', 'Artists can see your room in the demand radar and request a slot') : t('settingsPage.discoveryDetail', 'Fans can find your profile in Discover and search')}
                  label={role === 'VENUE' ? t('settingsPage.demandRadarLabel', 'Show me in demand radar') : t('settingsPage.discoveryLabel', 'Show me in discovery')}
                />
              )}
              <Row
                action={<button className="settings-btn settings-btn-ghost" disabled={detaching} onClick={detachIdentity} type="button">{detaching ? t('settingsPage.detaching', 'Detaching…') : t('settingsPage.detachNow', 'Detach now')}</button>}
                detail={t('settingsPage.identityDetachmentDetail', 'Remove IP & location from your activity log now (automatic after 30 days)')}
                label={t('settingsPage.identityDetachmentLabel', 'Early identity detachment')}
              />
              <Row
                action={<button className="settings-btn settings-btn-ghost" disabled={exporting} onClick={downloadExport} type="button">{exporting ? t('settingsPage.preparing', 'Preparing…') : t('settingsPage.requestExport', 'Request export')}</button>}
                detail={t('settingsPage.downloadDataDetail', 'Get a copy of everything we hold')}
                label={t('settingsPage.downloadDataLabel', 'Download my data')}
              />
            </div>
          </div>

          {/* Danger zone */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settingsPage.dangerZone', 'Danger Zone')}</div>
            <div className="settings-group settings-danger-zone">
              {/* Plain <a>, not <Link>: /api/auth/signout is an API route, so it
                  needs a real navigation — a soft client-side nav won't hit it.

                  onClick drops the ticket and page caches on the way out. A
                  ticket page is personalised and carries a QR that admits its
                  holder to a show, and the ticket cache is deliberately
                  version-independent so an SW update cannot wipe it — which
                  also meant nothing ever did. On a shared device the next
                  person could be served the previous account's ticket. The
                  navigation does not wait: postMessage reaches the service
                  worker, which outlives this page. */}
              <Row action={<a className="settings-btn settings-btn-danger" href="/api/auth/signout" onClick={() => clearPrivateCaches()}>{t('settingsPage.signOut', 'Sign out')}</a>} detail={t('settingsPage.signOutDetail', 'Sign out of iHYPE on this device')} label={t('settingsPage.signOutLabel', 'Sign out')} />
              <Row action={<button className="settings-btn settings-btn-danger" onClick={deleteAccount} type="button">{t('settingsPage.delete', 'Delete')}</button>} detail={t('settingsPage.deleteAccountDetail', 'Permanent. All data removed within 30 days.')} label={t('settingsPage.deleteAccountLabel', 'Delete account')} />
            </div>
          </div>

          {error && <p style={{ color: 'var(--accent-text)', fontSize: '0.9375rem' }}>{error}</p>}
          {saved && <p style={{ color: 'var(--role-venue)', fontSize: '0.9375rem', fontFamily: 'var(--font-mono)' }}>{t('settingsPage.savedConfirm', '✓ Saved')}</p>}

          <button className="settings-btn settings-btn-accent" disabled={saving} onClick={save} style={{ width: '100%' }} type="button">
            {saving ? t('settingsPage.saving', 'Saving…') : t('settingsPage.saveSettings', 'Save settings')}
          </button>
        </>
      )}

      <style>{`
        /* The HYPE link's scoreboard — eight printed figures on the paper
           card. An em dash is "could not read", never 0 (the analytics rule).
           Labels take the tracked-mono metadata floor; values are content. */
        .settings-hype-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
          padding: 12px 0 4px;
        }
        .settings-hype-stat {
          border: 1px solid var(--ink-a22);
          border-radius: var(--radius-panel);
          background: var(--bg-surface);
          padding: 10px 12px;
        }
        .settings-hype-stat-value {
          font-family: var(--font-display);
          font-size: 1.375rem;
          line-height: 1.1;
          color: var(--ink);
        }
        .settings-hype-stat-label {
          margin-top: 3px;
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-3);
        }

        /* ── Design System 8 · templates/role-settings/ ──────────────────
           Values lifted from the template: a 640px reading column, 28px
           display heading, cards at 16px radius on the .04/.15 surface-tint
           pair with 22px padding, rows at 11px 0 divided by a .13 hairline,
           and the 42x24 toggle.

           Two things about this are structural rather than cosmetic.

           (1) The template puts each section's TITLE inside its card. This page
           renders the title above ".settings-group", both inside
           ".settings-section" — so ".settings-section" becomes the card and the
           group goes transparent inside it. Same result as the template, and no
           JSX moved, which matters on a page whose rows carry real mutations.

           (2) ".settings-page" is in mmm-primitives.css's page-container group,
           which sets "max-width: none" at (0,2,0) — deliberately, so a page does
           not nest a narrow column inside the shell's own. Editing the
           max-width here therefore did nothing inside the shell, and settings
           has been rendering at the full 1620px content width no matter what
           this block said. A settings FORM wants the narrow column, so the
           element carries a second class and the compound selector below both
           matches that specificity and comes later in document order. */
        .settings-page { padding: 44px 24px 100px; }
        .settings-page.settings-col { max-width: 640px; margin: 0 auto; }
        .settings-page h1 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em; margin-bottom: 28px; color: var(--ink); }

        .settings-section {
          border: 1px solid rgba(var(--surface-tint-rgb), .15);
          border-radius: 16px;
          background: rgba(var(--surface-tint-rgb), .04);
          padding: 22px;
          margin-bottom: 16px;
        }
        .settings-section-title { font-family: var(--font-display); font-weight: 800; font-size: 1rem; letter-spacing: -.01em; text-transform: none; color: var(--ink); margin-bottom: 16px; }
        /* The card is the group now. */
        .settings-group { border: 0; border-radius: 0; overflow: visible; background: none; }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid rgba(var(--surface-tint-rgb), .13); gap: 16px; }
        .settings-row:last-child { border-bottom: none; }
        /* The text block must be allowed to SHRINK. A flex item defaults to
           min-width:auto, which refuses to go below its content's intrinsic
           width, so a long label, detail or email address pushed the row wider
           than the pane instead of wrapping. Measured at 375px: right edge
           428.8px against a 375px window — 54px of content a thumb could drag
           the whole surface sideways to reach, which is the owner's "Me
           category ... can be dragged out of frame in mobile". The pane now
           refuses to pan (mmm.css), so without this the same rows would clip
           instead. overflow-wrap:anywhere is for the unbroken case a recovery
           email is. (No backticks in this comment: the block is a template
           literal, so one would end it mid-stylesheet.) */
        .settings-row > :first-child { min-width: 0; overflow-wrap: anywhere; }
        .settings-row-label { font-size: 0.9375rem; font-weight: 500; color: var(--ink); }
        .settings-row-detail { font-size: 0.9375rem; color: var(--ink-2); margin-top: 2px; }
        .settings-invite-note { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.5; margin: 10px 2px 0; }
        /* Wraps rather than scrolls: three short labels, and a row that
           overflows on a 375px screen is the one thing MOBILE.md rules out. */
        .settings-hype-channels { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 2px 0; }
        .settings-hype-channels > a { text-decoration: none; }

        .settings-toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; display: block; }
        .settings-toggle input { opacity: 0; width: 0; height: 0; }
        .settings-toggle-track { position: absolute; inset: 0; border-radius: 12px; background: rgba(var(--surface-tint-rgb), .14); cursor: pointer; transition: background 200ms; }
        .settings-toggle input:checked + .settings-toggle-track { background: var(--role-venue); }
        .settings-toggle-thumb { position: absolute; width: 20px; height: 20px; top: 2px; left: 2px; border-radius: 50%; background: var(--ink); transition: transform 200ms cubic-bezier(.2,.7,.3,1); pointer-events: none; }
        .settings-toggle input:checked ~ .settings-toggle-thumb { background: var(--bg); transform: translateX(18px); }

        .settings-btn { min-height: 44px; padding: 9px 18px; border-radius: 9px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: all 150ms; border: none; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
        .settings-btn-ghost { background: rgba(var(--surface-tint-rgb), .08); color: var(--ink); }
        .settings-btn-ghost:hover { background: rgba(var(--surface-tint-rgb), .14); }
        .settings-btn-danger { background: rgba(239,68,68,.12); color: var(--danger-text); }
        .settings-btn-danger:hover { background: rgba(239,68,68,.22); }
        .settings-btn-accent { background: var(--accent); color: var(--ink-on-accent); }
        .settings-btn-accent:hover { opacity: .9; }

        .settings-input-inline { height: 44px; padding: 0 14px; border: 1px solid rgba(var(--surface-tint-rgb), .14); border-radius: 9px; background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 0.9375rem; box-sizing: border-box; }
        .settings-input-inline:focus { outline: none; border-color: var(--accent); }
        .settings-recovery { align-items: flex-start; }
        .settings-recovery-controls { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .settings-recovery-controls .settings-input-inline { width: 190px; max-width: 100%; }
        .settings-recovery-error { margin-top: 6px; font-size: 0.9375rem; color: var(--warning-text); }
        /* Still the one card that reads as dangerous, now that the border it
           used to override belongs to the section rather than the group. */
        .settings-section:has(.settings-danger-zone) { border-color: rgba(239,68,68,.2); }
        .settings-danger-zone .settings-row { border-color: rgba(239,68,68,.1); }
        .settings-passkeys { padding: 11px 0; }
        .settings-payout-card { align-items: center; gap: 14px; }
        .settings-payout-ic { width: 40px; height: 40px; border-radius: 10px; background: rgba(var(--surface-tint-rgb), .08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .settings-split-mini { display: flex; gap: 10px; margin-top: 10px; }
        .settings-split-mini span { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .08em; padding: 3px 8px; border-radius: 6px; background: rgba(var(--surface-tint-rgb), .07); }

        @media (max-width: 600px) {
          .settings-page { padding: 24px 16px 100px; }
          .settings-page h1 { font-size: 1.625rem; margin-bottom: 22px; }
          .settings-section { padding: 18px; margin-bottom: 14px; }
          .settings-row { flex-wrap: wrap; }
          .settings-row > *:first-child { flex: 1 1 100%; }
          .settings-row-label { font-size: 0.9375rem; }
          .settings-input-inline { width: 100%; box-sizing: border-box; }
          .settings-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
          .settings-payout-card { flex-wrap: wrap; }
          .settings-payout-card > a, .settings-payout-card > button { flex: 1 1 100%; }
          .settings-toggle { width: 48px; height: 28px; }
          .settings-toggle-thumb { width: 22px; height: 22px; top: 3px; left: 3px; }
          .settings-toggle input:checked ~ .settings-toggle-thumb { transform: translateX(20px); }
        }
      `}</style>
    </div>
  );
}
