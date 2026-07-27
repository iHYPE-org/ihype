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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', color: '#111' }}>
      {status === 'registering' && <p>{t('adminDeviceRegisterPage.registering', 'Registering this device…')}</p>}
      {status === 'done' && <p style={{ color: 'green' }}>{t('adminDeviceRegisterPage.done', 'Device registered. Redirecting to admin…')}</p>}
      {status === 'error' && (
        <>
          <p style={{ color: 'red' }}>{t('adminDeviceRegisterPage.errorPrefix', 'Error:')} {errorMsg}</p>
          <p style={{ fontSize: 14, color: '#666' }}>{t('adminDeviceRegisterPage.requestNewLink', 'Request a new setup link from admin@ihype.org.')}</p>
        </>
      )}
    </div>
  );
}
