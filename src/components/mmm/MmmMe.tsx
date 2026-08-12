'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MMM_ME_PANELS } from '@/lib/mmm-nav';
import { MmmTickets } from './MmmTickets';
import { ME_PANEL_ROWS, isMePanelId, type MePanelId } from '@/lib/mmm-me-panels';
import type { MmmMeData, MmmMeRole } from '@/lib/mmm-me';

const ROLE_LABELS: Record<MmmMeRole, string> = { fan: 'Fan', artist: 'Artist', venue: 'Venue' };

/**
 * The drawers above the account panels. Order is the design system's —
 * Profiles · My Tickets · About Me · Settings — and Profiles is `first`, the
 * one showing before anyone has chosen.
 */
type MeSectionId = 'profiles' | 'tickets' | 'about';
const FIRST_ME_SECTION: MeSectionId = 'profiles';

/**
 * The ME surface — a role-aware dashboard.
 *
 * From the app-shell redesign: ME has no fan-out submenu; Settings, Info, Legal
 * and Accessibility are rows on this surface. The role switcher shows only the
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
 * Why accordions rather than four stacked cards: ME is the only surface in this
 * shell with no search and no tabs, so everything an account has lives on one
 * scroll. Left open, three screens of stats sit between the member and the
 * Account rows, which are what most visits are actually for. Collapsed, the
 * whole surface is one screen.
 *
 * Profiles opens by default, and is first: it is the only section that changes
 * what the account IS, and its add buttons are what a new member came for. The
 * stats it carries used to be a separate "Your year" section above everything
 * else, which put a screen of numbers between the member and the thing they
 * opened ME to do.
 *
 * **One drawer open at a time, page-wide** — the sections here and the account
 * panels below are ONE group, not two. Each section used to hold its own
 * `useState`, so all three could stand open at once alongside a settings panel;
 * six open drawers is the state the folding was introduced to prevent. The open
 * id therefore lives in the parent (`meGroup`), which makes "one at a time"
 * structural rather than a rule every toggle has to remember.
 */
function Accordion({
  children,
  detail,
  label,
  onToggle,
  open,
}: {
  children: React.ReactNode;
  /**
   * A second line under the label, saying what is inside without opening it.
   * Added by the 2026-08-10 template: a closed accordion labelled only
   * "Profiles" tells you nothing about whether opening it is worth the tap.
   * Omitted rather than rendered empty when the underlying figure could not be
   * read — see `ticketCount`.
   */
  detail?: string | null;
  label: string;
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <div className="mmm-me-section">
      <button
        aria-expanded={open}
        className="mmm-me-accordion"
        onClick={onToggle}
        type="button"
      >
        <span className="mmm-me-accordion-text">
          <span className="mmm-me-accordion-label">{label}</span>
          {detail ? <span className="mmm-me-accordion-detail">{detail}</span> : null}
        </span>
        {/* One element rotated, not two glyphs: a single node cannot render a
            chevron that disagrees with aria-expanded. */}
        <span aria-hidden="true" className="mmm-me-accordion-chevron" data-open={open || undefined}>›</span>
      </button>
      {open && <div className="mmm-me-accordion-body">{children}</div>}
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
  const openPanel = isMePanelId(rawPanel) ? rawPanel : null;

  /**
   * Which of the three sections above the account panels is open.
   *
   * `undefined` means nobody has chosen yet, so the section marked first
   * (Profiles) is the one showing; `''` means someone chose to close what was
   * open, or opened a panel instead, and nothing above is showing. That
   * three-valued shape is the design system's own `meSection(id, first)` helper
   * — a plain `'profiles' | null` cannot tell "not chosen yet" from "closed",
   * and would either re-open Profiles or never open it.
   */
  const [meGroup, setMeGroup] = useState<MeSectionId | '' | undefined>(undefined);

  /**
   * The default only applies when nothing else is open. Arriving on
   * `/app/me?panel=settings` — a deep link, and where the four retired
   * `/app/me/[panel]` routes redirect to — must not also open Profiles, or the
   * page loads with two drawers open and the one the URL asked for pushed a
   * screen down. The design system's helper has no equivalent guard because
   * its panels cannot be open on arrival; ours can.
   */
  const openSection: MeSectionId | null =
    meGroup === undefined ? (openPanel ? null : FIRST_ME_SECTION) : meGroup || null;

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

  const togglePanel = (id: MePanelId) => {
    setPanel(openPanel === id ? null : id);
    // Opening a panel shuts every section above it. Symmetric with
    // `toggleSection`, and between them they are what makes one-at-a-time hold
    // across two stores — component state up here, the URL down there.
    setMeGroup('');
  };

  const toggleSection = (id: MeSectionId) => {
    const isOpen = openSection === id;
    setMeGroup(isOpen ? '' : id);
    // Only touches the URL when there is actually a panel open to close —
    // otherwise every section tap would push a history entry identical to the
    // current one, and Back would walk through them one dead step at a time.
    if (!isOpen && openPanel) setPanel(null);
  };

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





      {/* The HYPE link is NOT a drawer. `templates/simplified-app/`: "ME pane.
          Six things, in one column: HYPE Link, Profiles, My Tickets, About Me,
          Settings, Log Out. Everything BELOW the link is a drawer" — so the
          link sits above them, always on screen.

          It had been nested inside the About Me drawer since the accordion
          rebuild, which hid a fan's primary surface behind a collapsed panel
          labelled "What artists and venues see" — the one thing the HYPE link
          is not. Two e2e tests had been asserting it visible all along. */}
      {data.hypeLink && (
        <div className="mmm-card" style={{ padding: 15, marginBottom: 16 }}>
          <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 7, fontSize: '0.58rem' }}>Your HYPE link</div>
          {data.role === 'fan' && (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 9 }}>
              Share it — friends see what you hype, and shows you can go to together.
            </div>
          )}
          <div className="mmm-link-field">
            <span className="mmm-link-value">{data.hypeLink.url}</span>
            <button
              className="mmm-btn-primary"
              onClick={() => void copy()}
              style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 7, fontSize: '0.72rem' }}
              type="button"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {/* Only figures that were actually read are rendered. A referral count
              that failed to load is absent, not zero. */}
          {(data.hypeLink.tickets !== null || data.hypeLink.earnedCents !== null) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 9 }}>
              {data.hypeLink.tickets !== null && (
                <div style={{ padding: 9, borderRadius: 9, background: 'var(--hair-30)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)', lineHeight: 1 }}>
                    {data.hypeLink.tickets}
                  </div>
                  <div className="mmm-stat-label" style={{ marginTop: 4, fontSize: '0.53rem' }}>Tickets</div>
                </div>
              )}
              {data.hypeLink.earnedCents !== null && (
                <div style={{ padding: 9, borderRadius: 9, background: 'var(--hair-30)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)', lineHeight: 1 }}>
                    ${(data.hypeLink.earnedCents / 100).toFixed(0)}
                  </div>
                  <div className="mmm-stat-label" style={{ marginTop: 4, fontSize: '0.53rem' }}>Earned</div>
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: '0.74rem', color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Share any show with this link. Every ticket it sells earns your proportional cut of the 10% promoter pool —
            never the artist&rsquo;s 70%. Promoting needs no role and no signup.
          </div>
        </div>
      )}

      <Accordion
        detail="Fan · add artist, venue or advertiser"
        label="Profiles"
        onToggle={() => toggleSection('profiles')}
        open={openSection === 'profiles'}
      >
      {/* The stats that used to sit in a separate "Your year" section. The
          2026-08-10 template folds them under Profiles and labels them by role,
          because a figure like "Shows attended" belongs to the profile it was
          earned by — and a standing section of numbers above the thing you came
          to do was the top third of a phone screen. */}
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
          <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 6, fontSize: '0.58rem' }}>Your page</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 3 }}>{data.page.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>{data.page.status}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="mmm-btn-primary" href="/pages" style={{ flex: 1, display: 'block', textDecoration: 'none' }}>Edit page</Link>
            <Link className="mmm-btn-ghost" href={`/${data.page.kind}/${data.page.slug}`}>Preview</Link>
          </div>
        </div>
      )}

      {/* Creating an artist or venue profile is a real POST /api/profiles, and
          the full form already exists on /pages — so these link there instead of
          growing a second creator. The chip is not decoration: both types go
          through the verification queue all three onboarding wizards promise a
          48-hour turnaround on. Fan is absent because every account already is
          one — it is implicit and permanent. */}
      <div className="mmm-me-add-row">
        <Link className="mmm-me-add" data-kind="artist" href="/pages?create=artist">
          <span aria-hidden="true">＋</span>
          Add artist profile
          <span className="mmm-me-add-chip">Verified</span>
        </Link>
        <Link className="mmm-me-add" data-kind="venue" href="/pages?create=venue">
          <span aria-hidden="true">＋</span>
          Add venue profile
          <span className="mmm-me-add-chip">Verified</span>
        </Link>
        {!data.hasAdvertiser && (
          /* Advertiser is a real fifth account type with no Profile row, so it
             is a card here and never a role in the switcher — it has
             /advertise/dashboard, not a dashboard of this shape. Hidden once
             the account has one: this is an ADD button and there is nothing to
             add twice. */
          <Link className="mmm-me-add" data-kind="advertiser" href="/advertise/register">
            <span aria-hidden="true">＋</span>
            Add advertiser profile
            <span className="mmm-me-add-chip">Verified</span>
          </Link>
        )}
      </div>

      <p className="mmm-me-note">
        Promoting is not a profile. Every account can promote by sharing its HYPE Link,
        and earns from the 10% promoter pool when a ticket sells through it.
      </p>
      </Accordion>

      <Accordion
        detail={data.ticketCount === null ? null : `${data.ticketCount} ticket${data.ticketCount === 1 ? '' : 's'} · transfer at face value`}
        label="My Tickets"
        onToggle={() => toggleSection('tickets')}
        open={openSection === 'tickets'}
      >
        {/* The tickets themselves, not a link out to them. This used to be two
            buttons into the legacy shell, which is a different header, a
            different player and no route back into MMM for the rest of the
            session — the same trap row 273 closed for the LISTEN destinations. */}
        <MmmTickets tickets={data.tickets} />
      </Accordion>

      <Accordion
        detail="What artists and venues see"
        label="About Me"
        onToggle={() => toggleSection('about')}
        open={openSection === 'about'}
      >

      {data.activity.length > 0 && (
        <>
          <div className="mmm-eyebrow" style={{ marginBottom: 9 }}>{data.activityLabel}</div>
          <div style={{ marginBottom: 20 }}>
            {data.activity.map((row) => (
              <div
                key={`${row.title}-${row.sub}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 2px', borderBottom: '1px solid var(--hair-70)' }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>{row.title}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--ink-3)', marginTop: 1 }}>{row.sub}</div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: row.tone === 'positive' ? 'var(--success)' : row.tone === 'hot' ? 'var(--accent-text)' : 'var(--ink-3)',
                  }}
                >
                  {row.amount}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      </Accordion>

      {/* Account panels open IN PLACE, one at a time. They used to be four
          routes under /app/me/[panel]; the 2026-08-10 template makes ME one
          column of drawers, and each panel is only a menu of bridge links —
          no form state — so nothing is lost by not navigating.

          Open state lives in the URL rather than component state, which buys
          three things a useState could not: /app/me?panel=settings is still
          deep-linkable (the old routes redirect onto it, so existing links
          keep working), Back closes the drawer instead of leaving ME, and
          "one at a time" is structural — a single value cannot hold two. */}
      <div className="mmm-eyebrow" style={{ marginBottom: 9 }}>Account</div>
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
          const open = openPanel === panelId;
          return (
            <div className="mmm-me-section" key={panel.id}>
              <button
                aria-expanded={open}
                className="mmm-me-accordion"
                onClick={() => togglePanel(panelId)}
                type="button"
              >
                <span className="mmm-me-accordion-text">
                  <span className="mmm-me-accordion-label">{panel.label}</span>
                  <span className="mmm-me-accordion-detail">{panel.detail}</span>
                </span>
                <span aria-hidden="true" className="mmm-me-accordion-chevron" data-open={open || undefined}>›</span>
              </button>
              {open && (
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
