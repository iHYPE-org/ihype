'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SETTLEMENT_DAYS_AFTER_SHOW } from '@/lib/split-agreement';

/* One ticket at the terms in force since 2026-09-27 (DESIGN_SYNC row 528):
   the venue sells it through its own Stripe account and keeps the whole
   charge, then pays each act directly under the Show Revenue Split Agreement
   that act signed. There is no fixed split to compute here — percentages are
   per offer — so this view names none. iHYPE takes 0%. */
export function PayoutFanView({ priceCents }: { priceCents: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{t('payoutFanView.toTheVenue', 'to the venue that sold it')} · $0 {t('payoutFanView.ihypeLabel', 'iHYPE')}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }} />
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.5 }}>{t('payoutFanView.venuePaysActs', 'The venue keeps the charge and pays each act under the split agreement that act signed before sales opened. The buyer pays the ticket price plus tax and nothing else.')}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>{t('payoutFanView.ihypeFeeLabel', 'iHYPE fee')}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--role-venue)', lineHeight: 1.5 }}>{t('payoutFanView.ihypeFeeValue', '$0.00 — locked in our charter. Forever.')}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', flexShrink: 0, minWidth: 90 }}>{t('payoutFanView.paidOutLabel', 'Paid out')}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {/* The Settlement Date: the venue pays each act within
                    SETTLEMENT_DAYS_AFTER_SHOW days (Split Agreement). Read the
                    number off the constant, never off this comment. */}
                {t('payoutFanView.paidOutByVenue', 'By the venue, directly to each act, within {days} days of the show.')
                  .replace('{days}', String(SETTLEMENT_DAYS_AFTER_SHOW))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
