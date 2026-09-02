'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminReauthPrompt } from '@/components/AdminReauthPrompt';
import { useI18n } from '@/components/I18nProvider';

interface Ad {
  id: string;
  title: string;
  scope: string;
  audioUrl: string | null;
  audioDurationSecs: number | null;
  clickUrl: string | null;
  status: string;
  impressions: number;
  budgetCents: number;
  spentCents: number;
  createdAt: Date;
  slot: { name: string } | null;
  advertiser: { name: string | null; email: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'success',
  REJECTED: 'error',
  PENDING: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAUSED: 'warning',
  CANCELLED: '',
};

interface Props {
  ads: Ad[];
  status: string;
  q: string;
  page: number;
  total: number;
  pageSize: number;
}

export function AdminAdsClient({ ads: initial, status, q, page, total, pageSize }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [ads, setAds] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [reauth, setReauth] = useState<{ id: string; status: 'APPROVED' | 'REJECTED' } | null>(null);
  const [error, setError] = useState('');

  const pages = Math.ceil(total / pageSize);

  const navigate = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(page), ...overrides });
    router.push(`/admin/ads?${params}`);
  }, [status, q, page, router]);

  async function updateStatus(id: string, newStatus: 'APPROVED' | 'REJECTED') {
    setLoading(id);
    setReauth(null);
    setError('');

    const res = await fetch('/api/admin/ads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    const payload = await res.json().catch(() => ({}));

    if (res.ok) {
      // Approving stores AWAITING_PAYMENT, not APPROVED — the campaign only
      // goes live once the advertiser pays through Stripe Checkout. Reflect
      // what the server actually stored rather than the requested status.
      const stored = typeof payload?.ad?.status === 'string' ? payload.ad.status : newStatus;
      setAds(prev => prev.map(a => a.id === id ? { ...a, status: stored } : a));
    } else if (payload.requiresReauth) {
      setReauth({ id, status: newStatus });
    } else {
      setError(typeof payload.error === 'string' ? payload.error : 'Action failed.');
    }

    setLoading(null);
  }

  return (
    <div>
      {reauth ? (
        <AdminReauthPrompt
          onCancel={() => setReauth(null)}
          onSuccess={() => {
            const pending = reauth;
            setReauth(null);
            void updateStatus(pending.id, pending.status);
          }}
        />
      ) : null}
      {error ? <small className="status-note status-note-error">{error}</small> : null}
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input
          defaultValue={q}
          placeholder={t('adminAdsClient.searchPlaceholder', 'Search campaign title or link…')}
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          onKeyDown={e => { if (e.key === 'Enter') navigate({ q: (e.target as HTMLInputElement).value, page: '1' }); }}
          onChange={e => { if (!e.target.value) navigate({ q: '', page: '1' }); }}
        />
        <select
          defaultValue={status}
          className="input"
          style={{ width: 160 }}
          onChange={e => navigate({ status: e.target.value, page: '1' })}
        >
          <option value="">{t('adminAdsClient.statusAll', 'All statuses')}</option>
          <option value="PENDING">{t('adminAdsClient.statusPending', 'Pending review')}</option>
          <option value="APPROVED">{t('adminAdsClient.statusApproved', 'Approved')}</option>
          <option value="REJECTED">{t('adminAdsClient.statusRejected', 'Rejected')}</option>
          <option value="PAUSED">{t('adminAdsClient.statusPaused', 'Paused')}</option>
          <option value="CANCELLED">{t('adminAdsClient.statusCancelled', 'Cancelled')}</option>
        </select>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ads.length === 0 && <p className="empty">{t('adminAdsClient.noCampaigns', 'No campaigns found.')}</p>}
        {ads.map((ad) => (
          <div className="panel" key={ad.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{ad.title}</strong>
                <span className="meta" style={{ marginLeft: 8 }}>{ad.slot?.name ?? ad.scope}</span>
                {ad.advertiser?.email && <span className="meta" style={{ marginLeft: 8 }}>· {ad.advertiser.name ?? ad.advertiser.email}</span>}
              </div>
              <span className={`badge ${STATUS_COLORS[ad.status] ?? ''}`}>{ad.status}</span>
            </div>
            {ad.clickUrl && (
              <p className="meta">
                <a href={ad.clickUrl} rel="noopener noreferrer" target="_blank">{ad.clickUrl}</a>
              </p>
            )}
            {ad.audioUrl ? (
              <audio controls preload="none" src={ad.audioUrl} style={{ height: 32, maxWidth: 320 }} />
            ) : (
              <p className="meta">{t('adminAdsClient.noAudio', 'No ad audio uploaded.')}</p>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span className="meta">{new Date(ad.createdAt).toLocaleString()}</span>
              {typeof ad.audioDurationSecs === 'number' && <span className="meta">:{ad.audioDurationSecs}</span>}
              {/* No clicks stat: an audio spot has no click-through, nothing in
                  the codebase ever incremented Ad.clicks, and this rendered a
                  permanent 0 next to a real impression count — which reads as
                  "nobody clicked", not "there is nothing to click".
                  /advertise/dashboard dropped it for the same reason. */}
              <span className="meta">{ad.impressions.toLocaleString()} {t('adminAdsClient.impressions', 'impressions')}</span>
              <span className="meta">${((ad.budgetCents - ad.spentCents) / 100).toFixed(2)} {t('adminAdsClient.budgetRemaining', 'budget remaining')}</span>
            </div>
            {ad.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="button small" disabled={loading === ad.id} onClick={() => updateStatus(ad.id, 'APPROVED')}>{t('adminAdsClient.approve', 'Approve')}</button>
                <button className="button small secondary" disabled={loading === ad.id} onClick={() => updateStatus(ad.id, 'REJECTED')}>{t('adminAdsClient.reject', 'Reject')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {page > 1 && <button className="button small secondary" onClick={() => navigate({ page: String(page - 1) })}>← Prev</button>}
          <span className="meta">Page {page} of {pages} · {total} total</span>
          {page < pages && <button className="button small secondary" onClick={() => navigate({ page: String(page + 1) })}>Next →</button>}
        </div>
      )}
    </div>
  );
}
