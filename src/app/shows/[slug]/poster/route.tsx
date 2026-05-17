import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const show = await db.show.findUnique({
    where: { slug },
    include: {
      venueProfile: { select: { name: true, city: true, stateRegion: true } },
      headlinerProfile: { select: { name: true } }
    }
  });
  if (!show) return new Response('Not found', { status: 404 });

  const dateLabel = show.startsAt
    ? new Date(show.startsAt).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'TBA';

  const isDownload = new URL(request.url).searchParams.get('download') === '1';

  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: 'linear-gradient(135deg, #15001f 0%, #2b0033 50%, #420020 100%)',
          color: '#fff',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 28, opacity: 0.7, letterSpacing: 4, textTransform: 'uppercase' }}>iHYPE</div>
          <div style={{ fontSize: 86, fontWeight: 800, lineHeight: 1.05 }}>{show.title}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 38 }}>
          {show.headlinerProfile?.name ? (
            <div style={{ display: 'flex' }}>
              <span style={{ opacity: 0.6, marginRight: 12 }}>FEAT</span>
              <strong>{show.headlinerProfile.name}</strong>
            </div>
          ) : null}
          {show.venueProfile?.name ? (
            <div style={{ display: 'flex' }}>
              <span style={{ opacity: 0.6, marginRight: 12 }}>AT</span>
              <strong>
                {show.venueProfile.name}
                {show.venueProfile.city ? `, ${show.venueProfile.city}` : ''}
              </strong>
            </div>
          ) : null}
          <div style={{ display: 'flex' }}>
            <span style={{ opacity: 0.6, marginRight: 12 }}>ON</span>
            <strong>{dateLabel}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, opacity: 0.6 }}>
          <span>ihype.org/shows/{show.slug}</span>
          <span>HYPE THE LOCAL SCENE</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );

  if (isDownload) {
    const headers = new Headers(response.headers);
    headers.set('Content-Disposition', `attachment; filename="ihype-${show.slug}.png"`);
    return new Response(response.body, { status: response.status, headers });
  }
  return response;
}
