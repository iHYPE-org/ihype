import { z } from 'zod';

const text = (max = 5000) => z.string().trim().max(max).nullable().optional();
const urlText = z.string().trim().max(2048).nullable().optional();

// PageEditor.tsx PATCHes its entire client state back on every save,
// including fields the GET response returned as `null` for anything the
// profile hasn't set — so every optional field here must accept null,
// not just undefined.
export const editorSchema = z.object({
  profileId: z.string().cuid(),
  name: text(120),
  headline: text(180),
  bio: text(1000),
  aboutContent: text(5000),
  topFiveContent: text(2000),
  mediaContent: text(5000),
  nowPlaying: text(240),
  links: text(5000),
  merchUrl: urlText,
  merchContent: text(5000),
  tourContent: text(5000),
  requestContent: text(5000),
  pressKitContent: text(12000),
  upcomingContent: text(5000),
  previousShowHighlights: text(5000),
  addressLine1: text(240),
  city: text(120),
  stateRegion: text(120),
  postalCode: text(40),
  country: text(80),
  hoursText: text(500),
  parkingDetails: text(1000),
  stayRecommendations: text(1000),
  heroImage: urlText,
  avatarImage: urlText,
  logoImage: urlText,
  galleryImage: urlText,
  featureVideoUrl: urlText,
  themePreset: text(80),
  themeAccentTone: text(80),
  themeBackdropTone: text(80),
  fanShareEnabled: z.boolean().optional()
});
