import { describe, expect, it } from 'vitest';
import {
  ME_PANEL_IDS,
  ME_PANEL_ROWS,
  canonicalMePanelId,
  isMePanelId,
} from '@/lib/mmm-me-panels';
import { MMM_ME_PANELS } from '@/lib/mmm-nav';

describe('ME account panels', () => {
  // The two lists are maintained in different files — one carries the labels
  // the shell renders, the other the rows a drawer opens. A panel present in
  // one and missing from the other renders a row that opens onto nothing, and
  // nothing else in the app would notice.
  it('has rows for exactly the panels the shell lists', () => {
    const navIds = MMM_ME_PANELS.map((panel) => panel.id).sort();
    expect(navIds).toEqual([...ME_PANEL_IDS].sort());
    expect(Object.keys(ME_PANEL_ROWS).sort()).toEqual([...ME_PANEL_IDS].sort());
  });

  it('never opens an empty drawer', () => {
    for (const id of ME_PANEL_IDS) {
      expect(ME_PANEL_ROWS[id].length).toBeGreaterThan(0);
    }
  });

  it('nests accessibility under Settings and Legal under Info without repeating the charter', () => {
    expect(ME_PANEL_ROWS.settings.map((row) => row.label)).toContain('Accessibility');
    expect(ME_PANEL_ROWS.info.map((row) => row.label)).toEqual(expect.arrayContaining([
      'The charter',
      'Terms of service',
      'Privacy policy',
      'DMCA',
    ]));
    expect(Object.values(ME_PANEL_ROWS).flat().filter((row) => row.label === 'The charter')).toHaveLength(1);
    expect(ME_PANEL_ROWS.info.map((row) => row.label)).not.toContain('How iHYPE works');
    expect(ME_PANEL_ROWS.info.find((row) => row.label === 'The charter')?.href)
      .toBe('/app/me/info/charter');
    expect(ME_PANEL_ROWS.info.map((row) => row.label)).not.toContain('Trust and safety');
    expect(ME_PANEL_ROWS.info.find((row) => row.label === 'Transparency report')?.href)
      .toBe('/app/me/info/transparency');
    expect(ME_PANEL_ROWS.info.find((row) => row.label === 'Terms of service')?.href)
      .toBe('/app/me/info/terms');
  });

  // Every row is a bridge to a surface that already exists and does its own
  // auth. A row pointing outward would leave the shell without saying so.
  it('links only to in-app destinations', () => {
    for (const id of ME_PANEL_IDS) {
      for (const row of ME_PANEL_ROWS[id]) {
        expect(row.href.startsWith('/')).toBe(true);
        expect(row.href.startsWith('//')).toBe(false);
        expect(row.label.length).toBeGreaterThan(0);
        expect(row.detail.length).toBeGreaterThan(0);
      }
    }
  });

  describe('isMePanelId', () => {
    it('accepts every real panel', () => {
      for (const id of ME_PANEL_IDS) expect(isMePanelId(id)).toBe(true);
    });

    // The guard runs on a raw `?panel=` value, so it is handed whatever is in
    // the URL. Anything unrecognised must close the drawers, not index into
    // the rows map with a string nobody defined.
    it('rejects anything else, including empty and null', () => {
      for (const value of ['', 'Settings', 'billing', '__proto__', 'constructor']) {
        expect(isMePanelId(value)).toBe(false);
      }
      expect(isMePanelId(null)).toBe(false);
      expect(isMePanelId(undefined)).toBe(false);
    });
  });

  describe('canonicalMePanelId', () => {
    it('keeps retired deep links inside their new parent drawer', () => {
      expect(canonicalMePanelId('accessibility')).toBe('settings');
      expect(canonicalMePanelId('legal')).toBe('info');
      expect(canonicalMePanelId('settings')).toBe('settings');
      expect(canonicalMePanelId('unknown')).toBeNull();
    });
  });
});
