import { describe, expect, it } from 'vitest';
import { EMPTY_PRESS_KIT, parsePressKit, serializePressKit } from '@/lib/press-kit';

describe('parsePressKit', () => {
  it('returns an empty kit for null, empty, and malformed input', () => {
    expect(parsePressKit(null)).toEqual(EMPTY_PRESS_KIT);
    expect(parsePressKit(undefined)).toEqual(EMPTY_PRESS_KIT);
    expect(parsePressKit('')).toEqual(EMPTY_PRESS_KIT);
    expect(parsePressKit('not json {')).toEqual(EMPTY_PRESS_KIT);
    expect(parsePressKit('[1,2,3]')).toEqual(EMPTY_PRESS_KIT);
    expect(parsePressKit('"just a string"')).toEqual(EMPTY_PRESS_KIT);
  });

  it('parses a well-formed kit', () => {
    const kit = parsePressKit(JSON.stringify({
      tagline: 'Synth-punk from Portland',
      quotes: [{ quote: 'Stole the festival', source: 'Dispatch' }],
      achievements: ['#1 on WMPG'],
      contactEmail: 'booking@band.com',
    }));
    expect(kit.tagline).toBe('Synth-punk from Portland');
    expect(kit.quotes).toEqual([{ quote: 'Stole the festival', source: 'Dispatch' }]);
    expect(kit.achievements).toEqual(['#1 on WMPG']);
    expect(kit.contactEmail).toBe('booking@band.com');
  });

  it('drops junk entries and non-string values', () => {
    const kit = parsePressKit(JSON.stringify({
      tagline: 42,
      quotes: [{ quote: '', source: 'no quote text' }, null, { quote: 'ok' }],
      achievements: ['', null, 7, 'real one'],
      contactEmail: {},
    }));
    expect(kit.tagline).toBe('');
    expect(kit.quotes).toEqual([{ quote: 'ok', source: '' }]);
    expect(kit.achievements).toEqual(['real one']);
    expect(kit.contactEmail).toBe('');
  });

  it('caps list sizes and string lengths', () => {
    const kit = parsePressKit(JSON.stringify({
      tagline: 'x'.repeat(500),
      achievements: Array.from({ length: 50 }, (_, i) => `a${i}`),
      quotes: [],
    }));
    expect(kit.tagline.length).toBe(200);
    expect(kit.achievements.length).toBe(20);
  });
});

describe('serializePressKit', () => {
  it('round-trips through parsePressKit', () => {
    const raw = serializePressKit({
      tagline: ' padded ',
      quotes: [{ quote: 'Great show', source: 'Zine' }],
      achievements: ['Sold out Space Gallery'],
      contactEmail: 'press@band.com',
    });
    expect(raw).not.toBeNull();
    const kit = parsePressKit(raw);
    expect(kit.tagline).toBe('padded');
    expect(kit.quotes[0].source).toBe('Zine');
  });

  it('returns null for an empty kit so the column clears', () => {
    expect(serializePressKit({ tagline: '', quotes: [], achievements: [], contactEmail: '' })).toBeNull();
    expect(serializePressKit({ tagline: '  ', quotes: [{ quote: '', source: '' }], achievements: [], contactEmail: '' })).toBeNull();
  });
});
