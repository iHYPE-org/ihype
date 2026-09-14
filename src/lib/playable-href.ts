import { z } from 'zod';

/**
 * A URL a member's own playlist or favourite may carry for its audio or its
 * cover: an absolute http(s) URL, or a ROOT-RELATIVE path on this origin.
 *
 * `z.string().url()` refused the second, and the discover deck plays every
 * card through `/api/media/<hexId>` — so a heart pressed while a deck card
 * played, and "Add to playlist" from the full player on the same card, were
 * a 400 the optimistic control hid (DESIGN_SYNC row 437). A stored copy of a
 * track's url (`ArtistMediaAsset.storageUrl`) is absolute; the path the app
 * hands the player for a proxied stream is not, and both are ours to play.
 *
 * Refused on purpose: a scheme-relative `//host/path` (a different origin
 * dressed as a path), any scheme that is not http(s) (`javascript:`, `data:`
 * — a stored favourite is rendered into an <audio> src and an <img> src for
 * the rest of the account's life), and anything over 2000 characters.
 */
export function isPlayableHref(value: string): boolean {
  if (value.length === 0 || value.length > 2000) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const playableHref = z.string().trim().refine(isPlayableHref, 'Not a playable URL');
