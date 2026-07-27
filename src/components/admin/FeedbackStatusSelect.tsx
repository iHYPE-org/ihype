'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const STATUSES = ['open', 'planned', 'shipped', 'declined'] as const;

interface FeedbackStatusSelectProps {
  id: string;
  status: string;
}

export function FeedbackStatusSelect({ id, status: initialStatus }: FeedbackStatusSelectProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function updateStatus(next: string) {
    const prev = status;
    setStatus(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev);
    } catch {
      setStatus(prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      className="input"
      value={status}
      disabled={loading}
      onChange={(e) => updateStatus(e.target.value)}
      style={{ width: 120 }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{t(`feedbackStatusSelect.status.${s}`, s)}</option>
      ))}
    </select>
  );
}
