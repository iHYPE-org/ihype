import { describe, expect, it, vi } from 'vitest';

/**
 * The decision the dock makes on a tap.
 *
 * `MmmDock` resolves three possibilities in order — pause the current track,
 * start what the surface registered, or turn the radio on — and that ordering
 * IS the "universal play" behaviour. It is one expression in a React component,
 * so it is restated here as a function and tested directly: the alternative is
 * a browser, and the e2e suite that does drive one needs a database.
 *
 * Kept deliberately close to the source. If the dock's expression changes, this
 * is a copy that no longer describes it — which is why the assertions are about
 * the ORDER and the fallthrough rather than about implementation details.
 */
function resolveTap({
  canTogglePlay,
  playIntent,
  onTogglePlay,
  onPlayFallback,
}: {
  canTogglePlay: boolean;
  playIntent: (() => void) | null;
  onTogglePlay: () => void;
  onPlayFallback: () => void;
}) {
  return canTogglePlay ? onTogglePlay : (playIntent ?? onPlayFallback);
}

describe('the dock transport chain', () => {
  const toggle = vi.fn();
  const intent = vi.fn();
  const fallback = vi.fn();
  const chain = (canTogglePlay: boolean, playIntent: (() => void) | null) =>
    resolveTap({ canTogglePlay, playIntent, onTogglePlay: toggle, onPlayFallback: fallback });

  it('pauses the current track before anything else', () => {
    // A loaded track means the tap is a pause. The surface's intent must not
    // win here, or tapping pause would restart the deck's card instead.
    expect(chain(true, intent)).toBe(toggle);
  });

  it('starts what the surface registered when nothing is loaded', () => {
    expect(chain(false, intent)).toBe(intent);
  });

  it('turns the radio on when the surface offers nothing', () => {
    // MAP, ME, a profile, a ticket — the surfaces that have nothing of their
    // own. This branch is what makes the transport universal rather than
    // per-surface, and it is the one that used to be a dead tap.
    expect(chain(false, null)).toBe(fallback);
  });

  it('never resolves to nothing — a tap always has an action', () => {
    for (const canTogglePlay of [true, false]) {
      for (const playIntent of [intent, null]) {
        expect(typeof chain(canTogglePlay, playIntent)).toBe('function');
      }
    }
  });
});
