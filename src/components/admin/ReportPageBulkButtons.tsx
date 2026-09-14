'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

/**
 * "Dismiss all on page" for the admin reports queue. "Resolve all on page"
 * went on 2026-09-14 (DESIGN_SYNC row 458): it marked a page of reports
 * RESOLVED and removed nothing, so the queue could be cleared without any
 * content going anywhere. Removal is per report, through ModerationActions.
 *
 * Replaces a plain <form method="post"> in the (server-rendered) review page
 * that was doubly broken: it attached an onClick to a submit button, which a
 * Server Component cannot do (crashed the whole page with an RSC
 * serialization error whenever open reports existed), and it posted
 * urlencoded form data to /api/admin/bulk-actions, which only parses JSON.
 */
export function ReportPageBulkButtons({ ids }: { ids: string[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReauth, setPendingReauth] = useState<string | null>(null);

  async function run(action: 'dismiss_reports') {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch('/api/admin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; requiresReauth?: boolean };
      if (data.requiresReauth) {
        setPendingReauth(action);
      } else if (data.ok) {
        router.refresh();
      } else {
        setError(data.error ?? t('reportPageBulkButtons.unknownError', 'Unknown error'));
      }
    } catch {
      setError(t('reportPageBulkButtons.requestFailed', 'Request failed'));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        disabled={loading !== null}
        onClick={() => void run('dismiss_reports')}
        type="button"
        style={{ background: 'var(--line)', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 14px', fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'var(--f-m)' }}
      >
        {loading === 'dismiss_reports' ? t('reportPageBulkButtons.dismissing', 'Dismissing…') : t('reportPageBulkButtons.dismissAllOnPage', 'Dismiss all on page')}
      </button>
      {error && <span style={{ fontSize: '0.9375rem', color: 'var(--danger)', fontFamily: 'var(--f-m)' }}>{error}</span>}
      {pendingReauth && (
        <AdminReauthPrompt
          onCancel={() => setPendingReauth(null)}
          onSuccess={() => {
            const action = pendingReauth as 'dismiss_reports';
            setPendingReauth(null);
            void run(action);
          }}
        />
      )}
    </div>
  );
}
