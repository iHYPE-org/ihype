import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the ACRCloud client so we test the security-relevant mapping from an
// identify outcome to a scan-layer result without any network/credentials.
vi.mock('@/lib/acrcloud', () => ({ identifyAudio: vi.fn() }));

import { identifyAudio } from '@/lib/acrcloud';
import { runAcousticFingerprintScan, runMelodicFeatureMatch } from '@/lib/audio-fingerprint';

const mockIdentify = identifyAudio as unknown as ReturnType<typeof vi.fn>;
const bytes = new Uint8Array([1, 2, 3]);

beforeEach(() => mockIdentify.mockReset());

describe('runAcousticFingerprintScan (ACRCloud layer 1)', () => {
  it('reports not-configured (never a false pass) when ACRCloud creds are absent', async () => {
    mockIdentify.mockResolvedValue({ status: 'not-configured' });
    const r = await runAcousticFingerprintScan(bytes);
    expect(r.configured).toBe(false);
    expect(r.cleared).toBe(true); // does not block — but the pipeline ignores unconfigured layers
    expect(r.reasoning).toMatch(/not configured/i);
  });

  it('clears a track that matches nothing in the catalog', async () => {
    mockIdentify.mockResolvedValue({ status: 'no-match' });
    const r = await runAcousticFingerprintScan(bytes);
    expect(r.configured).toBe(true);
    expect(r.cleared).toBe(true);
    expect(r.requiresManualReview).toBe(false);
  });

  it('flags a fingerprint match to a commercial recording (blocking, not manual-review)', async () => {
    mockIdentify.mockResolvedValue({ status: 'match', matchedSource: 'Daft Punk — One More Time', score: 92 });
    const r = await runAcousticFingerprintScan(bytes);
    expect(r.configured).toBe(true);
    // configured + !cleared → the pipeline flags the upload (auto_flag_copyright)
    expect(r.cleared).toBe(false);
    expect(r.requiresManualReview).toBe(false);
    expect(r.matchedSource).toBe('Daft Punk — One More Time');
    expect(r.reasoning).toContain('Daft Punk — One More Time');
    expect(r.reasoning).toContain('92');
  });

  it('fails open when the scan itself errors — allows the upload but says so honestly', async () => {
    mockIdentify.mockResolvedValue({ status: 'error', detail: 'ACRCloud HTTP 503' });
    const r = await runAcousticFingerprintScan(bytes);
    expect(r.configured).toBe(true);
    expect(r.cleared).toBe(true); // fail-open: a broken scan must not block uploads
    expect(r.requiresManualReview).toBe(false);
    expect(r.reasoning).toMatch(/could not complete/i);
    expect(r.reasoning).toContain('503');
  });
});

describe('runMelodicFeatureMatch (layer 2)', () => {
  it('stays honestly unconfigured (ACRCloud identify covers layer 1, not melodic cover detection)', async () => {
    const r = await runMelodicFeatureMatch(bytes);
    expect(r.configured).toBe(false);
    expect(r.cleared).toBe(true);
  });
});

describe('identifyAudio credential gate', () => {
  const saved = {
    host: process.env.ACRCLOUD_HOST,
    key: process.env.ACRCLOUD_ACCESS_KEY,
    secret: process.env.ACRCLOUD_ACCESS_SECRET,
  };
  afterEach(() => {
    process.env.ACRCLOUD_HOST = saved.host;
    process.env.ACRCLOUD_ACCESS_KEY = saved.key;
    process.env.ACRCLOUD_ACCESS_SECRET = saved.secret;
    vi.resetModules();
  });

  it('returns not-configured (no network call) when any credential is missing', async () => {
    delete process.env.ACRCLOUD_HOST;
    delete process.env.ACRCLOUD_ACCESS_KEY;
    delete process.env.ACRCLOUD_ACCESS_SECRET;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Import the real module (bypassing the top-level mock) to exercise the gate.
    const real = await vi.importActual<typeof import('@/lib/acrcloud')>('@/lib/acrcloud');
    const outcome = await real.identifyAudio(bytes);
    expect(outcome).toEqual({ status: 'not-configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
