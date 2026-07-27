'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

export function ShowRecapForm({ showId, initialRecap }: { showId: string; initialRecap?: string | null }) {
  const { t } = useI18n();
  const [text, setText] = useState(initialRecap ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`/api/shows/${showId}/recap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recapText: text })
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? t('showRecapForm.saveFailedError', 'Failed to save recap.'));
        setStatus('error');
      } else {
        setStatus('saved');
      }
    } catch {
      setErrorMsg(t('showRecapForm.networkError', 'Network error. Please try again.'));
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="form-label">
        {t('showRecapForm.label', 'Show recap')}
        <textarea
          className="input"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('showRecapForm.placeholder', 'Share how the show went — highlights, moments, thank-yous…')}
          style={{ resize: 'vertical' }}
          maxLength={5000}
        />
      </label>
      {status === 'error' && <p style={{ color: 'var(--accent)' }}>{errorMsg}</p>}
      {status === 'saved' && <p style={{ color: '#22e5d4' }}>{t('showRecapForm.savedMessage', 'Recap saved.')}</p>}
      <button className="button small" type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? t('showRecapForm.saving', 'Saving…') : t('showRecapForm.saveButton', 'Save recap')}
      </button>
    </form>
  );
}
