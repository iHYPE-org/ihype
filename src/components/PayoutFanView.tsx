'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PAYOUT_HOLD_DAYS } from '@/lib/payout-release';
import { stripeCutOf } from '@/lib/stripe-fees';
import { VENUE_SHARE_PERCENT } from '@/lib/ticketing';

/* One ticket at the terms in force since 2026-09-25: Stripe's card fee comes
   off the face value first, then 75% to the artist and 25% to the venue, 0%
   to iHYPE. There is no promoter share. The fee is an estimate at the
   standard US card rate on a one-ticket order; tax is added for the buyer and
   is never part of the split. */
export function PayoutFanView({ priceCents }: { priceCents: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const feeShare = stripeCutOf(priceCents);
  const netCents = Math.max(0, priceCents - feeShare);
  const venueShare = Math.round(netCents * (VENUE_SHARE_PERCENT / 100));
  const artistShare = netCents - venueShare;

  return (
    <div className="payout-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--line, var(--hair-80))', borderRadius: 18, padding: '1.5rem', marginBottom: '1.25rem' }}>
      <button
        className="payout-fanview-toggle"
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ink)' }}
        type="button"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}>{t('payoutFanView.title', 'What each fan sees')}</span>
        </div>
        <svg style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.75" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {expanded && (
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line, var(--hair-80))', background: 'var(--bg-3, var(--bg))' }}>
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 10 }}>
            {t('payoutFanView.intro', 'Every fan who bought a ticket sees this same breakdown. Their receipt shows:')}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>{t('payoutFanView.yourLabel', 'Your')} {fmt(priceCents)}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{fmt(feeShare)} {t('payoutFanView.stripeFeeLabel', 'Stripe card fee')} · {fmt(artistShare)} {t('payoutFanView.artistLabel', 'artist')} · {fmt(venueShare)} {t('payoutFanView.venueLabel', 'venue')} · $0 {t('payoutFanView.ihypeLabel', 'iHYPE')}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }} />
              {/* The fee is Stripe's, estimated at the standard US card rate,
                  and it comes off the face value before the split — the buyer
                  pays the ticket price plus tax and nothing else. */}
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.5 }}>{t('payoutFanView.feeOffTheTop', 'Stripe’s card fee comes off the face value first (estimated at the standard US card rate); the rest splits 75% to the artist and 25% to the venue. The buyer pays the ticket price plus tax and nothing else.')}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>{t('payoutFanView.ihypeFeeLabel', 'iHYPE fee')}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--role-venue)', lineHeight: 1.5 }}>{t('payoutFanView.ihypeFeeValue', '$0.00 — locked in our charter. Forever.')}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>{t('payoutFanView.paidOutLabel', 'Paid out')}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {/* "Same night" was the behaviour until 2026-08-27, when
                    PAYOUT_HOLD_DAYS was introduced so a card dispute arriving
                    the morning after has something left to reverse. The sentence
                    outlived the behaviour by three weeks on the one page whose
                    job is explaining the money. */}
                {t('payoutFanView.paidOutValue2', 'Automatically, about {days} days after the show.')
                  .replace('{days}', String(PAYOUT_HOLD_DAYS))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
