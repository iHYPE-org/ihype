'use client';

import Link from 'next/link';
import { useState } from 'react';

export type MarketingSeedPreviewItem = {
  name: string;
  detail: string;
  genre: string;
  hype: number;
};

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: value > 999 ? 'compact' : 'standard' }).format(value);
}

export function MarketingSeedsPreview({ seeds }: { seeds: MarketingSeedPreviewItem[] }) {
  const [action, setAction] = useState('');

  return (
    <section className="lp-seed-preview" aria-label="Seeds preview">
      <div className="lp-seed-preview-copy">
        <p className="lp-section-eyebrow">SEEDS PREVIEW</p>
        <h2 className="lp-section-head">The product shows up before the manifesto.</h2>
        <p className="lp-hype-intro">
          Seeds turn the first listen into a clean choice: save the track, hype it after a real listen,
          or skip into the next scene without punishing the artist for a cold algorithmic start.
        </p>
        <div className="lp-seed-actions">
          {['Save', 'Hype', 'Skip'].map((label) => (
            <button key={label} onClick={() => setAction(label)} type="button">
              {label}
            </button>
          ))}
        </div>
        {action ? (
          <p className="lp-seed-response">
            {action} recorded for the preview. <Link href="/register">Join free</Link> to keep building your queue.
          </p>
        ) : null}
      </div>
      <div className="lp-seed-deck">
        {seeds.map((seed, index) => (
          <article className="lp-seed-card" key={`${seed.name}-${index}`}>
            <div>
              <span className="lp-seed-badge">{seed.genre}</span>
              <strong>{seed.name}</strong>
              <p>{seed.detail}</p>
            </div>
            <span>{formatCompact(seed.hype)} hype</span>
          </article>
        ))}
      </div>
    </section>
  );
}
