'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

export default function AdminDeviceRegisterPage() {
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
      {status === 'registering' && <p>{t('adminDeviceRegisterPage.registering', 'Registering this device…')}</p>}
      {status === 'done' && <p style={{ color: 'var(--success)' }}>{t('adminDeviceRegisterPage.done', 'Device registered. Redirecting to admin…')}</p>}
      {status === 'error' && (
        <>
          <p style={{ color: 'var(--danger)' }}>{t('adminDeviceRegisterPage.errorPrefix', 'Error:')} {errorMsg}</p>
          {!token ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-3)', maxWidth: 460, textAlign: 'center', lineHeight: 1.55 }}>
              {t('adminDeviceRegisterPage.noTokenExplainer', 'This device is not registered for admin access. If you are signed in as an administrator, send yourself a registration link and open it on this device.')}
            </p>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-3)' }}>
              {t('adminDeviceRegisterPage.linkExpired', 'That link is expired or already used. Send yourself a new one below.')}
            </p>
          )}

          {reissue === 'sent' ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--success)', maxWidth: 460, textAlign: 'center' }}>
              {t('adminDeviceRegisterPage.reissueSent', 'Link sent to {email}. It expires in 20 minutes — open it on this device.').replace('{email}', reissueMsg)}
            </p>
          ) : (
            <button
              disabled={reissue === 'sending'}
              onClick={requestNewLink}
              style={{
                marginTop: 14, minHeight: 44, padding: '11px 20px', borderRadius: 9999,
                border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent-text)',
                fontFamily: 'var(--f-b)', fontSize: '0.875rem', fontWeight: 600,
                cursor: reissue === 'sending' ? 'default' : 'pointer', opacity: reissue === 'sending' ? 0.6 : 1,
              }}
              type="button"
            >
              {reissue === 'sending'
                ? t('adminDeviceRegisterPage.reissueSending', 'Sending…')
                : t('adminDeviceRegisterPage.reissueSend', 'Email me a registration link')}
            </button>
          )}

          {reissue === 'failed' && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: 10, maxWidth: 460, textAlign: 'center' }}>{reissueMsg}</p>
          )}
        </>
      )}
    </div>
  );
}
