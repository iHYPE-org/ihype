'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { useI18n } from '@/components/I18nProvider';

function AdminDeviceRegisterInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const mode = params.get('mode') === 'change' ? 'change' : 'setup';
  const [status, setStatus] = useState<'pending' | 'registering' | 'done' | 'error'>('pending');
  const [errorMsg, setErrorMsg] = useState('');
  // Arriving here with no token is the LOCKOUT case, not a mistake: the admin
  // layout redirects any administrator whose device cookie is missing. Before
  // this, the page said "request a new setup link from admin@ihype.org" — to an
  // address only reachable by an operator who could edit the Worker's
  // environment, because every link-issuing route was gated on
  // ALLOW_ADMIN_SETUP. `/api/admin/device-reissue` closes that: a signed-in
  // administrator can send themselves one.
  const [reissue, setReissue] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [reissueMsg, setReissueMsg] = useState('');

  /* The primary way in (owner, 2026-08-24: "Admin Mode needs passkey only
     security, and doesn't need email access requirement"): a fresh WebAuthn
     assertion with the admin's own passkey registers this device directly.
     The emailed link below survives only as recovery for a lost
     authenticator. */
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState('');

  async function registerWithPasskey() {
    setPasskeyBusy(true);
    setPasskeyMsg('');
    try {
      const optionsRes = await fetch('/api/admin/device-passkey');
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? t('adminDeviceRegisterPage.passkeyFailed', 'Could not start the passkey ceremony.'));
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/admin/device-passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      const data = await verifyRes.json().catch(() => ({} as { error?: string }));
      if (!verifyRes.ok) throw new Error(data.error ?? t('adminDeviceRegisterPage.passkeyFailed', 'Passkey verification failed.'));
      setStatus('done');
      setTimeout(() => router.replace('/admin'), 900);
    } catch (err) {
      setPasskeyMsg(err instanceof Error ? err.message : t('adminDeviceRegisterPage.passkeyFailed', 'Passkey verification failed.'));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function requestNewLink() {
    setReissue('sending');
    setReissueMsg('');
    try {
      const res = await fetch('/api/admin/device-reissue', { method: 'POST' });
      const data = await res.json().catch(() => ({} as { error?: string; sentTo?: string }));
      if (res.ok) {
        setReissue('sent');
        setReissueMsg(data.sentTo ?? '');
      } else {
        setReissue('failed');
        setReissueMsg(data.error ?? t('adminDeviceRegisterPage.reissueFailed', 'Could not send a link.'));
      }
    } catch {
      setReissue('failed');
      setReissueMsg(t('adminDeviceRegisterPage.networkError', 'Network error.'));
    }
  }

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg(t('adminDeviceRegisterPage.noToken', 'No token provided.'));
      return;
    }
    setStatus('registering');
    const endpoint = mode === 'change'
      ? '/api/admin/device-change/verify'
      : '/api/admin/device-register';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then((data: { ok?: boolean; error?: string }) => {
        if (data.ok) {
          setStatus('done');
          setTimeout(() => router.replace('/admin'), 1500);
        } else {
          setStatus('error');
          setErrorMsg(data.error ?? t('adminDeviceRegisterPage.registrationFailed', 'Registration failed.'));
        }
      })
      .catch(() => { setStatus('error'); setErrorMsg(t('adminDeviceRegisterPage.networkError', 'Network error.')); });
  }, [token, mode, router]);

  // This page renders OUTSIDE AdminShell (the layout returns it before the
  // session gate), so it paints its own ground. It previously set color:#111
  // with no background at all — near-black copy on the DS8 navy page, i.e.
  // effectively invisible, on the one screen that completes admin device
  // registration.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--f-b)', background: 'var(--bg)', color: 'var(--ink)' }}>
      {status === 'pending' && <p>{t('adminDeviceRegisterPage.checking', 'Checking this device…')}</p>}
      {status === 'registering' && <p>{t('adminDeviceRegisterPage.registering', 'Registering this device…')}</p>}
      {status === 'done' && <p style={{ color: 'var(--success)' }}>{t('adminDeviceRegisterPage.done', 'Device registered. Redirecting to admin…')}</p>}
      {status === 'error' && (
        <>
          <p style={{ color: 'var(--danger)' }}>{t('adminDeviceRegisterPage.errorPrefix', 'Error:')} {errorMsg}</p>
          {!token ? (
            <p style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', maxWidth: 460, textAlign: 'center', lineHeight: 1.55 }}>
              {t('adminDeviceRegisterPage.noTokenExplainer', 'This device is not registered for admin access. If you are signed in as an administrator, send yourself a registration link and open it on this device.')}
            </p>
          ) : (
            <p style={{ fontSize: '0.9375rem', color: 'var(--ink-3)' }}>
              {t('adminDeviceRegisterPage.linkExpired', 'That link is expired or already used. Send yourself a new one below.')}
            </p>
          )}

          <button
            disabled={passkeyBusy}
            onClick={() => void registerWithPasskey()}
            style={{
              marginTop: 14, minHeight: 44, padding: '11px 20px', borderRadius: 9999,
              border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--ink-on-accent)',
              fontFamily: 'var(--f-b)', fontSize: '0.9375rem', fontWeight: 600,
              cursor: passkeyBusy ? 'default' : 'pointer', opacity: passkeyBusy ? 0.6 : 1,
            }}
            type="button"
          >
            {passkeyBusy
              ? t('adminDeviceRegisterPage.passkeyChecking', 'Waiting for your passkey…')
              : t('adminDeviceRegisterPage.passkeyRegister', 'Register this device with your passkey')}
          </button>
          {passkeyMsg && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--danger)', marginTop: 10, maxWidth: 460, textAlign: 'center' }}>{passkeyMsg}</p>
          )}

          {reissue === 'sent' ? (
            <p style={{ fontSize: '0.9375rem', color: 'var(--success)', maxWidth: 460, textAlign: 'center' }}>
              {t('adminDeviceRegisterPage.reissueSent', 'Link sent to {email}. It expires in 20 minutes — open it on this device.').replace('{email}', reissueMsg)}
            </p>
          ) : (
            <button
              disabled={reissue === 'sending'}
              onClick={requestNewLink}
              style={{
                marginTop: 14, minHeight: 44, padding: '11px 20px', borderRadius: 9999,
                border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent-text)',
                fontFamily: 'var(--f-b)', fontSize: '0.9375rem', fontWeight: 600,
                cursor: reissue === 'sending' ? 'default' : 'pointer', opacity: reissue === 'sending' ? 0.6 : 1,
              }}
              type="button"
            >
              {reissue === 'sending'
                ? t('adminDeviceRegisterPage.reissueSending', 'Sending…')
                : t('adminDeviceRegisterPage.reissueSend', 'Lost your passkey? Email me a registration link')}
            </button>
          )}

          {reissue === 'failed' && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--danger)', marginTop: 10, maxWidth: 460, textAlign: 'center' }}>{reissueMsg}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Wrapped in Suspense because `useSearchParams()` requires it.
 *
 * Two things made this screen render as a completely blank page — header,
 * footer, nothing in between — for an administrator who is simply signing in
 * on a new device:
 *
 * 1. `status` starts as 'pending' and the render had NO branch for it, so the
 *    first paint was empty by construction. Every other state was handled.
 * 2. `useSearchParams()` in a client component suspends. With no boundary of
 *    its own the nearest fallback is whatever the tree above provides, which
 *    here renders nothing.
 *
 * Neither is cosmetic. This is the only screen that can re-register an admin
 * device, so a blank render is a hard lockout from `/admin` with no visible
 * way forward — and the button that fixes it was sitting in the DOM-less
 * branch the whole time.
 */
export default function AdminDeviceRegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'var(--f-b)', background: 'var(--bg)', color: 'var(--ink)' }}>
          <p>Checking this device…</p>
        </div>
      }
    >
      <AdminDeviceRegisterInner />
    </Suspense>
  );
}
