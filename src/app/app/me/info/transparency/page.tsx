import Link from 'next/link';
import { TransparencyPanel } from '@/components/info/TransparencyPanel';
import { TrustSafetyPanel } from '@/components/info/TrustSafetyPanel';

export const dynamic = 'force-dynamic';

export default function MmmTransparencyPage() {
  return (
    <article className="mmm-info-report">
      <Link className="mmm-charter-back" href="/app/me?panel=info">‹ Info</Link>
      <header className="mmm-info-report-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">Me · Info</p>
        <h1>Transparency report</h1>
        <p>Financial, platform, moderation, and safety numbers—together in one public record.</p>
      </header>
      <TransparencyPanel />
      <div className="mmm-info-report-divider">
        <p className="mmm-eyebrow">Moderation · Trust &amp; safety</p>
        <h2>How the platform is kept accountable</h2>
        <p>Aggregate enforcement, verification, and ad-review figures. No usernames, content IDs, or identifying report details.</p>
      </div>
      <TrustSafetyPanel />
    </article>
  );
}
