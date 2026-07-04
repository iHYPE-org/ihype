import Link from 'next/link';

export function SiteFooter() {
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
        borderTop: '1px solid var(--line, rgba(255,255,255,0.06))',
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        fontSize: '0.75rem',
        letterSpacing: '0.04em',
        color: 'var(--ink-3, #7a7060)',
      }}
    >
      <Link href="/advertise" style={{ color: 'inherit', textDecoration: 'none' }}>Advertise</Link>
      <Link href="/legal" style={{ color: 'inherit', textDecoration: 'none' }}>Legal</Link>
      <Link href="/support" style={{ color: 'inherit', textDecoration: 'none' }}>Support</Link>
      <span className="site-footer-rights">© 2026 ihype.org<span className="site-footer-rights-suffix"> — all rights reserved</span></span>
    </footer>
  );
}
