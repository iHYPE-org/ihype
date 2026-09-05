import { describe, expect, it } from 'vitest';
import {
  translateMeRow,
  translateMeStatLabel,
  translateRoleLabel,
  translateStationLabel,
  translateStripName,
  translateTabLabel,
} from '@/lib/mmm-shell-labels';
import { MMM_MAP_LAYERS, MMM_MUSIC_TABS, MMM_NAV } from '@/lib/mmm-nav';
import { ME_PANEL_IDS, ME_PANEL_ROWS } from '@/lib/mmm-me-panels';
import { ARTIST_TABS, VENUE_TABS } from '@/lib/profile-tabs';

/**
 * The shell's labels are declared once, in English, in manifests nothing
 * translates, and translated where they are DRAWN by switching on that English
 * (owner, 2026-09-05: "Some languages don't actually change anything"). Two
 * things can silently undo that: a manifest label the switch does not know
 * (renders English in every locale, with no error), and a key that no locale
 * ever receives. This file guards the first; the extractor and the batch
 * applier guard the second.
 */

/** A `t` that records which keys were asked for and answers with a marker. */
function recordingT() {
  const keys: string[] = [];
  const t = (key: string, fallback?: string) => {
    keys.push(key);
    return `«${fallback ?? key}»`;
  };
  return { t, keys };
}

const identity = (_key: string, fallback?: string) => fallback ?? _key;

describe('translateStationLabel', () => {
  const manifestLabels = [
    ...MMM_MUSIC_TABS.map((item) => item.label),
    ...MMM_MAP_LAYERS.map((item) => item.label),
    ...ARTIST_TABS.map((tab) => tab.label),
    ...VENUE_TABS.map((tab) => tab.label),
    'Profiles', 'Info', 'Settings',
  ];

  it('knows every label the manifests declare — an unknown one would ship English in every locale', () => {
    for (const label of manifestLabels) {
      const { t, keys } = recordingT();
      translateStationLabel(t, label);
      expect(keys, `"${label}" is drawn by the strip but reaches no dictionary key`).toHaveLength(1);
    }
  });

  it('returns the manifest English under an identity t, so a missing dictionary changes nothing', () => {
    for (const label of manifestLabels) {
      expect(translateStationLabel(identity, label)).toBe(label);
    }
  });

  it('leaves a label it does not know as declared rather than blanking it', () => {
    expect(translateStationLabel(identity, 'Brand new section')).toBe('Brand new section');
  });
});

describe('translateTabLabel', () => {
  it('covers the four dock destinations and reproduces their English', () => {
    for (const module of MMM_NAV) {
      const { t, keys } = recordingT();
      translateTabLabel(t, module.id, module.tabLabel);
      expect(keys, `${module.id} has no key`).toHaveLength(1);
      expect(translateTabLabel(identity, module.id, module.tabLabel)).toBe(module.tabLabel);
    }
  });
});

describe('translateStripName', () => {
  it('names every module and has a fallback for none', () => {
    for (const module of MMM_NAV) {
      expect(translateStripName(identity, module.id)).toBe(`Sections in ${module.label}`);
    }
    expect(translateStripName(identity, null)).toBe('Sections in this screen');
  });
});

describe('translateMeRow', () => {
  it('agrees with ME_PANEL_ROWS under an identity t, so the two English copies cannot drift', () => {
    for (const id of ME_PANEL_IDS) {
      for (const row of ME_PANEL_ROWS[id]) {
        const { t, keys } = recordingT();
        translateMeRow(t, row);
        expect(keys, `${row.href} is not translated`).toHaveLength(2);
        expect(translateMeRow(identity, row)).toEqual({ label: row.label, detail: row.detail });
      }
    }
  });
});

describe('translateRoleLabel and translateMeStatLabel', () => {
  it('cover every role', () => {
    // The three ME roles, restated: `@/lib/mmm-me` imports the database client.
    for (const role of ['fan', 'artist', 'venue']) {
      const { t, keys } = recordingT();
      translateRoleLabel(t, role);
      expect(keys).toHaveLength(1);
    }
  });

  it('pass an unknown stat label through unchanged', () => {
    expect(translateMeStatLabel(identity, 'Something new')).toBe('Something new');
    expect(translateMeStatLabel(identity, 'Followers')).toBe('Followers');
  });
});
