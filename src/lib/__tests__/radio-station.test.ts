import { describe, it, expect } from 'vitest';
import { stationPositionAt } from '@/lib/growth-util';

describe('stationPositionAt', () => {
  const rotation = [100, 200, 300]; // loop total = 600s

  it('starts at the first track at loop origin', () => {
    expect(stationPositionAt(rotation, 0)).toEqual({ index: 0, offset: 0 });
  });

  it('reports the offset inside the current track', () => {
    expect(stationPositionAt(rotation, 50)).toEqual({ index: 0, offset: 50 });
  });

  it('advances to the second track after the first ends', () => {
    expect(stationPositionAt(rotation, 100)).toEqual({ index: 1, offset: 0 });
    expect(stationPositionAt(rotation, 250)).toEqual({ index: 1, offset: 150 });
  });

  it('lands on the third track', () => {
    expect(stationPositionAt(rotation, 350)).toEqual({ index: 2, offset: 50 });
  });

  it('wraps around the loop deterministically', () => {
    // 600 = full loop → back to origin; 650 → 50s into the loop.
    expect(stationPositionAt(rotation, 600)).toEqual({ index: 0, offset: 0 });
    expect(stationPositionAt(rotation, 650)).toEqual({ index: 0, offset: 50 });
  });

  it('handles an empty rotation safely', () => {
    expect(stationPositionAt([], 123)).toEqual({ index: 0, offset: 0 });
  });
});
