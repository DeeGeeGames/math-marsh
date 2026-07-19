import { describe, expect, test } from 'bun:test';
import { gridToPixel } from '../gameUtils';
import { gridCellKey } from '../lilyPads';
import { shouldPlayerFlap } from './PlayerSpriteSystem';

const ACTIVE_LILY_PAD = new Set([gridCellKey({ x: 2, y: 3 })]);

describe('player sprite animation', () => {
  test('rests while stopped on an active lily pad', () => {
    expect(shouldPlayerFlap(0, gridToPixel(2, 3), ACTIVE_LILY_PAD)).toBe(false);
  });

  test('continually flaps while stopped over water', () => {
    expect(shouldPlayerFlap(0, gridToPixel(1, 3), ACTIVE_LILY_PAD)).toBe(true);
  });

  test('flaps while moving from a lily pad', () => {
    expect(shouldPlayerFlap(100, gridToPixel(2, 3), ACTIVE_LILY_PAD)).toBe(true);
  });
});
