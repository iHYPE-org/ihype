import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { getServerT } from '@/lib/i18n/server';

export default async function AuxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const queue = await db.auxQueue.findUnique({
    where: { slug },
    include: { items: { orderBy: { position: 'asc' } } },
  }).catch(() => null);
  if (!queue) notFound();

  /* Painted from tokens as of 2026-08-22. It had its own palette — a #0a0a0a
     ground with #f0f0f0 ink, from before the console conversion — so it was the
     one member-facing page that stayed dark after the whole app moved to cream,
     and it is a page people SHARE, so a stranger's first sight of iHYPE was a
     surface that matched nothing else. It was invisible to `audit:retro` until
     that script stopped losing `design-exempt` markers to its own comment
     stripper. */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--f-b)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: '0.6875rem', letterSpacing: '.2em', color: 'var(--accent-text)', marginBottom: 16 }}>{t('auxQueueSlugPage.eyebrow', '● IHYPE · PASSED THE AUX')}</div>
        <h1 style={{ fontFamily: 'var(--f-s)', fontSize: '2.25rem', fontWeight: 400, letterSpacing: '.005em', margin: '0 0 8px' }}>{queue.name}</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: '0.9375rem', margin: '0 0 32px' }}>{queue.items.length} {t('auxQueueSlugPage.tracksSharedVia', 'tracks · shared via iHYPE')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queue.items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius-panel)', border: '1px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.9375rem', color: 'var(--ink-3)', minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: '0.9375rem', color: 'var(--ink)' }}>{item.mediaId}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a href="https://ihype.org" style={{ color: 'var(--accent-text)', fontSize: '0.9375rem', textDecoration: 'none' }}>{t('auxQueueSlugPage.discoverMoreLink', 'Discover more on iHYPE →')}</a>
        </div>
      </div>
    </div>
  );
}
