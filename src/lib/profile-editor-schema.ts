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
  /* `.nullable()` is not decoration: the GET hands back `capacity: null`
     for every profile that is not a venue with a stated room size, and
     PageEditor PATCHes that value straight back. Without it, no ARTIST
     and no LISTENER profile could save anything through this editor at
     all -- the whole batch save was refused, and the 400 named no field.
     That is the rule the comment at the top of this object already
     states; this was the one field that did not follow it. */
  capacity: z.number().int().min(0).max(200000).nullable().optional(),
  roomType: text(40),
  pinnedStats: z.array(z.string()).max(4).optional()
});

/* THE COLUMNS THE EDITOR READS BACK, AND THE ONLY DEFINITION OF THEM.
   `GET /api/profile-editor` selects exactly these, PageEditor holds the
   response as its state, and `save()` PATCHes the whole thing back — so this
   list and `editorSchema` above are two halves of one contract. It lives here
   rather than in the route so `profile-editor-schema.test.ts` can derive its
   payload from it: the capacity defect shipped because a column was added to
   the select in one commit and never added to the hand-written payload of the
   test whose stated job is "matching a GET response". */
export const EDITOR_SELECT_FIELDS = {
  id: true,
  slug: true,
  type: true,
  ownerId: true,
  name: true,
  pressKitContent: true,
  headline: true,
  bio: true,
  aboutContent: true,
  topFiveContent: true,
  mediaContent: true,
  nowPlaying: true,
  links: true,
  merchUrl: true,
  merchContent: true,
  tourContent: true,
  requestContent: true,
  upcomingContent: true,
  previousShowHighlights: true,
  addressLine1: true,
  city: true,
  stateRegion: true,
  postalCode: true,
  country: true,
  hometown: true,
  members: true,
  contactInfo: true,
  hoursText: true,
  parkingDetails: true,
  stayRecommendations: true,
  heroImage: true,
  avatarImage: true,
  logoImage: true,
  galleryImage: true,
  themePreset: true,
  themeAccentTone: true,
  themeBackdropTone: true,
  fanShareEnabled: true,
  discoverable: true,
  capacity: true,
  roomType: true,
  pinnedStats: true,
} as const;
