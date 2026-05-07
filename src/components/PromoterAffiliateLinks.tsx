'use client';

import { useState } from 'react';

type AffiliateShow = {
  slug: string;
  title: string;
  startsAt: Date | string;
  venueName: string | null;
};

function CopyLinkRow({ show, affiliateUrl }: { show: AffiliateShow; affiliateUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  }

  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(show.startsAt));

  return (
    <div
      className="panel"
      style={{
        padding: '1rem 1.25rem',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '0.75rem',
        alignItems: 'center'
      }}
    >
      <div>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 600 }}>{show.title}</p>
        <p className="meta" style={{ margin: 0 }}>
          {date}
          {show.venueName ? ` · ${show.venueName}` : ''}
        </p>
        <p
          className="meta"
          style={{
            margin: '0.35rem 0 0',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            wordBreak: 'break-all',
            color: 'var(--muted)'
          }}
        >
          {affiliateUrl}
        </p>
      </div>
      <button
        className={`button small ${copied ? '' : 'secondary'}`}
        onClick={handleCopy}
        style={{ whiteSpace: 'nowrap', minWidth: '80px' }}
      >
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
    </div>
  );
}

export function PromoterAffiliateLinks({
  shows,
  promoterHexId
}: {
  shows: AffiliateShow[];
  promoterHexId: string;
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ihype.com';

  if (shows.length === 0) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="meta">No active shows to generate affiliate links for.</p>
        <p className="meta" style={{ marginTop: '0.5rem' }}>
          Create a show first, then return here to get your shareable affiliate links.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      {shows.map((show) => (
        <CopyLinkRow
          key={show.slug}
          show={show}
          affiliateUrl={`${origin}/shows/${show.slug}?ref=${promoterHexId}`}
        />
      ))}
    </div>
  );
}
