import { describe, expect, it } from 'vitest';
import { editorSchema } from '@/lib/profile-editor-schema';

// Regression test: PageEditor.tsx always PATCHes the *entire* editor state
// back to the server, including every untouched field the GET response
// returned as `null` (nearly every text field on a fresh/partial profile).
// The schema must accept those nulls or every save fails with Zod's
// generic "Invalid input" error, even when the user only changed one field.
describe('profile-editor PATCH schema', () => {
  it('accepts a payload with null text fields, matching a GET response for a mostly-empty profile', () => {
    const result = editorSchema.safeParse({
      profileId: 'cabc123456789012345678901',
      name: 'DJ Test',
      headline: null,
      bio: null,
      aboutContent: null,
      topFiveContent: null,
      mediaContent: null,
      nowPlaying: null,
      links: null,
      merchUrl: null,
      merchContent: null,
      tourContent: null,
      requestContent: null,
      upcomingContent: null,
      previousShowHighlights: null,
      addressLine1: null,
      city: null,
      stateRegion: null,
      postalCode: null,
      country: null,
      hoursText: null,
      parkingDetails: null,
      stayRecommendations: null,
      heroImage: null,
      avatarImage: null,
      logoImage: null,
      galleryImage: null,
      featureVideoUrl: null,
      themePreset: 'midnight-neon',
      themeAccentTone: null,
      themeBackdropTone: null,
      fanShareEnabled: false
    });

    expect(result.success).toBe(true);
  });
});
