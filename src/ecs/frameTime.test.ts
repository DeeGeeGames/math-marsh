import { describe, expect, test } from 'bun:test';
import { frameDeltaSeconds } from './frameTime';

describe('frame time', () => {
  test('keeps ordinary frame timing and discards stall catch-up', () => {
    expect(frameDeltaSeconds(1016, 1000, false)).toBeCloseTo(0.016);
    expect(frameDeltaSeconds(91000, 1000, false)).toBe(0.1);
    // The loop advances its timestamp even when the previous frame was capped.
    expect(frameDeltaSeconds(91016, 91000, false)).toBeCloseTo(0.016);
  });

  test('hidden, backwards, and invalid timestamps cannot advance the simulation', () => {
    expect(frameDeltaSeconds(91000, 1000, true)).toBe(0);
    expect(frameDeltaSeconds(900, 1000, false)).toBe(0);
    expect(frameDeltaSeconds(Number.NaN, 1000, false)).toBe(0);
    expect(frameDeltaSeconds(Number.POSITIVE_INFINITY, 1000, false)).toBe(0);
  });
});
