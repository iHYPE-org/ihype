'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface ReferralStats {
  clicks: number;
  signups: number;
  ticketSales: number;
  grossRevenueCents: number;
  estimatedCommissionCents: number;
}

interface ReferralInfo {
  referralLink: string;
  shareText: string;
}

const statBox: React.CSSProperties = {
  background: 'var(--hair-30)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: 16,
  textAlign: 'center',
};

export function PagesReferralTab() {
  const { t } = useI18n();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [ageGated, setAgeGated] = useState(false);

  useEffect(() => {
    fetch('/api/referral')
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 403 && d.code === 'AGE_18_REQUIRED') setAgeGated(true);
        else if (r.ok) setInfo(d);
      })
      .catch(() => {});
    fetch('/api/referrals/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const link = info?.referralLink ?? '';

  if (ageGated) {
    return (
      <div style={{ background: 'rgba(var(--role-fan-rgb),.06)', border: '1px solid rgba(var(--role-fan-rgb),.18)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--role-fan)', marginBottom: 10 }}>
          {t('pagesReferralTab.ageGateBadge', 'HYPE Link · 18+')}
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-a75)', lineHeight: 1.6, margin: '0 0 16px' }}>
          {t('pagesReferralTab.ageGateBody', "Referral links are for members 18 and older. If that's you, confirm your age once in Settings and your HYPE Link unlocks right away.")}
        </p>
        <Link className="ihype-btn-primary" href="/me/settings">{t('pagesReferralTab.ageGateCta', 'Confirm my age in Settings')}</Link>
      </div>
    );
  }

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-a35)', marginBottom: 14 }}>
        {t('pagesReferralTab.sectionLabel', 'HYPE LINK')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
        <div style={statBox}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
            {stats ? money(stats.estimatedCommissionCents) : '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('pagesReferralTab.estEarned', 'Est. earned')}</div>
        </div>
        <div style={statBox}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
            {stats?.ticketSales ?? '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('pagesReferralTab.ticketsDriven', 'Tickets driven')}</div>
        </div>
        <div style={statBox}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-.02em', marginBottom: 5 }}>
            {stats?.clicks ?? '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-a50)' }}>{t('pagesReferralTab.clicks', 'Clicks')}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(var(--role-fan-rgb),.06)', border: '1px solid rgba(var(--role-fan-rgb),.18)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--role-fan)', marginBottom: 12 }}>
          {t('pagesReferralTab.linkSectionLabel', 'Your HYPE Link · your unique fan ID — earn on every ticket you drive')}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1, background: 'var(--hair-40)', border: '1px solid var(--hair-80)', borderRadius: 9, padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-a70)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link || t('pagesReferralTab.loading', 'Loading…')}
          </div>
          <button onClick={copy} className="ihype-btn-primary" style={{ flexShrink: 0 }}>
            {copied ? t('pagesReferralTab.copied', 'Copied') : t('pagesReferralTab.copy', 'Copy')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="ihype-btn-ghost" href={`sms:?body=${encodeURIComponent(info?.shareText ?? '')}`}>{t('pagesReferralTab.shareMessage', 'Message')}</a>
          <a className="ihype-btn-ghost" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(info?.shareText ?? '')}`}>{t('pagesReferralTab.shareTwitter', 'Twitter / X')}</a>
          <a className="ihype-btn-ghost" href={`mailto:?subject=${encodeURIComponent('Join me on iHYPE')}&body=${encodeURIComponent(info?.shareText ?? '')}`}>{t('pagesReferralTab.shareEmail', 'Email')}</a>
        </div>
      </div>
    </div>
  );
}
