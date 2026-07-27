'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type TestResult = {
  ok: boolean;
  durationMs: number;
  userCreated: boolean;
  profileCreated: boolean;
  magicLinkVerified: boolean;
};

export function AdminSignupTestPanel() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  async function runTest() {
    setBusy(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/admin/signup-test', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : t('adminSignupTestPanel.testFailed', 'Signup QA test failed.'));
      }
      setResult(payload as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminSignupTestPanel.testFailed', 'Signup QA test failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-signup-test">
      <button className="button small secondary" disabled={busy} onClick={runTest} type="button">
        {busy ? t('adminSignupTestPanel.running', 'Running signup test...') : t('adminSignupTestPanel.run', 'Run signup QA')}
      </button>
      {result ? (
        <span className={result.ok ? 'admin-inline-ok' : 'admin-inline-warn'}>
          {result.ok ? t('adminSignupTestPanel.passed', 'Passed') : t('adminSignupTestPanel.failed', 'Failed')} {t('adminSignupTestPanel.inMs', 'in')} {result.durationMs}ms
        </span>
      ) : null}
      {error ? <span className="admin-inline-warn">{error}</span> : null}
    </div>
  );
}
