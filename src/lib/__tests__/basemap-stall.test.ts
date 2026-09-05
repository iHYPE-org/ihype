import { describe, expect, it } from 'vitest';
import { describeBasemapStall, type BasemapStage } from '@/lib/basemap-stall';

function stage(over: Partial<BasemapStage> = {}): BasemapStage {
  return {
    styleLoaded: false,
    tilesLoaded: false,
    framesRendered: 0,
    contextLost: false,
    errors: 0,
    hidden: false,
    styleHost: 'basemaps.cartocdn.com',
    deadlineMs: 15_000,
    ...over,
  };
}

describe('describeBasemapStall', () => {
  it('refuses to judge a hidden tab — no frames can fire there, whatever the network did', () => {
    expect(describeBasemapStall(stage({ hidden: true }))).toBeNull();
    expect(describeBasemapStall(stage({ hidden: true, styleLoaded: true, tilesLoaded: true }))).toBeNull();
  });

  it('names the host when the style never arrived', () => {
    expect(describeBasemapStall(stage())).toBe('no reply from basemaps.cartocdn.com in 15s');
  });

  it('counts the failures when the style was refused', () => {
    expect(describeBasemapStall(stage({ errors: 1 }))).toBe('the style from basemaps.cartocdn.com failed once');
    expect(describeBasemapStall(stage({ errors: 3 }))).toBe('the style from basemaps.cartocdn.com failed 3 times');
  });

  it('points at the worker when the style is in, nothing drew, and no tile parsed', () => {
    expect(describeBasemapStall(stage({ styleLoaded: true }))).toBe(
      'style loaded, tiles never parsed — the map worker may be blocked',
    );
  });

  it('says tiles are pending when frames are drawing but sources are not done', () => {
    expect(describeBasemapStall(stage({ styleLoaded: true, framesRendered: 12 }))).toBe(
      'style loaded, tiles still pending after 15s',
    );
  });

  it('blames the render loop when everything arrived and nothing drew', () => {
    expect(describeBasemapStall(stage({ styleLoaded: true, tilesLoaded: true }))).toBe(
      'map data loaded but nothing drew — graphics paused',
    );
  });

  it('puts a lost WebGL context first, whatever else is true', () => {
    expect(describeBasemapStall(stage({ contextLost: true, styleLoaded: true, tilesLoaded: true, framesRendered: 4 }))).toBe(
      'the graphics context was lost',
    );
  });

  it('still says something when every reading is healthy and load has not fired', () => {
    expect(describeBasemapStall(stage({ styleLoaded: true, tilesLoaded: true, framesRendered: 4 }))).toBe(
      'no first frame in 15s',
    );
  });
});
