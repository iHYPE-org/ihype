import { describe, expect, it } from 'vitest';
import { EDITOR_SELECT_FIELDS, editorSchema } from '@/lib/profile-editor-schema';

/* Regression test: PageEditor.tsx always PATCHes the *entire* editor state
   back to the server, including every untouched field the GET response
   returned as `null`. The schema must accept those nulls or the whole batch
   save fails, even when the member only changed one field.

   THE PAYLOAD IS CHECKED AGAINST THE SELECT, and that is the point of this
   file rather than a nicety. The first version of this test stated the rule
   above in prose and then hand-wrote a payload that omitted `capacity` —
   which `2191f30e` had added to the select — so the one field in the schema
   without `.nullable()` was also the one field the test never sent. Every
   ARTIST and LISTENER profile was unable to save anything for eight weeks
   while this test passed. A column added to EDITOR_SELECT_FIELDS now fails
   the coverage assertion below until somebody sends it. */

/** Identity columns: the GET returns them and the client echoes them back,
 *  but zod strips unknown keys, so they are deliberately not in the schema. */
const IDENTITY = new Set(['id', 'slug', 'type', 'ownerId']);

/** The value the GET can really return for each non-nullable column. Every
 *  other selected column is `Int?`/`String?` in schema.prisma and comes back
 *  as null on a profile that has not set it. */
const NON_NULL: Record<string, unknown> = {
  name: 'Test Page',
  fanShareEnabled: false,
  discoverable: true,
  pinnedStats: [],
};

const payload: Record<string, unknown> = { profileId: 'cabc123456789012345678901' };
for (const key of Object.keys(EDITOR_SELECT_FIELDS)) {
  if (IDENTITY.has(key)) continue;
  payload[key] = key in NON_NULL ? NON_NULL[key] : null;
}

describe('profile-editor PATCH schema', () => {
  it('accepts a GET-shaped payload for a mostly-empty profile', () => {
    const result = editorSchema.safeParse(payload);
    expect(result.success ? null : result.error.issues.map((i) => i.path.join('.'))).toBe(null);
  });

  it('sends every column the editor GET selects', () => {
    const missing = Object.keys(EDITOR_SELECT_FIELDS).filter(
      (key) => !IDENTITY.has(key) && !(key in payload),
    );
    expect(missing).toEqual([]);
  });

  it('accepts a null capacity on a profile that is not a venue', () => {
    // The exact shape that refused every artist and fan save.
    const result = editorSchema.safeParse({ profileId: 'cabc123456789012345678901', capacity: null });
    expect(result.success).toBe(true);
  });

  it('still refuses a capacity that is not a whole number in range', () => {
    for (const capacity of [-1, 1.5, 200001, 'lots']) {
      expect(editorSchema.safeParse({ profileId: 'cabc123456789012345678901', capacity }).success).toBe(false);
    }
  });
});
