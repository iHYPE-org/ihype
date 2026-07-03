'use client';

import { useState } from 'react';
import Link from 'next/link';

type Kind = 'deletion' | 'detach' | 'hype-wipe';

const DONE_LABEL: Record<Kind, string> = {
  deletion: 'Account deletion requested — we’ll email you to confirm within 24h.',
  detach: 'Identity detached — your email verification link has been deleted.',
  'hype-wipe': 'Hype history wiped — your past votes have been cleared.',
};

export function SupportPrivacyPanel({ onReportProblem }: { onReportProblem: () => void }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Kind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  function close() {
    setOpen(false);
    setDone(null);
    setError(null);
  }

  async function submitKind(kind: Kind) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/privacy/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Request failed');
        return;
      }
      setDone(kind);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/privacy/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ihype-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed — try again or contact support.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        role="button"
        style={{
          border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '18px 20px',
          background: 'var(--bg-2, #100d09)', cursor: 'pointer',
        }}
        tabIndex={0}
      >
        <div aria-hidden="true" style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 4 }}>Privacy</div>
        <div style={{ fontSize: 12, color: 'rgba(240,235,229,.55)' }}>Report a problem, data deletion, identity detachment</div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && close()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        >
          <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-2, #100d09)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 26, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>Privacy &amp; your data</h2>
              <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', color: 'rgba(240,235,229,.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(240,235,229,.55)', marginBottom: 20 }}>
              You control your data. iHYPE never sells PII — locked in our charter.
            </p>

            {done ? (
              <div style={{ fontSize: 13, color: '#22e5d4', padding: '10px 14px', background: 'rgba(34,229,212,.08)', borderRadius: 8 }}>
                ✓ {DONE_LABEL[done]}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => { close(); onReportProblem(); }}
                  className="priv-opt"
                  style={privOptStyle}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">🚩</span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Report a problem</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>Flag a privacy or data-handling concern</span>
                  </span>
                </button>

                <button
                  onClick={() => submitKind('deletion')}
                  disabled={submitting}
                  className="priv-opt"
                  style={{ ...privOptStyle, borderColor: 'rgba(255,80,41,.25)' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">🗑️</span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Request data deletion</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>Permanently erase your account and all data</span>
                  </span>
                </button>

                <button onClick={() => submitKind('detach')} disabled={submitting} className="priv-opt" style={privOptStyle}>
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">⛓️</span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Detach identity early</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>Delete email verification link now instead of after 30 days</span>
                  </span>
                </button>

                <button onClick={downloadExport} disabled={exporting} className="priv-opt" style={privOptStyle}>
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  </span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{exporting ? 'Preparing export…' : 'Download my data'}</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>Export everything iHYPE holds about you</span>
                  </span>
                </button>

                <button onClick={() => submitKind('hype-wipe')} disabled={submitting} className="priv-opt" style={privOptStyle}>
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">🣭</span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Wipe hype history</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>Clear your past hype votes without deleting your account</span>
                  </span>
                </button>

                <Link href="/legal?tab=privacy" className="priv-opt" style={{ ...privOptStyle, textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">📄</span>
                  <span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, marginBottom: 2 }}>Read the privacy policy</span>
                    <span style={{ fontSize: 12, color: 'rgba(240,235,229,.5)' }}>How we collect, use, and protect your data</span>
                  </span>
                </Link>

                {error && <p style={{ color: '#ff5029', fontSize: 12, marginTop: 8 }}>{error}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const privOptStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
  padding: '14px 16px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10,
  background: 'var(--bg, #0a0805)', color: 'inherit', cursor: 'pointer', marginBottom: 10,
  fontFamily: 'var(--font-body)',
};
