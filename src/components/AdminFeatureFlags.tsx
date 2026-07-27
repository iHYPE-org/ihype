'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

type Flag = { key: string; label: string; enabled: boolean };

export function AdminFeatureFlags({ initialFlags }: { initialFlags: Flag[] }) {
  const { t } = useI18n();
  const [flags, setFlags] = useState<Flag[]>(initialFlags);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function toggle(flag: Flag) {
    setPending(flag.key);
    setError('');
    const next = !flag.enabled;
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag: flag.key, enabled: next })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : t('adminFeatureFlags.updateFailed', 'Update failed.'));
      }
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminFeatureFlags.updateFailed', 'Update failed.'));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="admin-list">
      {flags.map((flag) => (
        <div className="admin-list-row" key={flag.key} style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{flag.label}</span>
          <button
            type="button"
            className={`button small ${flag.enabled ? '' : 'secondary'}`}
            disabled={pending === flag.key}
            onClick={() => toggle(flag)}
          >
            {pending === flag.key ? '...' : flag.enabled ? t('adminFeatureFlags.enabled', 'Enabled') : t('adminFeatureFlags.off', 'Off')}
          </button>
        </div>
      ))}
      {error ? <p className="status-note status-note-error">{error}</p> : null}
    </div>
  );
}
