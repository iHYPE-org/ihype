'use client';
import { useState, use } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

export default function ScanPage() {
  const { t } = useI18n();
  const params = useParams<{ slug: string }>();
  const [ticketId, setTicketId] = useState('');
  const [result, setResult] = useState<{ ok?: boolean; error?: string; ticket?: { holderName?: string; scannedAt?: string } } | null>(null);
  const [loading, setLoading] = useState(false);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    const showRes = await fetch(`/api/shows/${params.slug}`);
    if (!showRes.ok) { setResult({ error: t('showsSlugScanPage.showNotFound', 'Show not found.') }); setLoading(false); return; }
    const { id } = await showRes.json();
    const r = await fetch(`/api/shows/${id}/scan`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ticketId }) });
    const d = await r.json();
    setResult(d); setLoading(false);
    if (d.ok) setTicketId('');
  }

  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1 className="title">{t('showsSlugScanPage.ticketScanner', 'Ticket Scanner')}</h1>
      <form onSubmit={scan} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input autoFocus className="input" placeholder={t('showsSlugScanPage.ticketIdPlaceholder', 'Ticket ID or scan QR')} value={ticketId} onChange={e => setTicketId(e.target.value)} required />
        <button className="button" disabled={loading} type="submit">{loading ? t('showsSlugScanPage.checking', 'Checking…') : t('showsSlugScanPage.scan', 'Scan')}</button>
      </form>
      {result && (
        <div className={`callout ${result.ok ? 'success' : 'error'}`} style={{ marginTop: 16 }}>
          {result.ok ? `${t('showsSlugScanPage.validPrefix', '✓ Valid —')} ${result.ticket?.holderName ?? t('showsSlugScanPage.guest', 'Guest')}` : result.error}
        </div>
      )}
    </div>
  );
}
