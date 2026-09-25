import { describe, expect, test } from 'bun:test';
import { shortestCardinalRoute } from './tapRoute';

describe('tap route', () => {
  test('crosses the full board through cardinal cells on a shortest route', () => {
    const start = { x: 0, y: 0 };
    const goal = { x: 5, y: 4 };
    const route = shortestCardinalRoute(start, goal);
    const points = [start, ...route];

    expect(route).toHaveLength(9);
    expect(route.at(-1)).toEqual(goal);
    expect(points.slice(1).every((point, index) =>
      Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y) === 1,
    )).toBe(true);
  });

  test('needs no movement when the fly is already on the target cell', () => {
    expect(shortestCardinalRoute({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual([]);
  });
});
