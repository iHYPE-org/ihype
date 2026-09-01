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
  // Streamlined editor (2026-09-01): About gained Origin and Members for
  // artists, Contact gained the venue's booking line. All three are plain
  // text on Profile — see the schema's own note on why members is not a
  // relation.
  hometown: text(120),
  members: text(2000),
  contactInfo: text(1000),
  hoursText: text(500),
  parkingDetails: text(1000),
  stayRecommendations: text(1000),
  heroImage: urlText,
  avatarImage: urlText,
  logoImage: urlText,
  galleryImage: urlText,
  themePreset: text(80),
  themeAccentTone: text(80),
  themeBackdropTone: text(80),
  themeFontPreset: text(80),
  fanShareEnabled: z.boolean().optional(),
  discoverable: z.boolean().optional(),
  capacity: z.number().int().min(0).max(200000).optional(),
  roomType: text(40),
  pinnedStats: z.array(z.string()).max(4).optional()
});
