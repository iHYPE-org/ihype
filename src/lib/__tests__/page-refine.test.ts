import { describe, expect, it } from 'vitest';
import { aiEditableFields, aiTextFieldLimits, sanitizeAiChanges } from '@/lib/page-refine';

// The AI page customizer forwards model output straight into PageEditor
// state, so the sanitizer is the only thing standing between a hallucinated
// or hostile response and the profile-editor PATCH. It must be strict.
describe('sanitizeAiChanges', () => {
  it('keeps valid text changes and trims them', () => {
    const out = sanitizeAiChanges('ARTIST', {
      bio: '  Indie rock from Portland.  ',
      links: 'https://a.example\nhttps://b.example',
    });
    expect(out).toEqual({
      bio: 'Indie rock from Portland.',
      links: 'https://a.example\nhttps://b.example',
    });
  });

  it('drops unknown fields, non-strings, and empty strings', () => {
    const out = sanitizeAiChanges('ARTIST', {
      name: 'Renamed You', // not AI-editable
      profileId: 'cinjected000000000000000', // never editable
      fanShareEnabled: true, // non-string
      bio: '   ',
      headline: 'Loud and local',
    });
    expect(out).toEqual({ headline: 'Loud and local' });
  });

  it('clamps text to the editor schema max length', () => {
    const out = sanitizeAiChanges('ARTIST', { headline: 'x'.repeat(500) });
    expect(out.headline).toHaveLength(180);
  });

  it('enforces role gating on role-specific fields', () => {
    const venueOnly = { hoursText: 'Doors at 8', parkingDetails: 'Lot behind the venue' };
    const artistOnly = { tourContent: 'Fall run', merchContent: 'New tees' };

    expect(sanitizeAiChanges('VENUE', { ...venueOnly, ...artistOnly })).toEqual(venueOnly);
    expect(sanitizeAiChanges('ARTIST', { ...venueOnly, ...artistOnly })).toEqual(artistOnly);
    expect(sanitizeAiChanges('LISTENER', { ...venueOnly, ...artistOnly })).toEqual({});
  });

  it('accepts only known theme ids', () => {
    const out = sanitizeAiChanges('DJ', {
      themePreset: 'y2k-sparkle',
      themeAccentTone: 'hotdog-yellow', // invented by the model
      themeBackdropTone: 'velvet-room',
    });
    expect(out).toEqual({ themePreset: 'y2k-sparkle', themeBackdropTone: 'velvet-room' });
  });

  it('returns empty for non-object responses', () => {
    expect(sanitizeAiChanges('ARTIST', null)).toEqual({});
    expect(sanitizeAiChanges('ARTIST', ['bio'])).toEqual({});
    expect(sanitizeAiChanges('ARTIST', 'make it pop')).toEqual({});
  });
});

describe('aiEditableFields', () => {
  it('exposes shared + theme fields for fans, plus role fields for creators', () => {
    const fan = aiEditableFields('LISTENER');
    expect(fan).toContain('bio');
    expect(fan).toContain('themePreset');
    expect(fan).not.toContain('tourContent');
    expect(fan).not.toContain('hoursText');

    expect(aiEditableFields('ARTIST')).toContain('tourContent');
    expect(aiEditableFields('VENUE')).toContain('hoursText');
  });

  it('caps match the profile-editor schema limits', () => {
    expect(aiTextFieldLimits('ARTIST').headline).toBe(180);
    expect(aiTextFieldLimits('VENUE').hoursText).toBe(500);
  });
});
