'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MMM_ME_PANELS } from '@/lib/mmm-nav';
import type { MmmMeData, MmmMeRole } from '@/lib/mmm-me';

const ROLE_LABELS: Record<MmmMeRole, string> = { fan: 'Fan', artist: 'Artist', venue: 'Venue' };

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
export function MmmMe({ data }: { data: MmmMeData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  const pickRole = (role: MmmMeRole) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('role', role);
    router.replace(`/app/me?${params.toString()}`);
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

      {data.stats.length > 0 && (
        <div className="mmm-stat-grid">
          {data.stats.map((stat) => (
            <div className="mmm-card" key={stat.label}>
              <div className="mmm-stat-value">{stat.value}</div>
              <div className="mmm-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Setup, once it stopped being a gate in front of the app.
          `/welcome` used to hold a new creator on a "Set up your page →" screen
          until the wizard was done; it now lands everyone in the app, so the
          task has to travel with them or it simply disappears — and
          verification is what activates the 70% split, so disappearing is not
          an option. First card in ME, and it removes itself the moment
          `onboardedAt` is stamped. */}
      {data.setup && (
        <div className="mmm-card mmm-card-accent" style={{ padding: 15, marginBottom: 16 }}>
          <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 6, fontSize: '0.58rem' }}>Finish setup</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>
            Verification is what activates your 70% of every ticket. It takes about two minutes.
          </div>
          <Link className="mmm-btn-primary" href={data.setup.href} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>{data.setup.label}</Link>
        </div>
      )}

      {/* Events has no entry in the arc nav, because the design draws three
          modules and the arc is a coordinate table for three. This card is how
          you reach it, and `/app/events` renders the Events surface INSIDE this
          shell rather than handing you to the legacy one — so the chrome no
          longer changes under you halfway through a session.

          It is not decoration: once the legacy shell's own nav started pointing
          INTO this one (app-nav.ts, DESIGN_SYNC row 273), a member who came in
          via MAP or MUSIC had no first-class route to their tickets at all —
          only two taps deep inside the ME → Settings panel. Rendered
          unconditionally, because every member has tickets to look at even when
          they have no page to edit. */}
      <div className="mmm-card" style={{ padding: 15, marginBottom: 16 }}>
        <div className="mmm-eyebrow" style={{ marginBottom: 7, fontSize: '0.58rem' }}>Events</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="mmm-btn-ghost" href="/app/events" style={{ flex: 1, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Browse shows</Link>
          <Link className="mmm-btn-ghost" href="/app/events?tab=tickets" style={{ flex: 1, display: 'block', textAlign: 'center', textDecoration: 'none' }}>My tickets</Link>
        </div>
      </div>

      {data.page && (
        <div className="mmm-card mmm-card-accent" style={{ padding: 15, marginBottom: 16 }}>
          <div className="mmm-eyebrow mmm-eyebrow-accent" style={{ marginBottom: 6, fontSize: '0.58rem' }}>Your page</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 3 }}>{data.page.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>{data.page.status}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="mmm-btn-primary" href="/app/pages" style={{ flex: 1, display: 'block', textDecoration: 'none' }}>Edit page</Link>
            <Link className="mmm-btn-ghost" href={`/${data.page.kind}/${data.page.slug}`}>Preview</Link>
          </div>
        </div>
      )}

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

      <div className="mmm-eyebrow" style={{ marginBottom: 9 }}>Account</div>
      <div>
        {MMM_ME_PANELS.map((panel) => (
          <Link className="mmm-row" href={panel.href} key={panel.id} style={{ display: 'flex' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mmm-row-title" style={{ display: 'block' }}>{panel.label}</span>
              <span className="mmm-row-sub" style={{ display: 'block' }}>{panel.detail}</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--ink-3)' }}>›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
