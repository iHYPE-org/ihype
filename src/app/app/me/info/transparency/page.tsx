import Link from 'next/link';
import { TransparencyPanel } from '@/components/info/TransparencyPanel';
import { TrustSafetyPanel } from '@/components/info/TrustSafetyPanel';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function MmmTransparencyPage() {
  const t = await getServerT();
  return (
    <article className="mmm-info-report">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ {t('mmmStrip.info', 'Info')}</Link>
      <header className="mmm-info-report-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('mmmDock.tab.me', 'Me')} · {t('mmmStrip.info', 'Info')}</p>
        <h1>{t('mmmTransparencyPage.title', 'Transparency report')}</h1>
        <p>{t('mmmTransparencyPage.lede', 'Financial, platform, moderation, and safety numbers—together in one public record.')}</p>
      </header>
      <TransparencyPanel />
      <div className="mmm-info-report-divider">
        <p className="mmm-eyebrow">{t('mmmTransparencyPage.moderationEyebrow', 'Moderation · Trust & safety')}</p>
        <h2>{t('mmmTransparencyPage.moderationTitle', 'How the platform is kept accountable')}</h2>
        <p>{t('mmmTransparencyPage.moderationLede', 'Aggregate enforcement, verification, and ad-review figures. No usernames, content IDs, or identifying report details.')}</p>
      </div>
      <TrustSafetyPanel />
    </article>
  );
}
