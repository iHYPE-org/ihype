'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';

export function QuizNotificationSetting() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/music-quizzes/preferences', { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error('Unable to load'); return r.json(); })
      .then((v) => { if (active) setEnabled(v.enabled === true); })
      .catch(() => { if (active) setMessage(t('quizSettings.loadFailed', 'Quiz notification preference could not be loaded.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);
  async function update(next: boolean) {
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/music-quizzes/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEnabled(next);
      setMessage(t('quizSettings.saved', 'Quiz notification preference saved.'));
    } catch {
      setMessage(t('quizSettings.saveFailed', 'Could not save your quiz preference.'));
    } finally { setBusy(false); }
  }
  return <div>
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px' }}>
      <span><strong>{t('quizSettings.label', 'Music trivia notifications')}</strong><span style={{ display: 'block' }}>{t('quizSettings.detail', 'Optional quiz invitations. Off by default; you can play without alerts.')}</span></span>
      <input aria-label={t('quizSettings.label', 'Music trivia notifications')} type="checkbox" checked={enabled} disabled={loading || busy} onChange={(e) => void update(e.target.checked)} />
    </label>
    <p style={{ padding: '0 20px' }}><Link href="/app/music-quiz">{t('quizSettings.play', 'Play music trivia')}</Link></p>
    <p role="status" aria-live="polite" style={{ padding: '0 20px' }}>{message}</p>
  </div>;
}
