'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MMM_ME_PANELS } from '@/lib/mmm-nav';
import { MmmTickets } from './MmmTickets';
import { useRegisterStations } from './MmmStations';
import { ME_PANEL_ROWS, canonicalMePanelId, isMePanelId, type MePanelId } from '@/lib/mmm-me-panels';
import type { MmmMeData, MmmMeRole } from '@/lib/mmm-me';

const ROLE_LABELS: Record<MmmMeRole, string> = { fan: 'Fan', artist: 'Artist', venue: 'Venue' };

type ListeningSummary = {
  tracksThisMonth: number | null;
  tracksTotal: number | null;
  topArtists: Array<{ name: string; slug: string | null; tracks: number }> | null;
  hypesThisMonth: number | null;
};

/**
 * The account's LISTENING, beside its admin (owner-approved batch, 2026-08-24:
 * "a listening identity, not just an account"). Every figure is one the schema
 * can honestly answer — `MediaListen` keeps one row per (user, track), so
 * these count distinct tracks finished, never "plays", and the labels say so.
 * A figure that could not be read renders an em dash, never 0 (the
 * analytics-engine rule). Renders nothing at all for an account that has
 * never finished a track: a scoreboard of dashes on day one is noise.
 */
function ListeningCard() {
  const [summary, setSummary] = useState<ListeningSummary | null>(null);
  useEffect(() => {
    let stale = false;
    void fetch('/api/me/listening-summary', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!stale && data) setSummary(data as ListeningSummary); })
      .catch(() => { /* the card just does not render */ });
    return () => { stale = true; };
  }, []);

  if (!summary || !summary.tracksTotal) return null;
  const figure = (value: number | null) => (value === null ? '—' : value.toLocaleString());

  return (
    <>
      <div className="mmm-me-stats-head">
        <span className="mmm-eyebrow">Your listening</span>
        <span aria-hidden="true" className="mmm-me-stats-rule" />
      </div>
      <div className="mmm-stat-grid" style={{ marginBottom: 12 }}>
        <div className="mmm-card">
          <div className="mmm-stat-value">{figure(summary.tracksThisMonth)}</div>
          <div className="mmm-stat-label">Tracks this month</div>
        </div>
        <div className="mmm-card">
          <div className="mmm-stat-value">{figure(summary.tracksTotal)}</div>
          <div className="mmm-stat-label">Tracks all time</div>
        </div>
        <div className="mmm-card">
          <div className="mmm-stat-value">{figure(summary.hypesThisMonth)}</div>
          <div className="mmm-stat-label">HYPEs this month</div>
        </div>
      </div>
      {summary.topArtists && summary.topArtists.length > 0 && (
        <div className="mmm-card" style={{ padding: 15, marginBottom: 16 }}>
          <div className="mmm-eyebrow" style={{ marginBottom: 8 }}>Most played artists</div>
          {summary.topArtists.map((artist, index) => (
            <div key={`${artist.name}-${index}`} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink-3)', width: 22 }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              {artist.slug ? (
                <Link href={`/app/artists/${artist.slug}`} style={{ flex: 1, fontWeight: 600, color: 'var(--ink)' }}>{artist.name}</Link>
              ) : (
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--ink)' }}>{artist.name}</span>
              )}
              <span style={{ color: 'var(--ink-3)', fontSize: '0.9375rem' }}>{artist.tracks} track{artist.tracks === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The drawers above the account panels. Order is the design system's —
 * Profiles · My Tickets · Info · Settings. All four start closed so ME opens
 * as a clean index rather than choosing a destination for the member.
 */
type MeSectionId = 'profiles' | 'tickets';
const ME_SECTION_IDS: readonly MeSectionId[] = ['profiles', 'tickets'];

function isMeSectionId(value: string | null): value is MeSectionId {
  return value !== null && (ME_SECTION_IDS as readonly string[]).includes(value);
}

/**
 * The ME surface — a role-aware dashboard.
 *
 * From the app-shell redesign: ME has no fan-out submenu; Settings and Info
 * are rows on this surface. Accessibility is grouped under Settings and Legal
 * under Info so neither the Charter nor preferences have duplicate homes. The role switcher shows only the
 * roles the account actually holds, and **Fan is always present and always
 * first** because it is implicit and permanent (`BACKEND_REWRITE.md` §1).
 *
 * Two product decisions are visible here and both are deliberate:
 *
 *   - **Fans have no page editor.** The fan page creator was removed; a fan's
 *     primary surface is the HYPE link card. Artist and Venue still get one —
 *     `FRONTEND_GOTCHAS.md` §7 is explicit that only the *fan* creator went.
 *   - **There is no Promoter role or role colour.** Promoting needs no account
 *     type at all; promoter earnings are a fan stat, and the copy says so.
 *
 * `advertiser` is not in the switcher: an Advertiser account has no `Profile`
 * row and no dashboard of this shape — it has `/advertise/dashboard`, which the
 * Settings row links to. Showing an empty Advertiser tab here would be worse
 * than not showing one.
 */
/**
 * ME's sections are accordions, per Design System 8's
 * `templates/simplified-app/`: a labelled button carrying `aria-expanded`, a
 * chevron, `--radius-card` corners, and the body underneath.
 *
 * Why accordions rather than stacked cards: ME is the only surface in this
 * shell with no search and no tabs, so everything an account has lives on one
 * scroll. Left open, three screens of stats sit between the member and the
 * Account rows, which are what most visits are actually for. Collapsed, the
 * whole surface is one screen.
 *
 * Every drawer starts closed. Profiles remains first because it changes what
 * the account IS, but entering ME should show the four choices without making
 * one choice on the member's behalf.
 *
 * **One drawer open at a time, page-wide** — the sections here and the account
 * panels below are ONE group, not two. Each section used to hold its own
 * `useState`, so all three could stand open at once alongside a settings panel;
 * six open drawers is the state the folding was introduced to prevent. The open
 * id therefore lives in the parent (`meGroup`), which makes "one at a time"
 * structural rather than a rule every toggle has to remember.
 */
/**
 * ME's four subnav options, as the DIAL's stations (owner, 2026-08-25:
 * "Profiles My Tickets Info Settings for the four subnav options in Me").
 *
 * The dial used to offer only Info and Settings — `MMM_ME_PANELS`, the two that
 * have rows — so half of ME's list was reachable only by scrolling to its card
 * and tapping it. That was survivable while every card was on screen at once;
 * it stopped being survivable the moment ME started showing one card at a time,
 * because closing the open one became the only route back to the other three.
 * The dial is the subnav, so the subnav has to be all four.
 *
 * Deliberately NOT added to `MMM_ME_PANELS`: that list drives the panel loop and
 * indexes `ME_PANEL_ROWS`, and Profiles and My Tickets have no rows there — they
 * are sections with bodies of their own. Two lists, because they answer two
 * different questions.
 *
 * Module-level so its identity is stable. `useRegisterStations` compares
 * `stations` by reference in its effect, so an array rebuilt each render would
 * register on every render, set provider state, and re-render — the render loop
 * `useRegisterQueue` exists to prevent one floor up.
 */
const ME_STATIONS: readonly { id: string; label: string }[] = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'tickets', label: 'My Tickets' },
  { id: 'info', label: 'Info' },
  { id: 'settings', label: 'Settings' },
];

function AboutMeActivity({ data }: { data: MmmMeData }) {
  return (
    <div className="mmm-me-about-in-profiles">
      <div className="mmm-eyebrow" style={{ marginBottom: 9 }}>About me · visible activity</div>
      {data.activity.length === 0 ? (
        <div className="mmm-empty-state">
          <strong>Build your visible activity</strong>
          <p>HYPE a track, follow local artists or save a show. This is the activity artists and venues can see.</p>
          <div className="mmm-empty-actions">
            <Link className="mmm-btn-primary" href="/app/music/discover">Discover music</Link>
            <Link className="mmm-btn-ghost" href="/app/map">Explore the map</Link>
          </div>
        </div>
      ) : (
        <div>
          {data.activity.map((row) => (
            <div
              key={`${row.title}-${row.sub}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 2px', borderBottom: '1px solid var(--hair-70)' }}
            >
              <div>
                <div style={{ fontSize: '0.9375rem', color: 'var(--ink)' }}>{row.title}</div>
                <div style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', marginTop: 1 }}>{row.sub}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: row.tone === 'positive' ? 'var(--success)' : row.tone === 'hot' ? 'var(--accent-text)' : 'var(--ink-3)' }}>
                {row.amount}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MmmMe({ data }: { data: MmmMeData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const pickRole = (role: MmmMeRole) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('role', role);
    router.replace(`/app/me?${params.toString()}`);
  };

  const rawPanel = searchParams?.get('panel');
  const openPanel = canonicalMePanelId(rawPanel);
  const rawSection = searchParams?.get('section');
  const linkedSection = isMeSectionId(rawSection) ? rawSection : null;

  /**
   * Which of the two profile/ticket sections above the Info and Settings
   * panels is open.
   *
   * An empty string means all four drawers are closed. A `section` deep link
   * can still open Profiles or My Tickets explicitly.
   */
  const [meGroup, setMeGroup] = useState<MeSectionId | ''>(linkedSection ?? '');

  const openSection: MeSectionId | null = meGroup || null;

  /**
   * `push`, not `replace` — closing a drawer should be what Back does, which
   * is the whole reason this lives in the URL. `scroll: false` because the
   * drawer opens where the member already is; scrolling to the top would move
   * the row they just tapped off screen.
   */
  const setPanel = (id: MePanelId | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (id) params.set('panel', id);
    else params.delete('panel');
    const query = params.toString();
    router.push(query ? `/app/me?${query}` : '/app/me', { scroll: false });
  };

  /**
   * ME draws exactly ONE card, and the dial is what picks it (owner,
   * 2026-08-25: "Still showing multi options instead of single subnav using
   * thumb wheel (less screen space taken up)").
   *
   * This replaces an accordion. The first pass at the owner's earlier
   * instruction — "only show the subnav selected, rather than the complete list
   * and the selected list" — folded the other cards away once one was OPEN, and
   * left the four-card index standing whenever none was. So the index was still
   * the resting state of ME: four headers, four detail lines and four chevrons
   * above the thing you came for, which is what the screenshot shows and what
   * "less screen space" is about.
   *
   * There is therefore no closed state and no header to tap. A card is never
   * "open"; it is simply the one the dial is on, and the dial's own drum is its
   * label — a header repeating that name inside the pane is the second control
   * for one value that the handoff's one-dial-per-screen rule exists to stop.
   *
   * `?section=` and `?panel=` still choose, so every deep link into ME keeps
   * working; nothing on screen toggles any more.
   */
  const activeId: MeSectionId | MePanelId = openSection ?? openPanel ?? 'profiles';

  /* Wire the four to the dial. The callback goes through a ref so its identity
     is permanently stable — same reason and same shape as `navigateRef` in
     MmmDock — because `useRegisterStations` also depends on `onChange` by
     reference, and this one closes over `openPanel`, the router and the search
     params, all of which change. */
  const selectStation = useRef<(id: string) => void>(() => {});
  selectStation.current = (id: string) => {
    if (id === 'profiles' || id === 'tickets') {
      setMeGroup(id);
      // Only touch the URL when there is actually a panel to close, or every
      // dial turn pushes a history entry identical to the current one and Back
      // walks through dead steps.
      if (openPanel) setPanel(null);
      return;
    }
    if (isMePanelId(id)) {
      setPanel(id);
      setMeGroup('');
    }
  };
  const onStationChange = useCallback((id: string) => selectStation.current(id), []);

  useRegisterStations({
    stations: ME_STATIONS,
    /* The card on screen, which is now always exactly one. The dial must name a
       real station — the vendored TunerDial warns and silently falls back to
       index 0 when handed an `active` naming nothing, a confident wrong
       readout — and `activeId` cannot be null, so it always does. */
    active: activeId,
    onChange: onStationChange,
    label: 'Sections in ME',
  });

  const copy = async () => {
    if (!data.hypeLink) return;
    try {
      await navigator.clipboard.writeText(`https://${data.hypeLink.url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be denied; the link is selectable text either way.
    }
  };

  return (
    <>
      {data.availableRoles.length > 1 && (
        <div style={{ display: 'flex', gap: 6, paddingBottom: 16, overflowX: 'auto' }}>
          {data.availableRoles.map((role) => (
            <button
              aria-pressed={role === data.role}
              className="mmm-chip"
              key={role}
              onClick={() => pickRole(role)}
              style={{ backdropFilter: 'none' }}
              type="button"
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      )}





      {/* The HYPE link is not a drawer, and it is not a page either.

          It stays above the four drawers and remains visible without opening a
          section — it had been nested inside the old About Me drawer since the
          accordion rebuild, which hid a fan's primary surface behind a
          collapsed panel labelled "What artists and venues see", the one thing
          the HYPE link is not. Two e2e tests assert it visible and that stays
          true.

          WHAT CHANGED 2026-09-03 (owner: "Hype link sits on the top of all ME
          pages and takes up a ton of space"). It does sit on all of them —
          this block is outside every `activeId` section, so Info, Settings and
          Tickets all carried a ~340px card whose working part is one line. The
          fix is not to hide it again: the LINK and its Copy button stay
          visible on every panel, and only the EXPLANATION folds away. A
          scoreboard reading "0 tickets · $0 earned" is also gone until there
          is something to report — permanent zeros were a third of the card
          saying nothing. */}
      {data.hypeLink && (
        <div className="mmm-card mmm-hype-link">
          <div className="mmm-hype-link-row">
            <span className="mmm-eyebrow mmm-eyebrow-accent mmm-hype-link-label">HYPE link</span>
            <span className="mmm-link-value">{data.hypeLink.url}</span>
            <button
              className="mmm-btn-primary mmm-link-copy"
              onClick={() => void copy()}
              type="button"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Earned figures only once they exist. `null` is a failed read and
              renders nothing at all; 0 is real but not worth a permanent board. */}
          {(Boolean(data.hypeLink.tickets) || Boolean(data.hypeLink.earnedCents)) && (
            <p className="mmm-hype-link-meta">
              {data.hypeLink.tickets ? `${data.hypeLink.tickets} ticket${data.hypeLink.tickets === 1 ? '' : 's'}` : null}
              {data.hypeLink.tickets && data.hypeLink.earnedCents ? ' · ' : null}
              {data.hypeLink.earnedCents ? `$${(data.hypeLink.earnedCents / 100).toFixed(0)} earned` : null}
            </p>
          )}

          <details className="mmm-hype-link-more">
            <summary>How this earns</summary>
            <div className="mmm-hype-link-body">
              {data.role === 'fan' && (
                <p>Share it — friends see what you hype, and shows you can go to together.</p>
              )}
              <p>
                Share any show with this link. Every ticket it sells earns your proportional cut of the
                10% promoter pool — never the artist&rsquo;s 70%. Promoting needs no role and no signup.
              </p>
            </div>
          </details>
        </div>
      )}

      {activeId === 'profiles' && (
      <section aria-label="Profiles" className="mmm-me-section">
      {/* The stats that used to sit in a separate "Your year" section. The
          2026-08-10 template folds them under Profiles and labels them by role,
          because a figure like "Shows attended" belongs to the profile it was
          earned by — and a standing section of numbers above the thing you came
          to do was the top third of a phone screen. */}
      <ListeningCard />
      {data.stats.length > 0 && (
        <>
          <div className="mmm-me-stats-head">
            <span className="mmm-eyebrow">{ROLE_LABELS[data.role]} stats</span>
            <span aria-hidden="true" className="mmm-me-stats-rule" />
          </div>
          <div className="mmm-stat-grid" style={{ marginBottom: 16 }}>
            {data.stats.map((stat) => (
              <div className="mmm-card" key={stat.label}>
                <div className="mmm-stat-value">{stat.value}</div>
                <div className="mmm-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      )}


      {data.page && (
        <div className="mmm-card mmm-card-accent" style={{ padding: 15, marginBottom: 16 }}>
          <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 6, fontSize: '0.9375rem' }}>Your page</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 3 }}>{data.page.name}</div>
          <div style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>{data.page.status}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="mmm-btn-primary" href="/app/me/profiles" style={{ flex: 1, display: 'block', textDecoration: 'none' }}>Edit page</Link>
            {/* `kind` is 'artists' | 'venues', and both now have a pane inside the
                shell — so previewing your own page no longer means leaving the
                design to look at it. */}
            <Link className="mmm-btn-ghost" href={`/app/${data.page.kind}/${data.page.slug}`}>Preview</Link>
          </div>
        </div>
      )}

      {/* Artist, venue, advertiser. Those are the things an account can ADD,
          and they are the whole list.

          Creating an artist or venue profile is a real POST /api/profiles and
          the full form already exists on /pages, so these link there instead of
          growing a second creator. The chip is not decoration: both types go
          through the verification queue all three onboarding wizards promise a
          48-hour turnaround on. Fan is absent because every account already is
          one — it is implicit and permanent.

          The ADMIN CONSOLE IS NOT HERE, and must not come back (2026-08-15).
          It was added to this row on 2026-08-14 because removing the fixed
          ADMIN MODE chip had left an administrator with no way into the console
          from inside the shell. That reasoning was about routing, and this is
          the wrong place to solve it: this row is "what this account can BE",
          and admin is not an account type any more than promoter is — the same
          rule DS8 states for the role picker. It now lives under Account, which
          is where destinations that are not profiles belong. */}
      <div className="mmm-me-add-row">
        <Link className="mmm-me-add" data-kind="artist" href="/app/me/profiles?create=artist">
          <span aria-hidden="true">＋</span>
          Add artist profile
          <span className="mmm-me-add-chip">Verification required</span>
        </Link>
        <Link className="mmm-me-add" data-kind="venue" href="/app/me/profiles?create=venue">
          <span aria-hidden="true">＋</span>
          Add venue profile
          <span className="mmm-me-add-chip">Verification required</span>
        </Link>
        {!data.hasAdvertiser && (
          /* Advertiser is a real fifth account type with no Profile row, so it
             is a card here and never a role in the switcher — it has
             /advertise/dashboard, not a dashboard of this shape. Hidden once
             the account has one: this is an ADD button and there is nothing to
             add twice.

             Points at /start, the form that CREATES the AdvertiserAccount. It
             used to point at /new, the campaign builder — so the one button
             offering the role could not confer it, and the only route that
             could (`/api/advertise/register`) refuses an email that already has
             an account, i.e. every member who could see this button. */
          <Link className="mmm-me-add" data-kind="advertiser" href="/app/me/advertising/start">
            <span aria-hidden="true">＋</span>
            Add advertiser profile
            <span className="mmm-me-add-chip">Verification required</span>
          </Link>
        )}
      </div>

      <p className="mmm-me-note">
        Promoting is not a profile. Every account can promote by sharing its HYPE Link,
        and earns from the 10% promoter pool when a ticket sells through it.
      </p>
      <AboutMeActivity data={data} />
      </section>
      )}

      {activeId === 'tickets' && (
      <section aria-label="My Tickets" className="mmm-me-section">
        {/* The tickets themselves, not a link out to them. This used to be two
            buttons into the legacy shell, which is a different header, a
            different player and no route back into MMM for the rest of the
            session — the same trap row 273 closed for the LISTEN destinations. */}
        <MmmTickets tickets={data.tickets} />
      </section>
      )}

      {/* Account panels open IN PLACE, one at a time. They used to be separate
          routes under /app/me/[panel]; the 2026-08-10 template makes ME one
          column of drawers, and each panel is only a menu of bridge links —
          no form state — so nothing is lost by not navigating.

          Open state lives in the URL rather than component state, which buys
          three things a useState could not: /app/me?panel=settings is still
          deep-linkable (the old routes redirect onto it, so existing links
          keep working), Back closes the drawer instead of leaving ME, and
          "one at a time" is structural — a single value cannot hold two. */}
      <div>
        {MMM_ME_PANELS.map((panel) => {
          // The nav list types `id` as a plain string, so this is the narrowing
          // that lets the row look up its own contents. It is also the check
          // that keeps the two lists honest: a panel added to the nav without
          // rows here renders nothing rather than crashing on an undefined
          // index — and `mmm-me-panels.test.ts` fails the build for it.
          // Captured as a const rather than narrowed in place: the narrowing
          // does not survive into the onClick closure, where it is needed.
          const panelId: MePanelId | null = isMePanelId(panel.id) ? panel.id : null;
          if (!panelId) return null;
          // One card on screen, and the dial says which. A panel that is not it
          // renders nothing at all — not a collapsed header.
          if (activeId !== panelId) return null;
          return (
            <section aria-label={panel.label} className="mmm-me-section" key={panel.id}>
              <div className="mmm-me-accordion-body">
                {ME_PANEL_ROWS[panelId].map((row) => (
                  <Link className="mmm-row" href={row.href} key={row.href + row.label} style={{ display: 'flex' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="mmm-row-title" style={{ display: 'block' }}>{row.label}</span>
                      <span className="mmm-row-sub" style={{ display: 'block' }}>{row.detail}</span>
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
                  </Link>
                ))}
                {/* The admin console, for the one account allowed to hold ADMIN.

                    It rides in SETTINGS, which is a menu of destinations that
                    are not profiles — exactly what it is. It used to be a card
                    of its own in the ME index, and there is no index any more:
                    a fifth card with no station on the dial would be a card
                    nothing could reach.

                    It is NOT in Profiles, and must not go there. Profiles is
                    "what this account can be" — artist, venue, advertiser — and
                    admin is not an account type, the same rule DS8 states for
                    promoter.

                    Still gated on `isAdmin`, resolved server-side through
                    `isAdminSession()` (the ADMIN role AND the allowlisted
                    address), so it is never drawn for an account the console
                    would refuse. Removing it outright was never an option: this
                    shell has no header, so without it an administrator has no
                    route into the console at all. */}
                {panelId === 'settings' && data.isAdmin && (
                  <Link className="mmm-row" href="/admin" style={{ display: 'flex' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="mmm-row-title" style={{ display: 'block' }}>Admin console</span>
                      <span className="mmm-row-sub" style={{ display: 'block' }}>Platform operations · opens the ops shell</span>
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
                  </Link>
                )}
              </div>
            </section>
          );
        })}

      </div>
    </>
  );
}
