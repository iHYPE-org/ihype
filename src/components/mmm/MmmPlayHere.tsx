'use client';

import { useRegisterQueue } from '@/components/mmm/MmmPlayIntent';
import type { PlayableRow } from '@/lib/mmm-play';

/**
 * Hands whatever this page is about to the dock's transport. Renders nothing.
 *
 * It exists because every play-capable surface under `/app` is a SERVER
 * component and the intent registry is a client context, so something has to
 * cross that line. A null-rendering registrar is a smaller thing to cross it
 * with than making a whole page a client component for one hook.
 *
 * One component for all of them: a track page passes a single row, a playlist
 * passes its items, an artist passes their published releases. The only thing
 * that differs is the list, and `toQueue` already reads a row from any of the
 * app's endpoints.
 *
 * With no playable audio `useRegisterQueue` registers nothing and the dock falls
 * through to the radio — the honest outcome, because there is nothing HERE to
 * play. Every one of these pages could previously be reached with no way to hear
 * its own subject, and two of them did not even select the audio column.
 */
export function MmmPlayHere({ rows }: { rows: readonly PlayableRow[] }) {
  useRegisterQueue(rows);
  return null;
}
