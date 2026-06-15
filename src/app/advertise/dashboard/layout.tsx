import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdvertiseDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: 'rgba(10,8,5,.9)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,.07)',
      }}>
        <div style={{
          width: '100%', maxWidth: 1180, margin: '0 auto',
          padding: '0 40px', height: 62,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <Link href="/advertise" style={{
            fontFamily: 'var(--f-d,Syne,sans-serif)', fontWeight: 800,
            fontSize: 18, letterSpacing: '-.03em', color: 'var(--ink)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), #ff3e9a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 11, color: '#0a0805',
            }}>iH</span>
            Advertise
          </Link>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>/</span>
          <span style={{ fontFamily: 'var(--f-b,DM Sans,sans-serif)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>My campaigns</span>
          <Link href="/home" style={{
            marginLeft: 'auto', fontFamily: 'var(--f-b,DM Sans,sans-serif)',
            fontWeight: 600, fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none',
          }}>← Back to workbench</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
