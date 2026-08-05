// Moved verbatim from its former standalone route when Trust & Safety,
// Transparency, Privacy and Legal were merged into /info. Every Prisma
// query, the k-anonymity floor and the copy are unchanged — only the
// route wrapper and page metadata were stripped so this can render as
// a panel. The old route is now a redirect.
import '@/app/marketing.css';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';

// Small categories are folded into "Other" rather than shown with an exact
// count, so a bucket of e.g. 1-2 reports can never be used to infer which
// specific piece of content or user was involved. Same k-anonymity floor
// already used for fan cohorts on the Recommend tab.
const K_ANON_FLOOR = 5;

const CATEGORY_LABELS: Record<string, string> = {
  track: 'Track uploads',
  profile: 'Profiles',
  'profile-image': 'Profile images',
  show: 'Shows',
  comment: 'Comments',
  'ad-audio': 'Ad audio spots',
};

export async function TrustSafetyPanel() {
  const t = await getServerT();
  const [
    reportsTotal,
    reportsOpen,
    reportsActioned,
    reportsDismissed,
    reportsByCategory,
    verifiedCount,
    verificationReviewed,
    adTotal,
    adApproved,
    adRejected,
    adManualReview,
  ] = await Promise.all([
    db.contentReport.count(),
    db.contentReport.count({ where: { status: 'OPEN' } }),
    db.contentReport.count({ where: { status: 'ACTIONED' } }),
    db.contentReport.count({ where: { status: 'DISMISSED' } }),
    db.contentReport.groupBy({ by: ['targetType'], _count: { _all: true } }),
    db.profile.count({ where: { isVerified: true } }),
    db.profile.count({ where: { verificationReviewedAt: { not: null } } }),
    db.ad.count(),
    db.ad.count({ where: { status: 'APPROVED' } }),
    db.ad.count({ where: { status: 'REJECTED' } }),
    db.ad.count({ where: { status: 'PENDING' } }),
  ]);

  const categoryLabel = (key: string) => t(`auditPage.category.${key}`, CATEGORY_LABELS[key] ?? key);

  const categoryRows = reportsByCategory
    .map((r) => ({ label: categoryLabel(r.targetType), count: r._count._all }))
    .filter((r) => r.count >= K_ANON_FLOOR)
    .sort((a, b) => b.count - a.count);
  const foldedCount = reportsByCategory
    .filter((r) => r._count._all < K_ANON_FLOOR)
    .reduce((sum, r) => sum + r._count._all, 0);

  const ENFORCEMENT_STATS = [
    { label: t('auditPage.statReportsTotal', 'Reports received (all time)'), val: reportsTotal.toLocaleString(), c: 'var(--accent)' },
    { label: t('auditPage.statReportsOpen', 'Open, awaiting review'), val: reportsOpen.toLocaleString(), c: 'var(--role-fan)' },
    { label: t('auditPage.statReportsActioned', 'Actioned'), val: reportsActioned.toLocaleString(), c: 'var(--role-venue)' },
    { label: t('auditPage.statReportsDismissed', 'Dismissed'), val: reportsDismissed.toLocaleString(), c: 'var(--accent-2)' },
  ];

  const AD_STATS = [
    { label: t('auditPage.statAdTotal', 'Radio ad campaigns vetted'), val: adTotal.toLocaleString(), c: 'var(--accent)' },
    { label: t('auditPage.statAdApproved', 'Approved'), val: adApproved.toLocaleString(), c: 'var(--role-venue)' },
    { label: t('auditPage.statAdManualReview', 'Sent to manual review'), val: adManualReview.toLocaleString(), c: 'var(--role-fan)' },
    { label: t('auditPage.statAdRejected', 'Rejected'), val: adRejected.toLocaleString(), c: 'var(--accent-2)' },
  ];

  return (
    <div className="lp-wrap">
      <style>{`
        @keyframes auditPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .audit-pulse-dot {
          display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          background: var(--warning); margin-right: 8px; animation: auditPulse 1.4s infinite;
        }
      `}</style>
      <section className="lp-hero" style={{ paddingBottom: '20px' }}>
        <p className="lp-hype-eyebrow" style={{ color: 'var(--warning-text)' }}><span className="audit-pulse-dot" />{t('auditPage.eyebrowLiveStats', 'LIVE STATS · UPDATED IN REAL TIME')}</p>
        <h1 className="lp-hero-h" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>{t('auditPage.heroTitle', 'Trust & safety report')}</h1>
        <p className="lp-hero-sub">
          {t('auditPage.heroSub', 'Every upload is screened by AI before it goes live, and every user report is tracked to a resolution. Here are the aggregate numbers — no usernames, no content IDs, nothing that could identify anyone involved.')}
        </p>
      </section>

      <section className="lp-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {ENFORCEMENT_STATS.map((s) => (
          <div key={s.label} className="lp-stat">
            <span className="lp-stat-val" style={{ color: s.c }}>{s.val}</span>
            <span className="lp-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {categoryRows.length > 0 && (
        <section className="lp-hype-explainer">
          <p className="lp-hype-eyebrow" style={{ color: 'var(--accent)' }}>{t('auditPage.eyebrowByCategory', 'BY CATEGORY')}</p>
          <h2 className="lp-section-head">{t('auditPage.byCategoryTitle', 'What gets reported')}</h2>
          <div className="lp-reason-grid" style={{ marginTop: '20px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {categoryRows.map((r) => (
              <div key={r.label} className="lp-reason-card">
                <h3 className="lp-reason-head">{r.count.toLocaleString()}</h3>
                <p className="lp-reason-body">{r.label}</p>
              </div>
            ))}
            {foldedCount > 0 && (
              <div className="lp-reason-card">
                <h3 className="lp-reason-head">{foldedCount.toLocaleString()}</h3>
                <p className="lp-reason-body">{t('auditPage.otherCategory', 'Other (categories too small to break out individually)')}</p>
              </div>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#5a5048', marginTop: '14px', lineHeight: 1.7 }}>
            {t('auditPage.categoryFloorNote', 'Categories with fewer than 5 reports are folded into "Other" — a small count can never identify a specific user or piece of content.')}
          </p>
        </section>
      )}

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: 'var(--accent-2)' }}>{t('auditPage.eyebrowRadioAds', 'RADIO ADS')}</p>
        <h2 className="lp-section-head">{t('auditPage.adVettingTitle', 'Ad vetting')}</h2>
        <p className="lp-hero-sub" style={{ margin: '8px 0 20px' }}>
          {t('auditPage.adVettingBody', 'iHYPE only ever runs radio-style audio ad spots — no banners, no visual placements. Every campaign is screened by AI before it can run.')}
        </p>
        <section className="lp-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {AD_STATS.map((s) => (
            <div key={s.label} className="lp-stat">
              <span className="lp-stat-val" style={{ color: s.c }}>{s.val}</span>
              <span className="lp-stat-label">{s.label}</span>
            </div>
          ))}
        </section>
      </section>

      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: 'var(--role-venue)' }}>{t('auditPage.eyebrowOwnershipVerification', 'OWNERSHIP VERIFICATION')}</p>
        <h2 className="lp-section-head">{t('auditPage.verifiedProfilesTitle', 'Verified profiles')}</h2>
        <div className="lp-reason-grid" style={{ marginTop: '20px' }}>
          <div className="lp-reason-card">
            <h3 className="lp-reason-head">{verifiedCount.toLocaleString()}</h3>
            <p className="lp-reason-body">{t('auditPage.verifiedProfilesBody', 'Profiles verified as the real artist, DJ, or venue')}</p>
          </div>
          <div className="lp-reason-card">
            <h3 className="lp-reason-head">{verificationReviewed.toLocaleString()}</h3>
            <p className="lp-reason-body">{t('auditPage.verificationReviewedBody', 'Verification requests reviewed by a human')}</p>
          </div>
        </div>
      </section>

      {/* How this works */}
      <section className="lp-hype-explainer">
        <p className="lp-hype-eyebrow" style={{ color: 'var(--accent)' }}>{t('auditPage.eyebrowHowItWorks', 'HOW IT WORKS')}</p>
        <h2 className="lp-section-head">{t('auditPage.fullPictureTitle', 'The full picture')}</h2>
        <div className="lp-reason-grid" style={{ marginTop: '20px' }}>
          {[
            {
              icon: '◈',
              c: 'var(--accent)',
              head: t('auditPage.howAiScreeningHead', 'AI screening on upload'),
              body: t('auditPage.howAiScreeningBody', 'Every track, avatar, hero, and gallery image is screened automatically the moment it\'s uploaded, and every radio ad campaign\'s copy and audio (transcribed, then screened) are AI-vetted against our music-industry-only policy — before any of it can go live.'),
            },
            {
              icon: '⬟',
              c: 'var(--role-fan)',
              head: t('auditPage.howHumanReviewHead', 'Human review queue'),
              body: t('auditPage.howHumanReviewBody', 'Anything the AI flags, or that a user reports, lands in a queue an admin reviews by hand. Nothing is auto-removed without a report existing.'),
            },
            {
              icon: '◎',
              c: 'var(--role-venue)',
              head: t('auditPage.howNoPiiHead', 'No content, no PII'),
              body: t('auditPage.howNoPiiBody', 'This page shows counts only. Categories with fewer than five reports are folded into "Other" so a small number can never identify a specific user or piece of content.'),
            },
            {
              icon: '⚙',
              c: 'var(--accent-2)',
              head: t('auditPage.howFailOpenHead', 'Fail-open by design'),
              body: t('auditPage.howFailOpenBody', 'If the AI screening service is ever unavailable, uploads still go through — they just skip the automated check. Nothing on iHYPE is blocked by an AI outage.'),
            },
          ].map((r) => (
            <div key={r.icon} className="lp-reason-card">
              <div className="lp-reason-icon" style={{ color: r.c }}>{r.icon}</div>
              <h3 className="lp-reason-head">{r.head}</h3>
              <p className="lp-reason-body">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-footer-cta">
        <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
          <Link href="/info?tab=transparency" className="lp-btn-primary">{t('auditPage.financialTransparencyLink', 'Financial transparency →')}</Link>
          <Link href="/community-rules" className="lp-btn-ghost">{t('auditPage.communityRulesLink', 'Community rules')}</Link>
        </div>
      </section>
    </div>
  );
}
