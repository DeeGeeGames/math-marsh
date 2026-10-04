import { describe, expect, test } from 'bun:test';
import { frogTongueDirection } from './frogTongueAim';

describe('frog tongue aiming', () => {
  test.each([
    [{ x: 4, y: 2 }, { x: 1, y: 0 }],
    [{ x: -4, y: 2 }, { x: -1, y: 0 }],
    [{ x: 2, y: 4 }, { x: 0, y: 1 }],
    [{ x: 2, y: -4 }, { x: 0, y: -1 }],
    [{ x: 2, y: 2 }, { x: 1, y: 0 }],
    [{ x: -2, y: -2 }, { x: -1, y: 0 }],
  ])('aims toward player offset %j', (player, expected) => {
    expect(frogTongueDirection({ x: 0, y: 0 }, player)).toEqual(expected);
  });

  test('edge and corner frogs always aim into the board toward an interior player', () => {
    const player = { x: 2, y: 2 };
    const edges = [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 4 }, { x: 5, y: 4 },
      { x: 0, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 0 }, { x: 2, y: 4 },
    ];
    for (const frog of edges) {
      const direction = frogTongueDirection(frog, player);
      expect(direction).toBeDefined();
      if (!direction) throw new Error('Expected an aim direction');
      const next = { x: frog.x + direction.x, y: frog.y + direction.y };
      expect(next.x).toBeGreaterThanOrEqual(0);
      expect(next.x).toBeLessThan(6);
      expect(next.y).toBeGreaterThanOrEqual(0);
      expect(next.y).toBeLessThan(5);
      expect(Math.abs(player.x - next.x) + Math.abs(player.y - next.y))
        .toBeLessThan(Math.abs(player.x - frog.x) + Math.abs(player.y - frog.y));
    }
  });

  test('skips aiming when the player overlaps the frog', () => {
    expect(frogTongueDirection({ x: 2, y: 2 }, { x: 2, y: 2 })).toBeUndefined();
  });
});
