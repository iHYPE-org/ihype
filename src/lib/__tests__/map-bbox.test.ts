import { describe, expect, it } from 'vitest';
import {
  CULL_PADDING,
  MAP_ROW_LIMIT,
  PIN_COLLISION,
  bboxCrossesAntimeridian,
  clusterCellDegrees,
  clusterPoints,
  isHotEvent,
  padBbox,
  parseBbox,
  parseZoom,
  placePins,
  resultLine,
  scopeForZoom,
  shouldClusterServerSide,
} from '@/lib/map-bbox';

describe('parseBbox', () => {
  it('parses a well-formed bbox', () => {
    expect(parseBbox('-70.3,43.6,-70.2,43.7')).toEqual({ west: -70.3, south: 43.6, east: -70.2, north: 43.7 });
  });

  it('tolerates whitespace between components', () => {
    expect(parseBbox(' -70.3 , 43.6 , -70.2 , 43.7 ')).toEqual({ west: -70.3, south: 43.6, east: -70.2, north: 43.7 });
  });

  // §5's "reject unbounded requests" only works if every malformed shape is a
  // rejection rather than a partial parse that silently widens the query.
  it.each([
    ['missing', null],
    ['empty', ''],
    ['three components', '-70.3,43.6,-70.2'],
    ['five components', '-70.3,43.6,-70.2,43.7,1'],
    ['non-numeric', '-70.3,43.6,-70.2,north'],
    ['NaN literal', '-70.3,43.6,-70.2,NaN'],
    ['infinite', '-70.3,43.6,-70.2,Infinity'],
    ['latitude out of range', '-70.3,-91,-70.2,43.7'],
    ['longitude out of range', '-181,43.6,-70.2,43.7'],
    ['inverted latitudes', '-70.3,43.7,-70.2,43.6'],
    ['zero-height box', '-70.3,43.6,-70.2,43.6'],
  ])('rejects %s', (_label, raw) => {
    expect(parseBbox(raw)).toBeNull();
  });

  // Panning across the Pacific produces west > east legitimately; only
  // south > north is nonsense, so this must parse rather than 400.
  it('accepts an antimeridian-crossing box and flags it', () => {
    const bbox = parseBbox('170,-10,-170,10');
    expect(bbox).toEqual({ west: 170, south: -10, east: -170, north: 10 });
    expect(bboxCrossesAntimeridian(bbox!)).toBe(true);
  });

  it('does not flag an ordinary box as crossing', () => {
    expect(bboxCrossesAntimeridian({ west: -70.3, south: 43.6, east: -70.2, north: 43.7 })).toBe(false);
  });
});

describe('padBbox', () => {
  it('widens by a fraction of the span', () => {
    const padded = padBbox({ west: -10, south: 0, east: 10, north: 10 }, 0.1);
    expect(padded).toEqual({ west: -12, south: -1, east: 12, north: 11 });
  });

  it('clamps latitude at the poles instead of producing an invalid box', () => {
    const padded = padBbox({ west: -10, south: -89, east: 10, north: 89 }, 0.5);
    expect(padded.south).toBe(-90);
    expect(padded.north).toBe(90);
  });

  it('degrades to the full longitude span rather than wrapping past ±180', () => {
    const padded = padBbox({ west: -178, south: 0, east: 178, north: 10 }, 0.15);
    expect(padded.west).toBe(-180);
    expect(padded.east).toBe(180);
  });
});

describe('parseZoom', () => {
  it('falls back when absent or unparseable', () => {
    expect(parseZoom(null, 13)).toBe(13);
    expect(parseZoom('not-a-zoom', 9)).toBe(9);
  });

  it('clamps to the map’s own range', () => {
    expect(parseZoom('0.1')).toBe(1);
    expect(parseZoom('99')).toBe(20);
    expect(parseZoom('5.5')).toBe(5.5);
  });
});

describe('scope and clustering thresholds', () => {
  it('maps zoom onto the four scope chips', () => {
    expect(scopeForZoom(14)).toBe('county');
    expect(scopeForZoom(10)).toBe('county');
    expect(scopeForZoom(7)).toBe('state');
    expect(scopeForZoom(4)).toBe('country');
    expect(scopeForZoom(2)).toBe('global');
  });

  // The client's de-collision is county-zoom only; the ceiling is what keeps a
  // global view from shipping 10,000 rows for it to fan out.
  it('clusters at or below the ceiling and not above it', () => {
    expect(shouldClusterServerSide(5.5)).toBe(true);
    expect(shouldClusterServerSide(5.6)).toBe(false);
    expect(shouldClusterServerSide(13)).toBe(false);
  });

  it('tightens the cell as the camera comes in', () => {
    expect(clusterCellDegrees(2)).toBe(6);
    expect(clusterCellDegrees(3.5)).toBe(3);
    expect(clusterCellDegrees(5)).toBe(1);
  });
});

describe('clusterPoints', () => {
  it('groups by cell and centres each bubble on its members, not the grid', () => {
    const clusters = clusterPoints(
      [
        { latitude: 43.6, longitude: -70.2, id: 'a' },
        { latitude: 43.8, longitude: -70.4, id: 'b' },
        { latitude: 40.7, longitude: -74.0, id: 'c' },
      ],
      1,
    );
    expect(clusters).toHaveLength(2);
    const maine = clusters.find((cluster) => cluster.count === 2)!;
    expect(maine.latitude).toBeCloseTo(43.7, 5);
    expect(maine.longitude).toBeCloseTo(-70.3, 5);
    expect(maine.sample.id).toBe('a');
  });

  it('skips non-finite coordinates rather than producing a NaN bubble', () => {
    const clusters = clusterPoints(
      [{ latitude: Number.NaN, longitude: -70.2 }, { latitude: 43.6, longitude: -70.2 }],
      1,
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(1);
  });

  it('is order-stable so a repeated request paints the same bubbles', () => {
    const points = [
      { latitude: 40.7, longitude: -74.0, id: 'nyc' },
      { latitude: 43.6, longitude: -70.2, id: 'pwm' },
    ];
    expect(clusterPoints(points, 6).map((cluster) => cluster.sample.id))
      .toEqual(clusterPoints(points, 6).map((cluster) => cluster.sample.id));
  });

  it('returns nothing for no input', () => {
    expect(clusterPoints([], 6)).toEqual([]);
  });
});

describe('placePins', () => {
  const frame = { width: 400, height: 800, collision: PIN_COLLISION.event };

  it('leaves a lone pin exactly where it is', () => {
    const [pin] = placePins([{ item: 'a', x: 100, y: 200 }], frame);
    expect([pin.ax, pin.ay]).toEqual([100, 200]);
    expect(pin.offset).toBe(false);
  });

  // FRONTEND_GOTCHAS §1: six Portland events at county zoom rendered as one
  // unreadable stack with only the topmost tappable.
  it('separates a stack of six coincident pins beyond the collision box', () => {
    const placed = placePins(
      Array.from({ length: 6 }, (_, index) => ({ item: index, x: 200, y: 400 })),
      frame,
    );
    expect(placed).toHaveLength(6);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const overlaps = Math.abs(placed[i].ax - placed[j].ax) < frame.collision.width
          && Math.abs(placed[i].ay - placed[j].ay) < frame.collision.height;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('marks moved pins as offset and leaves the first one anchored', () => {
    const placed = placePins(
      Array.from({ length: 4 }, (_, index) => ({ item: index, x: 200, y: 400 })),
      frame,
    );
    expect(placed[0].offset).toBe(false);
    expect(placed.slice(1).every((pin) => pin.offset)).toBe(true);
  });

  it('keeps the true position alongside the adjusted one', () => {
    const placed = placePins([{ item: 0, x: 200, y: 400 }, { item: 1, x: 200, y: 400 }], frame);
    expect([placed[1].x, placed[1].y]).toEqual([200, 400]);
    expect([placed[1].ax, placed[1].ay]).not.toEqual([200, 400]);
  });

  // §1's "also cull first" — and §2's one-array rule, which only holds if the
  // returned array is already culled.
  it('drops pins beyond the cull padding', () => {
    const placed = placePins(
      [
        { item: 'in', x: 10, y: 10 },
        { item: 'just-out', x: -(CULL_PADDING + 1), y: 400 },
        { item: 'far-right', x: 400 + CULL_PADDING + 1, y: 400 },
        { item: 'above', x: 200, y: -(CULL_PADDING + 1) },
        { item: 'below', x: 200, y: 800 + CULL_PADDING + 1 },
      ],
      frame,
    );
    expect(placed.map((pin) => pin.item)).toEqual(['in']);
  });

  it('keeps a pin sitting inside the padding, so panning back is seamless', () => {
    const placed = placePins([{ item: 'edge', x: -(CULL_PADDING - 1), y: 400 }], frame);
    expect(placed.map((pin) => pin.item)).toEqual(['edge']);
  });

  it('skips non-finite projections rather than placing a NaN pin', () => {
    const placed = placePins([{ item: 'bad', x: Number.NaN, y: 10 }, { item: 'ok', x: 10, y: 10 }], frame);
    expect(placed.map((pin) => pin.item)).toEqual(['ok']);
  });

  it('uses the wider collision box for name-bearing venue pills', () => {
    const eventPins = placePins([{ item: 0, x: 200, y: 400 }, { item: 1, x: 260, y: 400 }], frame);
    const venuePins = placePins(
      [{ item: 0, x: 200, y: 400 }, { item: 1, x: 260, y: 400 }],
      { ...frame, collision: PIN_COLLISION.venue },
    );
    // 60px apart clears the 46px event box but not the 120px venue box.
    expect(eventPins[1].offset).toBe(false);
    expect(venuePins[1].offset).toBe(true);
  });

  it('terminates on a pathological stack instead of spinning', () => {
    const placed = placePins(
      Array.from({ length: 60 }, (_, index) => ({ item: index, x: 200, y: 400 })),
      frame,
    );
    expect(placed).toHaveLength(60);
    expect(placed.every((pin) => Number.isFinite(pin.ax) && Number.isFinite(pin.ay))).toBe(true);
  });
});

describe('isHotEvent', () => {
  it('inverts above 75% sold, not at it', () => {
    expect(isHotEvent(76, 100)).toBe(true);
    expect(isHotEvent(75, 100)).toBe(false);
  });

  it('treats an uncapped show as not hot rather than dividing by zero', () => {
    expect(isHotEvent(10, 0)).toBe(false);
  });
});

describe('resultLine', () => {
  it('reads as the prototype does', () => {
    expect(resultLine(6, 'events', 'All')).toBe('6 events · all · tap a pin for their page');
  });

  it('singularises a lone result', () => {
    expect(resultLine(1, 'venues', 'Punk')).toBe('1 venue · punk · tap a pin for their page');
  });

  it('says zero rather than going blank', () => {
    expect(resultLine(0, 'artists', 'Jazz')).toBe('0 artists · jazz · tap a pin for their page');
  });
});

describe('MAP_ROW_LIMIT', () => {
  it('is a real cap, per §5', () => {
    expect(MAP_ROW_LIMIT).toBeGreaterThan(0);
    expect(MAP_ROW_LIMIT).toBeLessThanOrEqual(500);
  });
});
