/**
 * The player's clock stays out of the hook every surface reads (2026-09-24,
 * DESIGN_SYNC row 513).
 *
 * `useMediaPlayer()` used to merge the stable actions with a context that
 * changed on every `timeupdate`, so every consumer (the whole shell, the map
 * layer, every release row's play button) re-rendered about four times a
 * second for as long as anything played. The clock is its own context now and
 * only the components that draw time read it. The type system holds most of
 * this (a consumer reading `currentTime` from `useMediaPlayer()` does not
 * compile); this test holds the parts it cannot.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const player = readFileSync('src/components/GlobalMediaPlayer.tsx', 'utf8');
const shell = readFileSync('src/components/mmm/MmmShell.tsx', 'utf8');

function body(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`missing ${signature}`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') { depth -= 1; if (depth === 0) return source.slice(open, i + 1); }
  }
  throw new Error(`unbalanced ${signature}`);
}

describe('media player contexts', () => {
  it('useMediaPlayer() never reads the clock context', () => {
    const hook = body(player, 'export function useMediaPlayer()');
    expect(hook).not.toContain('MediaPlayerClockCtx');
  });

  it('the shell reads the clock only inside the wrapper that draws the full player', () => {
    const root = body(shell, 'export function MmmShell(');
    expect(root).not.toContain('useMediaPlayerClock');
    expect(body(shell, 'function ClockedFullPlayer(')).toContain('useMediaPlayerClock');
  });

  it('compares a media element\'s resolved src with a resolved URL, never a raw relative one', () => {
    expect(player).not.toMatch(/audio\.src !== currentTrack\.url/);
    expect(player).not.toMatch(/pre\.src === currentTrack\.url/);
    expect(player).toMatch(/resolveMediaUrl\(currentTrack\.url\)/);
  });

  it('does not preload from a queue the playing track is not in', () => {
    expect(player).toMatch(/currentIndex >= 0 \? queue\[currentIndex \+ 1\]\?\.url : undefined/);
  });
});
