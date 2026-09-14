import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getServerI18n } from '@/lib/i18n/server';
import { formatDoorTime } from '@/lib/format-locale';
import { isShowOrganizer, ORGANIZER_SHOW_SELECT } from '@/lib/show-organizer';
import { ShowEditForm } from '@/components/ShowEditForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const show = await db.show.findUnique({ where: { slug }, select: { title: true } });
  return {
    title: show ? `Edit · ${show.title} · iHYPE` : 'Edit event · iHYPE',
    robots: { index: false, follow: false },
  };
}

/**
 * Edit a show that has not started: title, description, start time.
 *
 * Gated the way the cancel page and the door are — venue owner, headliner
 * owner, creator, administrator (`isShowOrganizer`) — and only while the
 * show is DRAFT or SCHEDULED, which is the same window `PATCH /api/shows`
 * enforces. A LIVE or ENDED show is not editable and this page says so with
 * a 404 rather than a form whose save would be refused.
 */
export default async function EditShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/me/shows/${slug}/edit`);

  const { locale, t } = await getServerI18n();
  const show = await db.show.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, description: true, startsAt: true, timeZone: true, status: true, ticketsSoldCount: true,
      ...ORGANIZER_SHOW_SELECT,
    },
  });
  if (!show || !isShowOrganizer(session, show)) return notFound();
  if (!['DRAFT', 'SCHEDULED'].includes(show.status)) return notFound();

  return (
    <article className="mmm-document">
      <Link className="mmm-charter-back" href={`/app/shows/${show.slug}`}>‹ {t('showEdit.backToShow', 'Show')}</Link>
      <header className="mmm-document-head">
        <p className="mmm-eyebrow mmm-eyebrow-accent">{t('showEdit.crumb', 'Me · Show tools · Edit')}</p>
        <h1>{t('showEdit.heading', 'Edit event')}</h1>
        <p>
          {t('showEdit.intro', 'Correct the title, the description or the start time. Tickets already sold stay valid.')}{' '}
          {t('showEdit.currentlyPrefix', 'Currently')} {formatDoorTime(locale, show.startsAt, show.timeZone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
        </p>
      </header>
      <ShowEditForm
        show={{
          id: show.id,
          slug: show.slug,
          title: show.title,
          description: show.description ?? '',
          startsAt: show.startsAt.toISOString(),
          timeZone: show.timeZone,
          ticketsSoldCount: show.ticketsSoldCount,
        }}
      />
    </article>
  );
}
