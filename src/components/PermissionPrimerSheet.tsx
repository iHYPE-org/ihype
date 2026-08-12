'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PERMISSION_PRIMERS,
  primerStorageKey,
  shouldShowPrimer,
  type PermissionId,
  type PrimerDecision,
} from '@/lib/permission-primers';

/**
 * The primer sheet from `templates/permissions/Permissions.dc.html`.
 *
 * One sheet, one capability, three states — and the third state is the one
 * that matters: a refusal is a valid answer, so declining closes the sheet and
 * the caller carries on with its fallback. Nothing here renders an error.
 *
 * The decision lives in `localStorage` rather than on the account, on purpose:
 * a permission belongs to a device, not to a person. Signing in on a second
 * phone should ask again, because the second phone genuinely has not been
 * asked. It also means a member who declines is not re-asked on every visit —
 * "offered once and never nagged".
 */

/** Reads the remembered answer. Safe before hydration and in a Worker. */
export function readPrimerDecision(id: PermissionId): PrimerDecision {
  if (typeof window === 'undefined') return 'unasked';
  try {
    const raw = window.localStorage.getItem(primerStorageKey(id));
    return raw === 'accepted' || raw === 'declined' ? raw : 'unasked';
  } catch {
    // Storage can be denied outright (Safari private mode, a locked-down
    // WebView). An unreadable answer is treated as "not asked yet" rather
    // than as a decline: the sheet is harmless, the OS prompt is what we are
    // protecting, and that is still gated behind a tap.
    return 'unasked';
  }
}

function rememberPrimerDecision(id: PermissionId, decision: Exclude<PrimerDecision, 'unasked'>) {
  try {
    window.localStorage.setItem(primerStorageKey(id), decision);
  } catch {
    // Nothing to do. Worst case the sheet appears again next visit, which is
    // a smaller harm than blocking the capability.
  }
}

export function PermissionPrimerSheet({
  id,
  onAccept,
  onDecline,
  open,
}: {
  id: PermissionId;
  /** Runs only after an explicit accept. This is where the OS prompt goes. */
  onAccept: () => void;
  /** Runs on decline, dismiss, or Escape — all three are the same answer. */
  onDecline: () => void;
  open: boolean;
}) {
  const primer = PERMISSION_PRIMERS[id];
  const acceptRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus moves into the sheet and returns where it came from — the same
  // contract the app shell's drawer keeps, and the reason this is a component
  // rather than a div each caller writes for itself.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    acceptRef.current?.focus();
    return () => previouslyFocused.current?.focus?.();
  }, [open]);

  const decline = useCallback(() => {
    rememberPrimerDecision(id, 'declined');
    onDecline();
  }, [id, onDecline]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') decline();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decline, open]);

  if (!open) return null;

  const accept = () => {
    rememberPrimerDecision(id, 'accepted');
    onAccept();
  };

  return (
    <div className="primer-scrim" onPointerDown={decline} role="presentation">
      <div
        aria-describedby={`primer-body-${id}`}
        aria-labelledby={`primer-title-${id}`}
        aria-modal="true"
        className="primer-sheet"
        // The scrim closes; a tap inside must not travel up to it.
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="primer-mark" data-permission={id} aria-hidden="true" />
        <h2 className="primer-title" id={`primer-title-${id}`}>{primer.title}</h2>
        <p className="primer-body" id={`primer-body-${id}`}>{primer.body}</p>
        <div className="primer-actions">
          <button className="primer-accept" onClick={accept} ref={acceptRef} type="button">
            {primer.acceptLabel}
          </button>
          <button className="primer-decline" onClick={decline} type="button">
            {primer.declineLabel}
          </button>
        </div>
        <p className="primer-moment">{primer.moment}</p>
      </div>
    </div>
  );
}

/**
 * The state a caller needs: whether to show the sheet, and the two answers.
 *
 * `osAlreadyDecided` is the caller's job to supply, because only it knows how
 * to ask — `Notification.permission` for push, the Permissions API for
 * geolocation, a Capacitor plugin on native. Passing `true` skips the sheet
 * entirely, which is correct: once the OS has an answer, ours is theatre.
 */
export function usePermissionPrimer(id: PermissionId, osAlreadyDecided = false) {
  const [decision, setDecision] = useState<PrimerDecision>('unasked');
  const [open, setOpen] = useState(false);

  // Read after mount, never during render: localStorage is not available on
  // the server and reading it in the body would desync hydration.
  useEffect(() => { setDecision(readPrimerDecision(id)); }, [id]);

  const ask = useCallback(() => {
    if (!shouldShowPrimer({ decision: readPrimerDecision(id), osAlreadyDecided })) return false;
    setOpen(true);
    return true;
  }, [id, osAlreadyDecided]);

  return {
    /** True once the member accepted our sheet on this device. */
    accepted: decision === 'accepted',
    /** Opens the sheet if it is allowed to open. Returns whether it did. */
    ask,
    close: useCallback(() => setOpen(false), []),
    decision,
    open,
    setDecision,
  };
}
