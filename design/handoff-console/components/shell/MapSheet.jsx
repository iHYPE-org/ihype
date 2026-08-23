'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   TWO REAL BUGS FIXED, both invisibility:
   
   1. Every divider was 'rgba(246,236,217,.07)' — that is ON-WALNUT ink at 7%
      opacity, painted on a LIGHT parchment sheet. The rules were invisible. It
      appears three times (lineup rows, stat rows). Now var(--map-line).
      Same defect in the title link's textDecorationColor.
   
   2. The primary CTA was color:'#fff' on a --accent fill. White on #ff5029 is
      3.27:1 and fails AA everywhere — this is the exact combination the design
      system names as forbidden. Now var(--ink-on-accent).
   
   Also:
   · surfaces #fbf3de / #efe1bd had no tokens → var(--map-void) and a mixed step
     off it, so the sheet belongs to the map's material rather than inventing a
     third parchment
   · borderRadius 22 → var(--radius-panel); pills → var(--radius-pill)
   · shadow rgba(4,8,18,.6) was NAVY → var(--shadow-raised)
   · fontSize 10/12/12.5/13/13.5/14 → the token scale; the body copy, row labels
     and lineup meta are all content and were all under the 15px floor
   · close button 32 → 44 (touch-target floor)
   · the avatar's accent initial was raw --accent as text → var(--accent-text) */

/**
 * The pin detail sheet. It belongs to the map: leaving the map must close it,
 * or it floats over a module pane as orphaned chrome.
 *
 * It rises from the bottom edge and stops short of the chrome band, so the logo
 * trigger and the player stay reachable while a sheet is open — the sheet is a
 * peer of the map, not a modal over the whole frame.
 */
export function MapSheet({ target, onClose }) {
  if (!target) return null;
  const rows = target.rows || [];
  const lines = target.lines || [];

  return (
    <div
      role="dialog"
      aria-label={target.title}
      style={{
        /* The sheet ENDS above the player rather than running under it. Padding
           inside a scrolling box only adds empty space at the end of the scroll
           — it cannot stop the player painting over the band it occupies.
           Clearing the whole chrome row is the only version that is true at
           every scroll position: 26 inset + 88 pill + 14. It is a floating card,
           not a bottom sheet, so it is radiused on all four corners. */
        position: 'fixed',
        left: '50%',
        bottom: 128,
        transform: 'translateX(-50%)',
        width: 'min(620px, calc(100% - var(--space-12)))',
        maxHeight: 'calc(100dvh - 176px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        background: 'var(--map-void)',
        border: '1px solid var(--map-line)',
        borderRadius: 'var(--radius-panel)',
        padding: 'var(--space-5) var(--space-6) var(--space-6)',
        boxShadow: 'var(--shadow-raised)',
        fontFamily: 'var(--font-body)',
        color: 'var(--map-ink)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--radius-pill)',
            flex: '0 0 auto',
            background: 'color-mix(in oklab, var(--map-void) 80%, var(--ink-1))',
            border: '1px solid var(--map-line)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--text-md)',
            color: 'var(--accent-text)',
          }}
        >{(target.title || '?').charAt(0)}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {target.kind && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
              color: 'var(--map-ink)',
              opacity: 0.7,
              marginBottom: 'var(--space-1)',
            }}>{target.kind}</div>
          )}
          {/* The name IS the link. It is the biggest thing on the sheet and the
              thing you came to read, so making it inert and putting the
              navigation in a button further down asks you to find the
              destination twice. Falls back to plain text with no route. */}
          {target.action && target.action.href ? (
            <a
              href={target.action.href}
              target="_top"
              style={{
                display: 'inline-block',
                color: 'var(--map-ink)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--map-line)',
                textUnderlineOffset: 4,
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: 'var(--text-lg)',
                letterSpacing: 'var(--tracking-normal)',
              }}
            >{target.title}</a>
          ) : (
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 'var(--text-lg)',
              letterSpacing: 'var(--tracking-normal)',
            }}>{target.title}</div>
          )}
          {target.meta && (
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--map-ink)', opacity: 0.75, marginTop: 'var(--space-1)' }}>{target.meta}</div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-pill)',
            flex: '0 0 auto',
            background: 'transparent',
            border: '1px solid var(--map-line)',
            color: 'var(--map-ink)',
            cursor: 'pointer',
            fontSize: 'var(--text-base)',
          }}
        ><span aria-hidden="true">{'\u2715'}</span></button>
      </div>

      {target.body && (
        <p style={{
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--leading-body)',
          color: 'var(--map-ink)',
          opacity: 0.85,
          margin: 'var(--space-4) 0 0',
          textWrap: 'pretty',
        }}>{target.body}</p>
      )}

      {/* A day's lineup, when the pin was opened on a date: time + who + what it
          costs, in the order they play. This is the "what is happening here
          today" screen, so it outranks the stat rows below it. */}
      {lines.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--map-line)' }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid var(--map-line)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--map-ink)', opacity: 0.7, flex: '0 0 62px' }}>{l.time}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 400,
                  fontSize: 'var(--text-base)',
                  letterSpacing: 'var(--tracking-normal)',
                  color: 'var(--map-ink)',
                  display: 'block',
                }}>{l.title}</span>
                {l.meta && <span style={{ fontSize: 'var(--text-base)', color: 'var(--map-ink)', opacity: 0.75 }}>{l.meta}</span>}
              </span>
              {l.value && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--map-ink)', opacity: 0.8, flex: '0 0 auto' }}>{l.value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {target.action && (
        <a
          href={target.action.href || '#'}
          target="_top"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            minHeight: 44,
            marginTop: 'var(--space-4)',
            background: 'var(--accent)',
            color: 'var(--ink-on-accent)',
            textDecoration: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '0 var(--space-5)',
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--text-base)',
            letterSpacing: 'var(--tracking-normal)',
          }}
        >{target.action.label}<span aria-hidden="true">{'\u2192'}</span></a>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)', borderTop: '1px solid var(--map-line)' }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid var(--map-line)',
              fontSize: 'var(--text-base)',
            }}>
              <span style={{ color: 'var(--map-ink)', opacity: 0.8, flex: 1 }}>{r.label}</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: r.accent ? 'var(--accent-text)' : 'var(--map-ink)',
              }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
