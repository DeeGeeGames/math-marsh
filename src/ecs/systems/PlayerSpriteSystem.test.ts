import { describe, expect, test } from 'bun:test';
import { nextPlayerSpriteElapsed } from './PlayerSpriteSystem';

describe('player sprite animation', () => {
  test('continues flying from the first frame', () => {
    expect(nextPlayerSpriteElapsed(0, 1 / 24)).toBe(1 / 24);
  });

  test('loops after the eighth frame', () => {
    expect(nextPlayerSpriteElapsed(7 / 24, 1 / 24)).toBeCloseTo(0);
  });
});
