import { describe, expect, it } from 'vitest';
import { isPlayableHref, playableHref } from '../playable-href';

describe('isPlayableHref', () => {
  it('takes the proxied stream path the deck plays through, and a stored absolute url', () => {
    expect(isPlayableHref('/api/media/0x0da03cb4443f21ab44375fc6a0467325')).toBe(true);
    expect(isPlayableHref('https://ihype.org/cdn/artist-media/p/t.m4a')).toBe(true);
    expect(isPlayableHref('http://localhost:8787/audio/samples/signal-chime.wav')).toBe(true);
  });

  it('refuses another origin dressed as a path, and every non-http scheme', () => {
    expect(isPlayableHref('//evil.example/t.mp3')).toBe(false);
    expect(isPlayableHref('javascript:alert(1)')).toBe(false);
    expect(isPlayableHref('data:audio/wav;base64,UklGRg==')).toBe(false);
    expect(isPlayableHref('ftp://x/t.mp3')).toBe(false);
    expect(isPlayableHref('not a url')).toBe(false);
    expect(isPlayableHref('')).toBe(false);
    expect(isPlayableHref(`/${'a'.repeat(2000)}`)).toBe(false);
  });

  it('is the zod shape the favourite and playlist-item routes read', () => {
    expect(playableHref.safeParse(' /api/media/0xabc ').success).toBe(true);
    expect(playableHref.safeParse('javascript:1').success).toBe(false);
  });
});
