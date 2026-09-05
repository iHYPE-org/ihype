'use client';

/* A client component because it reads `useI18n()`. It was a server component
   calling a client hook, which Next reports as "Attempted to call useI18n()
   from the server" on every render of the seven policy pages; the props are
   plain strings, so nothing is lost by moving it. */
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';

type TrustPolicyPageProps = {
  badge: string;
  title: string;
  intro: string;
  lastUpdated?: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

export function TrustPolicyPage({ badge, title, intro, lastUpdated, sections }: TrustPolicyPageProps) {
  const { t } = useI18n();
  return (
    <main className="container section trust-policy-page">
      <section className="panel trust-policy-hero">
        <div className="badge">{badge}</div>
        <h1>{title}</h1>
        <p className="subtitle">{intro}</p>
        {lastUpdated && (
          <p style={{ fontSize: '0.9375rem', opacity: 0.6, marginTop: 8 }}>{t('trustPolicyPage.lastUpdatedLabel', 'Last updated:')} {lastUpdated}</p>
        )}
        <div className="trust-policy-links">
          <Link className="text-link" href="/info?tab=privacy">{t('trustPolicyPage.privacyLink', 'Privacy')}</Link>
          <Link className="text-link" href="/info?tab=terms">{t('trustPolicyPage.termsLink', 'Terms')}</Link>
          <Link className="text-link" href="/copyright">{t('trustPolicyPage.copyrightLink', 'Copyright')}</Link>
          <Link className="text-link" href="/ticket-policy">{t('trustPolicyPage.ticketPolicyLink', 'Ticket policy')}</Link>
          <Link className="text-link" href="/community-rules">{t('trustPolicyPage.communityRulesLink', 'Community rules')}</Link>
          <Link className="text-link" href="/info?tab=charter">{t('trustPolicyPage.charterLink', 'The Charter')}</Link>
          <Link className="text-link" href="/delete-account">{t('trustPolicyPage.deleteAccountLink', 'Delete your account')}</Link>
          <Link className="text-link" href="/support">{t('trustPolicyPage.supportLink', 'Support')}</Link>
        </div>
      </section>

      <section className="grid trust-policy-grid">
        {sections.map((section) => (
          <article className="card trust-policy-card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
