import { describe, expect, test } from 'bun:test';
import { shortestCardinalRoute } from './tapRoute';
import { gridCells } from './lilyPads';

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

  test('alternates up and right on a diagonal route', () => {
    expect(shortestCardinalRoute({ x: 1, y: 3 }, { x: 4, y: 0 })).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  test('preserves a shortest cardinal route for every pair of board cells', () => {
    const cells = gridCells();
    const routes = cells.flatMap(start => cells.map(goal => ({
      start,
      goal,
      route: shortestCardinalRoute(start, goal),
    })));
    expect(routes.every(({ start, goal, route }) => {
      const points = [start, ...route];
      return route.length === Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y)
        && (route.at(-1)?.x ?? start.x) === goal.x
        && (route.at(-1)?.y ?? start.y) === goal.y
        && points.slice(1).every((point, index) =>
          Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y) === 1,
        );
    })).toBe(true);
  });
});
