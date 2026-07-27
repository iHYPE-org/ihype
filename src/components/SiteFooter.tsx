import Link from 'next/link';
import { getLocale, getT } from '@/lib/i18n/server';

export async function SiteFooter() {
  const t = getT(await getLocale());
  return (
    <footer
      aria-label="Site footer"
      className="ihype-footer"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem 1.5rem',
        padding: '1.5rem 1.5rem 2.5rem',
        marginTop: '2rem',
        borderTop: '1px solid var(--line, var(--line))',
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: '0.75rem',
        letterSpacing: '0.04em',
        color: 'var(--ink-3, #7a7060)',
      }}
    >
      <Link href="/advertise" style={{ color: 'inherit', textDecoration: 'none' }}>{t('siteFooter.advertise', 'Advertise')}</Link>
      <Link href="/legal" style={{ color: 'inherit', textDecoration: 'none' }}>{t('siteFooter.legal', 'Legal')}</Link>
      <Link href="/support" style={{ color: 'inherit', textDecoration: 'none' }}>{t('siteFooter.support', 'Support')}</Link>
      <span className="site-footer-nonprofit">{t('siteFooter.nonprofit', 'A 501(c)(3) nonprofit')}</span>
      <span className="site-footer-rights">{t('siteFooter.copyright', '© 2026 ihype.org')}<span className="site-footer-rights-suffix"> {t('siteFooter.allRightsReserved', '— all rights reserved')}</span></span>
    </footer>
  );
}
