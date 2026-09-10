'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PermissionPrimerSheet, usePermissionPrimer } from '@/components/PermissionPrimerSheet';
import {
  extractTicketCode,
  hashTicketCode,
  isUsableManifest,
  judgeOffline,
  type DoorManifest,
  type LocalDoorScan,
} from '@/lib/door-manifest';
import { warmDoorCache } from '@/lib/private-cache';

/**
 * The venue's door: a camera that reads ticket QRs, a guest list that works
 * with no signal, and a queue that tells the server what happened once there
 * is one.
 *
 * Three states of connectivity, and the door must work in all of them:
 *
 *   ONLINE   — every code goes to `POST /api/shows/:id/scan`, which is the
 *              atomic VALID→SCANNED transition. The server's answer is shown.
 *   OFFLINE  — the code is hashed and looked up in the MANIFEST downloaded
 *              earlier (`GET /api/shows/:id/door-manifest`, hashes and names,
 *              never a redeemable code — see src/lib/door-manifest.ts). An
 *              admission is recorded here as PENDING.
 *   BACK     — every pending scan is posted with the moment it happened. A 409
 *              means the same ticket was also scanned elsewhere, and the row
 *              says so; the phone never resolves that by itself.
 *
 * Reading the QR: `BarcodeDetector` where the platform has it (Chromium,
 * Safari 17+ on iOS), jsQR otherwise — loaded on demand, so a page that never
 * opens the camera never downloads a decoder. Both read a frame and drop it,
 * which is the promise the camera primer makes. `getUserMedia` is reached
 * only after the primer's explicit accept, or from the button the denied
 * state leaves behind: the manual code field works with no camera at all,
 * which is MOBILE.md's rule that the denied fallback still works.
 *
 * Storage is `localStorage` under the show's id, wrapped in try/catch (Safari
 * private mode throws on access). Holder names are on the phone by necessity
 * — the door has to greet someone — so "Remove the list from this phone" is a
 * real control, and sign-out's CLEAR_PRIVATE drops the cached page.
 */

type Show = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venueName: string | null;
  headlinerName: string | null;
};

type CameraState = 'off' | 'starting' | 'live' | 'denied' | 'unsupported' | 'error';

type Verdict = {
  tone: 'admit' | 'refuse' | 'warn' | 'info';
  title: string;
  detail: string;
};

type Decoder =
  | { kind: 'native'; detector: { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }
  | { kind: 'jsqr'; decode: (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null; canvas: HTMLCanvasElement };

const SCAN_INTERVAL_MS = 180;
/** How often pending scans are retried while any wait. The `online` event is
 *  the fast path, not the only one: a WebView whose flag never flipped, or a
 *  network that came back while a post was mid-flight, must still drain. */
const SYNC_RETRY_MS = 15_000;
/** The same code read twice inside this window is one presentation, not two. */
const REPEAT_WINDOW_MS = 3000;
const LOG_LIMIT = 30;

function storageKey(showId: string, part: 'manifest' | 'scans') {
  return `ihype-door:${showId}:${part}`;
}

function readStored<T>(key: string, guard: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isScanList(value: unknown): value is LocalDoorScan[] {
  return Array.isArray(value) && value.every((row) => row && typeof row === 'object' && typeof (row as LocalDoorScan).hash === 'string');
}

function formatClock(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function describeAge(iso: string, now: number, t: (key: string, fallback: string) => string) {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return t('doorScanner.justNow', 'just now');
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} ${t('doorScanner.minAgo', 'min ago')}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${t('doorScanner.hAgo', 'h ago')}`;
  return `${Math.round(hours / 24)} ${t('doorScanner.dAgo', 'd ago')}`;
}

export function DoorScanner({ show }: { show: Show }) {
  const { t } = useI18n();
  const primer = usePermissionPrimer('camera');
  const pagePath = `/app/me/shows/${show.slug}/scan`;

  const [manifest, setManifest] = useState<DoorManifest | null>(null);
  const [scans, setScans] = useState<LocalDoorScan[]>([]);
  const [online, setOnline] = useState(true);
  const [camera, setCamera] = useState<CameraState>('off');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastReadRef = useRef<{ code: string; at: number } | null>(null);
  const scansRef = useRef<LocalDoorScan[]>([]);
  const manifestRef = useRef<DoorManifest | null>(null);
  const syncingRef = useRef(false);
  const handlingRef = useRef(false);

  // Storage is read after mount, never during render: it is not on the server
  // and a read in the body would desync hydration on the cached page.
  useEffect(() => {
    const storedManifest = readStored(storageKey(show.id, 'manifest'), (v): v is DoorManifest => isUsableManifest(v, show.id));
    const storedScans = readStored(storageKey(show.id, 'scans'), isScanList) ?? [];
    manifestRef.current = storedManifest;
    scansRef.current = storedScans;
    setManifest(storedManifest);
    setScans(storedScans);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
  }, [show.id]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.clearInterval(tick);
    };
  }, []);

  const commitScans = useCallback((next: LocalDoorScan[]) => {
    scansRef.current = next;
    setScans(next);
    writeStored(storageKey(show.id, 'scans'), next);
  }, [show.id]);

  const commitManifest = useCallback((next: DoorManifest | null) => {
    manifestRef.current = next;
    setManifest(next);
    writeStored(storageKey(show.id, 'manifest'), next);
  }, [show.id]);

  const recordScan = useCallback((scan: LocalDoorScan) => {
    const next = [scan, ...scansRef.current.filter((row) => !(row.hash === scan.hash && row.sync === 'pending' && scan.sync !== 'pending'))];
    commitScans(next.slice(0, 500));
  }, [commitScans]);

  /* ── The server's answer, when it can be asked ─────────────────────────── */

  const postScan = useCallback(async (code: string, at?: string) => {
    let response: Response;
    try {
      response = await fetch(`/api/shows/${show.id}/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(at ? { ticketId: code, scannedAt: at } : { ticketId: code }),
      });
    } catch (error) {
      /* The one reliable signal. `navigator.onLine` is a hint the platform
         may never update (measured: Playwright's offline emulation leaves it
         true, and WebViews are not above the same), so the door believes
         what its own requests do: a failed fetch is offline, an answered one
         is online. */
      setOnline(false);
      throw error;
    }
    setOnline(true);
    let body: { ok?: boolean; error?: string; ticket?: { holderName?: string; scannedAt?: string }; scannedAt?: string } = {};
    try { body = await response.json(); } catch { /* a non-JSON body is read as its status alone */ }
    return { status: response.status, body };
  }, [show.id]);

  /* ── Sync: every pending scan, in order, once there is a network ───────── */

  const syncPending = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = scansRef.current.filter((row) => row.sync === 'pending');
    if (!pending.length) return;
    syncingRef.current = true;
    try {
      for (const scan of [...pending].reverse()) {
        let result: Awaited<ReturnType<typeof postScan>>;
        try {
          result = await postScan(scan.code, scan.at);
        } catch {
          return; // Still offline. Leave the rest pending; the online event retries.
        }
        const rows = scansRef.current.map((row) => {
          if (row !== scan && !(row.hash === scan.hash && row.at === scan.at)) return row;
          if (result.status === 200) return { ...row, sync: 'synced' as const, name: result.body.ticket?.holderName ?? row.name };
          if (result.status === 409) {
            return {
              ...row,
              sync: 'duplicate' as const,
              note: result.body.scannedAt
                ? `${t('doorScanner.alsoScannedAt', 'also scanned elsewhere at')} ${formatClock(result.body.scannedAt)}`
                : t('doorScanner.alsoScannedElsewhere', 'also scanned elsewhere'),
            };
          }
          if (result.status === 401 || result.status === 403 || result.status >= 500) return row; // Not this scan's fault; keep it pending.
          return { ...row, sync: 'refused' as const, note: result.body.error ?? `${result.status}` };
        });
        commitScans(rows);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [commitScans, postScan, t]);

  useEffect(() => {
    if (online) void syncPending();
  }, [online, scans.length, syncPending]);

  useEffect(() => {
    const retry = window.setInterval(() => {
      if (scansRef.current.some((row) => row.sync === 'pending')) void syncPending();
    }, SYNC_RETRY_MS);
    return () => window.clearInterval(retry);
  }, [syncPending]);

  /* ── One code, from the camera or the field ────────────────────────────── */

  const handleCode = useCallback(async (raw: string) => {
    if (handlingRef.current) return;
    const code = extractTicketCode(raw);
    if (!code) {
      setVerdict({ tone: 'info', title: t('doorScanner.notATicket', 'Not an iHYPE ticket'), detail: t('doorScanner.notATicketDetail', 'That code is not a ticket for this show.') });
      return;
    }
    const last = lastReadRef.current;
    const readAt = Date.now();
    if (last && last.code === code && readAt - last.at < REPEAT_WINDOW_MS) return;
    lastReadRef.current = { code, at: readAt };

    handlingRef.current = true;
    setBusy(true);
    try {
      const hash = await hashTicketCode(show.id, code);
      const at = new Date(readAt).toISOString();

      // Scanned on this phone already: the same answer online or off, and no
      // round trip needed to give it.
      const local = judgeOffline(null, scansRef.current, hash);
      if (local.kind === 'duplicate') {
        setVerdict({
          tone: 'warn',
          title: t('doorScanner.alreadyInHere', 'Already checked in here'),
          detail: `${local.name ?? t('doorScanner.guest', 'Guest')} · ${local.at ? formatClock(local.at) : ''}`.trim(),
        });
        return;
      }

      if (online) {
        try {
          const result = await postScan(code);
          if (result.status === 200) {
            const name = result.body.ticket?.holderName ?? t('doorScanner.guest', 'Guest');
            recordScan({ code, hash, name, at, sync: 'synced' });
            setVerdict({ tone: 'admit', title: t('doorScanner.admit', 'Admit'), detail: name });
            return;
          }
          if (result.status === 409) {
            recordScan({ code, hash, name: null, at, sync: 'duplicate', note: t('doorScanner.alreadyScannedNote', 'already scanned') });
            setVerdict({
              tone: 'refuse',
              title: t('doorScanner.alreadyScanned', 'Already scanned'),
              detail: result.body.scannedAt
                ? `${t('doorScanner.usedAt', 'This ticket was used at')} ${formatClock(result.body.scannedAt)}`
                : t('doorScanner.usedAlready', 'This ticket has already been used.'),
            });
            return;
          }
          if (result.status === 404) {
            recordScan({ code, hash, name: null, at, sync: 'refused', note: t('doorScanner.notForThisShow', 'not a ticket for this show') });
            setVerdict({ tone: 'refuse', title: t('doorScanner.notForThisShowTitle', 'Not for this show'), detail: t('doorScanner.notForThisShowDetail', 'No ticket with this code was issued for tonight.') });
            return;
          }
          if (result.status === 410) {
            recordScan({ code, hash, name: null, at, sync: 'refused', note: t('doorScanner.void', 'void') });
            setVerdict({ tone: 'refuse', title: t('doorScanner.voidTitle', 'Ticket void'), detail: t('doorScanner.voidDetail', 'This ticket was cancelled or refunded.') });
            return;
          }
          if (result.status === 401 || result.status === 403) {
            setVerdict({ tone: 'info', title: t('doorScanner.notYourDoor', 'Not your door'), detail: t('doorScanner.notYourDoorDetail', 'This account cannot check tickets in for this show.') });
            return;
          }
          // A 5xx falls through to the list, the same as no network.
        } catch {
          // The network went while we were asking. Fall through to the list.
        }
      }

      const offline = judgeOffline(manifestRef.current, scansRef.current, hash);
      if (offline.kind === 'admit') {
        recordScan({ code, hash, name: offline.name, at, sync: 'pending' });
        setVerdict({ tone: 'admit', title: t('doorScanner.admit', 'Admit'), detail: `${offline.name} · ${t('doorScanner.willSync', 'recorded here, syncs when you are back online')}` });
      } else if (offline.kind === 'already-scanned') {
        recordScan({ code, hash, name: null, at, sync: 'duplicate', note: t('doorScanner.scannedBeforeDownload', 'scanned before the list was downloaded') });
        setVerdict({ tone: 'refuse', title: t('doorScanner.alreadyScanned', 'Already scanned'), detail: t('doorScanner.alreadyScannedBeforeList', 'This ticket was used before the list was downloaded.') });
      } else if (!manifestRef.current) {
        setVerdict({ tone: 'info', title: t('doorScanner.noList', 'No list on this phone'), detail: t('doorScanner.noListDetail', 'You are offline and the guest list was not downloaded. Reconnect, or check the fan in by name.') });
      } else {
        recordScan({ code, hash, name: null, at, sync: 'local-only', note: t('doorScanner.notOnList', 'not on the downloaded list') });
        setVerdict({
          tone: 'warn',
          title: t('doorScanner.notOnListTitle', 'Not on the list'),
          detail: `${t('doorScanner.notOnListDetail', 'Not among the tickets downloaded')} ${describeAge(manifestRef.current.fetchedAt, Date.now(), t)}. ${t('doorScanner.notOnListHint', 'A ticket bought since then will not be here — refresh the list when you have signal.')}`,
        });
      }
    } finally {
      handlingRef.current = false;
      setBusy(false);
    }
  }, [online, postScan, recordScan, show.id, t]);

  /* ── The camera ────────────────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    if (loopRef.current !== null) {
      window.clearTimeout(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera((state) => (state === 'live' || state === 'starting' ? 'off' : state));
  }, []);

  const loadDecoder = useCallback(async (): Promise<Decoder> => {
    if (decoderRef.current) return decoderRef.current;
    const w = window as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => Decoder extends { kind: 'native'; detector: infer D } ? D : never;
    } & { BarcodeDetector?: { getSupportedFormats?: () => Promise<string[]> } };
    let decoder: Decoder | null = null;
    if (typeof w.BarcodeDetector === 'function') {
      try {
        const formats = (await w.BarcodeDetector.getSupportedFormats?.()) ?? ['qr_code'];
        if (formats.includes('qr_code')) {
          decoder = { kind: 'native', detector: new w.BarcodeDetector({ formats: ['qr_code'] }) };
        }
      } catch {
        decoder = null;
      }
    }
    if (!decoder) {
      const mod = await import('jsqr');
      decoder = { kind: 'jsqr', decode: mod.default, canvas: document.createElement('canvas') };
    }
    decoderRef.current = decoder;
    return decoder;
  }, []);

  const readFrame = useCallback(async () => {
    const video = videoRef.current;
    const decoder = decoderRef.current;
    if (!video || !decoder || video.readyState < 2) return;
    try {
      if (decoder.kind === 'native') {
        const codes = await decoder.detector.detect(video);
        if (codes[0]?.rawValue) await handleCode(codes[0].rawValue);
        return;
      }
      const scale = Math.min(1, 640 / Math.max(1, video.videoWidth));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      const { canvas } = decoder;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, width, height);
      const frame = context.getImageData(0, 0, width, height);
      const hit = decoder.decode(frame.data, width, height, { inversionAttempts: 'dontInvert' });
      if (hit?.data) await handleCode(hit.data);
    } catch {
      // One unreadable frame is one unreadable frame.
    }
  }, [handleCode]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }
    setCamera('starting');
    try {
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
        loadDecoder(),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCamera('off');
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCamera('live');
      const loop = async () => {
        await readFrame();
        if (streamRef.current) loopRef.current = window.setTimeout(loop, SCAN_INTERVAL_MS);
      };
      loopRef.current = window.setTimeout(loop, SCAN_INTERVAL_MS);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unsupported' : 'error');
    }
  }, [loadDecoder, readFrame]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // A door phone goes in a pocket between fans. Release the camera when the
  // page is hidden rather than holding it (and its light) for nothing.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopCamera();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [stopCamera]);

  const openCamera = useCallback(() => {
    // Our sheet first, the OS prompt only after its accept. A member who
    // declined earlier and now taps the button again is asking at the moment
    // of use, which is the one moment the prompt is right.
    if (primer.ask()) return;
    void startCamera();
  }, [primer, startCamera]);

  /* ── The guest list ────────────────────────────────────────────────────── */

  const download = useCallback(async () => {
    setDownloading(true);
    setDownloadNote(null);
    try {
      const response = await fetch(`/api/shows/${show.id}/door-manifest`, { cache: 'no-store' });
      if (!response.ok) {
        setDownloadNote(response.status === 403
          ? t('doorScanner.notYourDoorDetail', 'This account cannot check tickets in for this show.')
          : `${t('doorScanner.downloadFailed', 'The list could not be downloaded')} (${response.status}).`);
        return;
      }
      const body: unknown = await response.json();
      if (!isUsableManifest(body, show.id)) {
        setDownloadNote(t('doorScanner.downloadUnreadable', 'The list came back in a shape this page cannot read.'));
        return;
      }
      const stored = writeStored(storageKey(show.id, 'manifest'), body);
      manifestRef.current = body;
      setManifest(body);
      const warmed = await warmDoorCache(pagePath);
      const count = body.valid.length;
      const parts = [
        `${count} ${count === 1 ? t('doorScanner.ticketOnList', 'ticket on the list') : t('doorScanner.ticketsOnList', 'tickets on the list')}`,
        stored ? null : t('doorScanner.storageRefused', 'this browser refused to keep it — it will be gone when the page closes'),
        warmed ? t('doorScanner.pageSaved', 'this page is saved for offline') : t('doorScanner.pageNotSaved', 'this page could not be saved for offline in this browser'),
      ].filter(Boolean);
      setDownloadNote(parts.join(' · '));
    } catch {
      setDownloadNote(t('doorScanner.downloadOffline', 'No connection. The list downloads when you are back online.'));
    } finally {
      setDownloading(false);
    }
  }, [pagePath, show.id, t]);

  const pendingCount = useMemo(() => scans.filter((row) => row.sync === 'pending').length, [scans]);
  const admittedHere = useMemo(() => scans.filter((row) => row.sync === 'pending' || row.sync === 'synced').length, [scans]);

  const removeList = useCallback(() => {
    if (pendingCount > 0) return;
    commitManifest(null);
    commitScans([]);
    setDownloadNote(t('doorScanner.removed', 'Removed from this phone.'));
  }, [commitManifest, commitScans, pendingCount, t]);

  const onManualSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const value = manual.trim();
    if (!value) return;
    lastReadRef.current = null; // A typed code is always deliberate.
    void handleCode(value).then(() => setManual(''));
  }, [handleCode, manual]);

  const startsAt = new Date(show.startsAt);
  const when = Number.isNaN(startsAt.getTime())
    ? ''
    : startsAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const where = [show.headlinerName, show.venueName].filter(Boolean).join(' · ');

  return (
    <div className="mmm-door">
      <header className="mmm-door-head">
        <div className="mmm-eyebrow">{t('doorScanner.eyebrow', 'Door')}</div>
        <h1 className="mmm-door-title">{show.title}</h1>
        <p className="mmm-door-sub">{[when, where].filter(Boolean).join(' · ')}</p>
        <p className="mmm-door-conn" data-online={online ? 'true' : 'false'} role="status">
          <span className="mmm-door-conn-dot" aria-hidden="true" />
          {online ? t('doorScanner.online', 'Online') : t('doorScanner.offline', 'Offline')}
          {' · '}
          {manifest
            ? `${manifest.valid.length} ${t('doorScanner.onTheList', 'on the list')} · ${t('doorScanner.downloaded', 'downloaded')} ${describeAge(manifest.fetchedAt, now, t)}`
            : t('doorScanner.noListYet', 'no list on this phone yet')}
          {pendingCount > 0 ? ` · ${pendingCount} ${t('doorScanner.waitingToSync', 'waiting to sync')}` : ''}
        </p>
      </header>

      <section className="mmm-door-camera" data-state={camera} aria-label={t('doorScanner.cameraRegion', 'Camera')}>
        <video ref={videoRef} className="mmm-door-video" playsInline muted autoPlay aria-hidden="true" />
        {camera === 'live' ? (
          <>
            <div className="mmm-door-reticle" aria-hidden="true" />
            <button type="button" className="mmm-btn-ghost mmm-door-stop" onClick={stopCamera}>
              {t('doorScanner.stopCamera', 'Stop camera')}
            </button>
          </>
        ) : (
          <div className="mmm-door-camera-idle">
            {camera === 'denied' ? (
              <>
                <p className="mmm-door-camera-copy">{t('doorScanner.deniedCopy', 'The camera is off for iHYPE on this phone. Type the code under the QR instead, or allow the camera in your phone\'s settings and try again.')}</p>
                <button type="button" className="mmm-btn-ghost" onClick={() => void startCamera()}>{t('doorScanner.tryCameraAgain', 'Try the camera again')}</button>
              </>
            ) : camera === 'unsupported' ? (
              <p className="mmm-door-camera-copy">{t('doorScanner.unsupportedCopy', 'This browser has no camera iHYPE can use. Type the code under the QR instead.')}</p>
            ) : camera === 'error' ? (
              <>
                <p className="mmm-door-camera-copy">{t('doorScanner.errorCopy', 'The camera could not start. Another app may be using it.')}</p>
                <button type="button" className="mmm-btn-ghost" onClick={() => void startCamera()}>{t('doorScanner.tryCameraAgain', 'Try the camera again')}</button>
              </>
            ) : (
              <button type="button" className="mmm-btn-primary mmm-door-open" onClick={openCamera} disabled={camera === 'starting'}>
                {camera === 'starting' ? t('doorScanner.startingCamera', 'Starting the camera…') : t('doorScanner.openCamera', 'Open the camera')}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="mmm-door-verdict" data-tone={verdict?.tone ?? 'none'} role="status" aria-live="assertive" aria-atomic="true">
        {verdict ? (
          <>
            <strong className="mmm-door-verdict-title">{verdict.title}</strong>
            <span className="mmm-door-verdict-detail">{verdict.detail}</span>
          </>
        ) : (
          <span className="mmm-door-verdict-detail">{busy ? t('doorScanner.checking', 'Checking…') : t('doorScanner.readyCopy', 'Point the camera at a ticket, or type its code.')}</span>
        )}
      </div>

      <form className="mmm-door-manual" onSubmit={onManualSubmit}>
        <label className="mmm-door-label" htmlFor="door-code">{t('doorScanner.ticketCode', 'Ticket code')}</label>
        <div className="mmm-door-manual-row">
          <input
            id="door-code"
            className="mmm-search-input mmm-door-input"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            inputMode="text"
            onChange={(event) => setManual(event.target.value)}
            placeholder={t('doorScanner.codePlaceholder', '0x… or the ticket link')}
            spellCheck={false}
            value={manual}
          />
          <button type="submit" className="mmm-btn-primary mmm-door-check" disabled={busy || !manual.trim()}>
            {t('doorScanner.check', 'Check')}
          </button>
        </div>
      </form>

      <section className="mmm-door-offline" aria-labelledby="door-offline-title">
        <div className="mmm-door-offline-row">
          <div>
            <h2 className="mmm-door-kicker" id="door-offline-title">{t('doorScanner.beforeSignalGoes', 'Before you lose signal')}</h2>
            <p className="mmm-door-offline-copy">
              {t('doorScanner.beforeSignalCopy', 'Download the guest list while you are online. Tickets are checked against it when the room has no signal, and every check-in is sent up once you are back. The list holds names and a fingerprint of each ticket — never a code that would open the door.')}
            </p>
          </div>
          <button type="button" className="mmm-btn-ghost mmm-door-download" onClick={() => void download()} disabled={downloading || !online}>
            {downloading
              ? t('doorScanner.downloading', 'Downloading…')
              : manifest
                ? t('doorScanner.refreshList', 'Refresh the list')
                : t('doorScanner.downloadList', 'Download for the door')}
          </button>
        </div>
        {downloadNote ? <p className="mmm-door-note" role="status">{downloadNote}</p> : null}
        <dl className="mmm-door-counts">
          <div><dt>{t('doorScanner.onTheListLabel', 'On the list')}</dt><dd>{manifest ? manifest.valid.length : '—'}</dd></div>
          <div><dt>{t('doorScanner.checkedInHere', 'Checked in here')}</dt><dd>{admittedHere}</dd></div>
          <div><dt>{t('doorScanner.waitingToSyncLabel', 'Waiting to sync')}</dt><dd>{pendingCount}</dd></div>
        </dl>
        {manifest || scans.length ? (
          <button type="button" className="mmm-door-remove" onClick={removeList} disabled={pendingCount > 0}>
            {pendingCount > 0
              ? t('doorScanner.removeBlocked', 'Reconnect to sync before removing the list')
              : t('doorScanner.removeList', 'Remove the list from this phone')}
          </button>
        ) : null}
      </section>

      {scans.length ? (
        <section className="mmm-door-log" aria-labelledby="door-log-title">
          <h2 className="mmm-door-kicker" id="door-log-title">{t('doorScanner.recent', 'Recent at this door')}</h2>
          <ul className="mmm-door-log-list">
            {scans.slice(0, LOG_LIMIT).map((row) => (
              <li key={`${row.hash}-${row.at}`} className="mmm-door-log-row" data-sync={row.sync}>
                <span className="mmm-door-log-name">{row.name ?? `${row.code.slice(0, 8)}…`}</span>
                <span className="mmm-door-log-meta">
                  {formatClock(row.at)}
                  {' · '}
                  {row.sync === 'synced' ? t('doorScanner.synced', 'synced')
                    : row.sync === 'pending' ? t('doorScanner.pending', 'waiting to sync')
                      : row.sync === 'duplicate' ? (row.note ?? t('doorScanner.alreadyScannedNote', 'already scanned'))
                        : row.sync === 'refused' ? (row.note ?? t('doorScanner.refused', 'refused'))
                          : (row.note ?? t('doorScanner.notOnList', 'not on the downloaded list'))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PermissionPrimerSheet
        id="camera"
        onAccept={() => { primer.close(); primer.setDecision('accepted'); void startCamera(); }}
        onDecline={() => { primer.close(); primer.setDecision('declined'); }}
        open={primer.open}
      />
    </div>
  );
}
