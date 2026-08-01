import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CollabBoardPostForm } from '@/components/CollabBoardPostForm';
import { DeleteCollabPostButton } from '@/components/DeleteCollabPostButton';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collab Board · iHYPE',
  description: 'Musician classifieds — find bandmates, venues, and gigs, or post your own listing.',
  robots: { index: false, follow: false },
};

const TYPES = [
  { value: 'looking-for', label: 'Looking for' },
  { value: 'available', label: 'Available' },
];

const ROLES = [
  { value: 'drummer', label: 'Drummer' },
  { value: 'venue', label: 'Venue' },
  { value: 'vocalist', label: 'Vocalist' },
  { value: 'producer', label: 'Producer' },
  { value: 'guitarist', label: 'Guitarist' },
  { value: 'bassist', label: 'Bassist' },
  { value: 'DJ', label: 'DJ' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.value, t.label]));
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

export default async function CollabBoardPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; role?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/collab-board');
  }

  const t = await getServerT();
  const params = searchParams ? await searchParams : {};
  const typeFilter = TYPES.some(t => t.value === params.type) ? (params.type as string) : null;
  const roleFilter = ROLES.some(r => r.value === params.role) ? (params.role as string) : null;

  const posts = await db.collabBoardPost.findMany({
    where: {
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, type: true, role: true, body: true, contact: true, createdAt: true, userId: true },
  });

  const typeLabel = (value: string) => t(`collabBoardPage.type.${value}`, TYPE_LABEL[value] ?? value);
  const roleLabel = (value: string) => t(`collabBoardPage.role.${value}`, ROLE_LABEL[value] ?? value);

  const buildUrl = (type: string | null, role: string | null) => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (role) p.set('role', role);
    const q = p.toString();
    return `/collab-board${q ? `?${q}` : ''}`;
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 100px' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
          {t('collabBoardPage.eyebrow', 'COLLAB BOARD')}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 8px' }}>
          {t('collabBoardPage.title', 'Find your next bandmate')}
        </h1>
        <p style={{ color: 'var(--ink-a55)', fontSize: 14, margin: 0 }}>
          {t('collabBoardPage.subtitle', "Musician classifieds — post what you're looking for, or what you have to offer.")}
        </p>
      </div>

      <CollabBoardPostForm roles={ROLES} />

      {/* Filters */}
      <div style={{ margin: '32px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a30)', flexShrink: 0 }}>{t('collabBoardPage.typeFilterLabel', 'Type')}</span>
          {typeFilter && (
            <Link href={buildUrl(null, roleFilter)} style={{ textDecoration: 'none' }}>
              <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--accent)', color: 'var(--ink-on-accent)', cursor: 'pointer' }}>
                {typeLabel(typeFilter)} ×
              </span>
            </Link>
          )}
          {TYPES.filter(tp => tp.value !== typeFilter).map(tp => (
            <Link key={tp.value} href={buildUrl(tp.value, roleFilter)} style={{ textDecoration: 'none' }}>
              <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--line)', color: 'var(--ink-a60)', cursor: 'pointer', border: '1px solid var(--hair-80)' }}>
                {typeLabel(tp.value)}
              </span>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-a30)', flexShrink: 0 }}>{t('collabBoardPage.roleFilterLabel', 'Role')}</span>
          {roleFilter && (
            <Link href={buildUrl(typeFilter, null)} style={{ textDecoration: 'none' }}>
              <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--accent-2)', color: 'var(--ink-on-accent)', cursor: 'pointer' }}>
                {roleLabel(roleFilter)} ×
              </span>
            </Link>
          )}
          {ROLES.filter(r => r.value !== roleFilter).map(r => (
            <Link key={r.value} href={buildUrl(typeFilter, r.value)} style={{ textDecoration: 'none' }}>
              <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--line)', color: 'var(--ink-a60)', cursor: 'pointer', border: '1px solid var(--hair-80)' }}>
                {roleLabel(r.value)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Listings */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-a30)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--ink)' }}>
            {t('collabBoardPage.emptyTitle', 'No listings yet')}
          </p>
          <p style={{ fontSize: 14 }}>{t('collabBoardPage.emptyBody', 'Be the first to post — find a drummer, a venue, or your next gig.')}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {posts.map(p => {
            const isOwn = p.userId === session.user!.id;
            return (
              <li key={p.id} className="ihype-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
                        padding: '4px 10px', borderRadius: 999,
                        color: p.type === 'looking-for' ? 'var(--accent)' : 'var(--role-venue)',
                        background: p.type === 'looking-for' ? 'rgba(var(--accent-rgb),.1)' : 'rgba(var(--role-venue-rgb),.1)',
                        border: `1px solid ${p.type === 'looking-for' ? 'rgba(var(--accent-rgb),.3)' : 'rgba(var(--role-venue-rgb),.3)'}`,
                      }}
                    >
                      {typeLabel(p.type)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
                        padding: '4px 10px', borderRadius: 999, color: 'var(--ink-a60)',
                        background: 'var(--hair-40)', border: '1px solid var(--hair-100)',
                      }}
                    >
                      {roleLabel(p.role)}
                    </span>
                  </div>
                  {isOwn && <DeleteCollabPostButton id={p.id} />}
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-a85)', lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>
                  {p.body}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  {p.contact ? (
                    <span style={{ fontSize: 12, color: 'var(--ink-a70)' }}>{t('collabBoardPage.contactPrefix', 'Contact:')} {p.contact}</span>
                  ) : <span />}
                  <span className="meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-a40)' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
