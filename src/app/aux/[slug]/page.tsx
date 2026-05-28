import { db } from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function AuxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const queue = await db.auxQueue.findUnique({
    where: { slug },
    include: { items: { orderBy: { position: 'asc' } } },
  }).catch(() => null);
  if (!queue) notFound();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '.2em', color: '#ff5029', marginBottom: 16 }}>● IHYPE · PASSED THE AUX</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px' }}>{queue.name}</h1>
        <p style={{ color: '#888', fontSize: 14, margin: '0 0 32px' }}>{queue.items.length} tracks · shared via iHYPE</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queue.items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: '#161616', borderRadius: 10, border: '1px solid #222' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#555', minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 14, color: '#ccc' }}>{item.mediaId}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a href="https://ihype.org" style={{ color: '#ff5029', fontSize: 13, textDecoration: 'none' }}>Discover more on iHYPE →</a>
        </div>
      </div>
    </div>
  );
}
