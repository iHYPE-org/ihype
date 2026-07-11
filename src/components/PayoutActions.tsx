'use client';

export function PayoutActions({ title }: { title: string }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${title} · Payout receipt`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert('Receipt link copied to clipboard.');
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={() => window.print()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--line, rgba(255,255,255,.1))', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8rem', background: 'transparent', color: 'var(--ink)', padding: '9px 18px' }}
        type="button"
      >
        Download PDF
      </button>
      <button
        onClick={share}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.8rem', background: '#ff5029', color: '#fff', padding: '9px 18px', boxShadow: '0 4px 20px rgba(255,80,41,.3)' }}
        type="button"
      >
        Share receipt
      </button>
    </div>
  );
}
