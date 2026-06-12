'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Ad {
  id: string;
  advertiserName: string;
  advertiserType: string;
  campaignWebsite: string;
  adTextCopy: string;
  status: string;
  aiReasoning: string | null;
  impressions: number;
  clicks: number;
  tier: string;
  createdAt: Date;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'success',
  rejected: 'error',
  manual_review: 'warning',
  pending: 'info',
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
  const router = useRouter();
  const [ads, setAds] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  const pages = Math.ceil(total / pageSize);

  const navigate = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(page), ...overrides });
    router.push(`/admin/ads?${params}`);
  }, [status, q, page, router]);

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected') {
    setLoading(id);
    const res = await fetch('/api/admin/ads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (res.ok) setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    setLoading(null);
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input
          defaultValue={q}
          placeholder="Search advertiser or URL…"
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
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="manual_review">Manual review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ads.length === 0 && <p className="empty">No submissions found.</p>}
        {ads.map((ad) => (
          <div className="panel" key={ad.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{ad.advertiserName}</strong>
                <span className="meta" style={{ marginLeft: 8 }}>{ad.advertiserType}</span>
                <span className="meta" style={{ marginLeft: 8 }}>· {ad.tier}</span>
              </div>
              <span className={`badge ${STATUS_COLORS[ad.status] ?? ''}`}>{ad.status}</span>
            </div>
            <p className="meta">
              <a href={ad.campaignWebsite} rel="noopener noreferrer" target="_blank">{ad.campaignWebsite}</a>
            </p>
            <p>&ldquo;{ad.adTextCopy}&rdquo;</p>
            {ad.aiReasoning && <p className="meta">AI: {ad.aiReasoning}</p>}
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="meta">{new Date(ad.createdAt).toLocaleString()}</span>
              <span className="meta">{ad.impressions.toLocaleString()} impressions</span>
              <span className="meta">{ad.clicks.toLocaleString()} clicks</span>
              {ad.impressions > 0 && <span className="meta">CTR {((ad.clicks / ad.impressions) * 100).toFixed(1)}%</span>}
            </div>
            {(ad.status === 'manual_review' || ad.status === 'pending') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="button small" disabled={loading === ad.id} onClick={() => updateStatus(ad.id, 'approved')}>Approve</button>
                <button className="button small secondary" disabled={loading === ad.id} onClick={() => updateStatus(ad.id, 'rejected')}>Reject</button>
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
