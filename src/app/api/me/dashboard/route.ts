import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type DashboardRole = 'fan' | 'artist' | 'venue' | 'advertiser';

const roleWorkspace: Record<DashboardRole, { title: string; href: string; next: string; actions: Array<{ title: string; href: string }> }> = {
  fan: { title: 'Your listening profile', href: '/me/dashboard', next: 'Open your next local discovery', actions: [{ title: 'Open my Discovery playlist', href: '/playlists' }, { title: 'Share my HYPE link', href: '/me/promote' }, { title: 'See nearby events', href: '/app/map?layer=events' }] },
  artist: { title: 'Artist page and release workspace', href: '/pages', next: 'Strengthen your artist page', actions: [{ title: 'Edit artist page', href: '/pages' }, { title: 'Create recommended tour', href: '/tour-planner' }, { title: 'Review song insights', href: '/profile-insights' }] },
  venue: { title: 'Venue page and event workspace', href: '/pages', next: 'Create your next event', actions: [{ title: 'Create an event', href: '/events/new' }, { title: 'Edit venue page', href: '/pages' }, { title: 'Review booking interest', href: '/tour-planner' }] },
  advertiser: { title: 'Music-only advertising workspace', href: '/advertise/dashboard', next: 'Review your aggregate scene matches', actions: [{ title: 'Open advertiser dashboard', href: '/advertise/dashboard' }, { title: 'Review aggregate heat map', href: '/app/map?layer=events' }, { title: 'Update advertiser profile', href: '/advertise' }] },
};

function labelForNotification(type: string) {
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 42);
}

function showDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(date);
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const requested = new URL(request.url).searchParams.get('role')?.toLowerCase() as DashboardRole | undefined;
    const [user, profiles, advertiser, notifications, upcoming, follows, hypes, ticketOrders, mediaCount] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { role: true } }),
      db.profile.findMany({ where: { ownerId: userId }, select: { id: true, type: true, name: true, slug: true, headline: true, bio: true, heroImage: true, avatarImage: true, genres: true, hypeCount: true, onboardedAt: true } }),
      db.advertiserAccount.findUnique({ where: { userId }, select: { id: true, companyName: true } }),
      db.notification.findMany({ where: { userId }, orderBy: [{ read: 'asc' }, { createdAt: 'desc' }], take: 2, select: { id: true, type: true, body: true, link: true, read: true } }),
      db.show.findMany({ where: { status: 'SCHEDULED', startsAt: { gte: new Date() }, moderationStatus: 'APPROVED' }, orderBy: [{ startsAt: 'asc' }, { hypeCount: 'desc' }], take: 2, select: { id: true, slug: true, title: true, startsAt: true, isTicketed: true, venueProfile: { select: { name: true, city: true } } } }),
      db.follow.count({ where: { followerId: userId } }),
      db.profileHypeEvent.count({ where: { userId } }),
      db.ticketOrder.count({ where: { buyerUserId: userId, status: { not: 'VOID' } } }),
      db.artistMediaAsset.count({ where: { profile: { ownerId: userId } } }),
    ]);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowed = new Set<DashboardRole>(['fan']);
    if (user.role === 'ADMIN') ['artist', 'venue', 'advertiser'].forEach((role) => allowed.add(role as DashboardRole));
    if (user.role === 'ARTIST' || profiles.some((profile) => profile.type === 'ARTIST')) allowed.add('artist');
    if (user.role === 'VENUE' || profiles.some((profile) => profile.type === 'VENUE')) allowed.add('venue');
    if (user.role === 'ADVERTISER' || advertiser) allowed.add('advertiser');
    const role = requested && allowed.has(requested) ? requested : [...allowed][0];
    const workspace = roleWorkspace[role];
    const creatorProfile = profiles.find((profile) => profile.type.toLowerCase() === role);
    const filledFields = creatorProfile ? [creatorProfile.headline, creatorProfile.bio, creatorProfile.heroImage || creatorProfile.avatarImage, creatorProfile.genres.length ? 'genres' : null, creatorProfile.onboardedAt].filter(Boolean).length : 0;
    const completeness = creatorProfile ? Math.round((filledFields / 5) * 100) : role === 'fan' ? Math.min(100, 35 + follows * 5 + hypes * 5) : 0;

    const recommendations = role === 'fan' ? [] : (await db.profile.findMany({
      where: { discoverable: true, ownerId: { not: userId }, type: role === 'venue' ? 'ARTIST' : role === 'artist' ? 'VENUE' : 'ARTIST' },
      orderBy: { hypeCount: 'desc' }, take: 3,
      select: { id: true, name: true, slug: true, type: true, city: true, stateRegion: true, genres: true, hypeCount: true },
    })).map((profile) => ({
      title: profile.name,
      detail: [profile.city, profile.stateRegion, profile.genres.slice(0, 2).join(' · ')].filter(Boolean).join(' · ') || 'Independent local scene',
      tag: `${profile.hypeCount.toLocaleString()} HYPES`,
      href: profile.type === 'VENUE' ? `/venues/${profile.slug}` : `/artists/${profile.slug}`,
    }));

    const response = {
      build: {
        title: creatorProfile ? `${creatorProfile.name} workspace · ${completeness}% ready` : workspace.title,
        detail: creatorProfile ? `${mediaCount} uploaded track${mediaCount === 1 ? '' : 's'} · ${creatorProfile.hypeCount.toLocaleString()} profile HYPES` : `${hypes} HYPES · ${follows} follows · ${ticketOrders} ticket order${ticketOrders === 1 ? '' : 's'}`,
        href: workspace.href,
      },
      nextAction: { title: workspace.next, href: role === 'fan' ? '/app/music/discover' : workspace.actions[0].href },
      notifications: notifications.map((notification) => ({ id: notification.id, label: notification.read ? 'UPDATE' : 'NEW', title: labelForNotification(notification.type), detail: notification.body, href: notification.link || '/me/dashboard', action: 'Open' })),
      upcoming: upcoming.map((show) => ({ id: show.id, label: showDate(show.startsAt).split(',')[0].toUpperCase(), title: show.title, detail: `${showDate(show.startsAt)}${show.venueProfile?.name ? ` · ${show.venueProfile.name}` : ''}`, href: `/shows/${show.slug}`, action: show.isTicketed ? 'Tickets' : 'View' })),
      recommendations,
      insights: [
        `${hypes} artists or venues currently carry your HYPE signal`,
        `${follows} followed pages shape your local recommendations`,
        creatorProfile ? `${creatorProfile.hypeCount.toLocaleString()} HYPES are attached to ${creatorProfile.name}` : `${ticketOrders} ticket orders connect listening to real attendance`,
      ],
      actions: workspace.actions,
    };
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    log.error('[api/me/dashboard]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Dashboard data is temporarily unavailable.' }, { status: 500 });
  }
}
