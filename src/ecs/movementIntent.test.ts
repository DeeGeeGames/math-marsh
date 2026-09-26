import { describe, expect, test } from 'bun:test';
import { gridCellCenter, gridToPixel } from './gameUtils';
import { activeDirection, canContinueFrom, resolveMovementIntent, updateBreadcrumbs } from './movementIntent';
import type { MathProblemEntity } from './queries';
import type { Components } from './types';

function problem(x: number, y: number, consumed = false): MathProblemEntity {
  return { id: y * 6 + x, components: {
    position: gridToPixel(x, y),
    answerConsumption: undefined,
    mathProblem: { value: 3, difficulty: 1, consumed },
  } };
}

function input(overrides: Partial<Parameters<typeof resolveMovementIntent>[0]> = {}): Parameters<typeof resolveMovementIntent>[0] {
  return {
    pathFollower: { anchorGridX: 1, anchorGridY: 1, breadcrumbs: [], speed: 0 },
    position: gridToPixel(1, 1),
    mathProblems: [problem(1, 1), problem(5, 4)],
    tapRequest: null,
    frozen: false,
    pressedDirection: undefined,
    ...overrides,
  };
}

describe('movement input arbitration', () => {
  test('retargeting in flight preserves the current segment without mutating the old route', () => {
    const original = input({
      pathFollower: { anchorGridX: 1, anchorGridY: 1, breadcrumbs: [{ x: 2, y: 1 }, { x: 3, y: 1 }], speed: 100 },
      tapRequest: gridCellCenter(5, 4),
    });
    const snapshot = structuredClone(original);
    const intent = resolveMovementIntent(original);
    expect(intent.breadcrumbs[0]).toEqual({ x: 2, y: 1 });
    expect(intent.breadcrumbs.at(-1)).toEqual({ x: 5, y: 4 });
    expect(intent.breadcrumbs.length).toBeGreaterThan(2);
    expect(intent.tapEat).toBeNull();
    expect(original).toEqual(snapshot);
  });

  test('fresh directional input takes over a tap route after its current segment', () => {
    const intent = resolveMovementIntent(input({ tapRequest: gridCellCenter(5, 4), pressedDirection: 'right' }));
    const first = intent.breadcrumbs[0];
    if (!first) throw new Error('Expected an in-flight segment');
    expect(intent.breadcrumbs).toEqual([first, { x: first.x + 1, y: first.y }]);
    expect(intent.tapEat).toBeNull();
  });

  test('tapping an empty cell routes to that cell instead of a lily pad', () => {
    const intent = resolveMovementIntent(input({ tapRequest: gridCellCenter(3, 2) }));
    expect(intent.breadcrumbs.at(-1)).toEqual({ x: 3, y: 2 });
    expect(intent.tapTarget).toEqual({ x: 3, y: 2 });
    expect(intent.tapEat).toBeNull();
  });

  test('tapping an empty cell works when no lily pads remain', () => {
    const intent = resolveMovementIntent(input({
      mathProblems: [], tapRequest: gridCellCenter(2, 1),
    }));
    expect(intent.breadcrumbs).toEqual([{ x: 2, y: 1 }]);
    expect(intent.tapTarget).toEqual({ x: 2, y: 1 });
  });

  test('freeze rejects taps and directional presses while retaining the existing route', () => {
    const frozen = input({
      frozen: true,
      tapRequest: gridCellCenter(5, 4),
      pressedDirection: 'left',
      pathFollower: { anchorGridX: 1, anchorGridY: 1, breadcrumbs: [{ x: 2, y: 1 }], speed: 100 },
    });
    expect(resolveMovementIntent(frozen)).toEqual({
      breadcrumbs: frozen.pathFollower.breadcrumbs, tapEat: null, tapTarget: null, playMoveSound: false,
    });
  });

  test('only a settled tap on the current lily pad requests Eat', () => {
    expect(resolveMovementIntent(input({ tapRequest: gridCellCenter(1, 1) })).tapEat).toEqual({ x: 1, y: 1 });
    expect(resolveMovementIntent(input({ tapRequest: gridToPixel(1, 1) })).tapEat).toBeNull();
    expect(resolveMovementIntent(input({ tapRequest: gridCellCenter(5, 4) })).tapEat).toBeNull();
    expect(resolveMovementIntent(input({
      tapRequest: gridCellCenter(1, 1),
      position: { x: gridToPixel(1, 1).x + 10, y: gridToPixel(1, 1).y },
    })).tapEat).toBeNull();
    expect(resolveMovementIntent(input({
      tapRequest: gridCellCenter(1, 1), mathProblems: [problem(1, 1, true)],
    })).tapEat).toBeNull();
    expect(resolveMovementIntent(input({
      tapRequest: gridCellCenter(1, 1), mathProblems: [],
    })).tapEat).toBeNull();
  });

  test('tapping the in-flight destination never eats before arrival', () => {
    const intent = resolveMovementIntent(input({
      mathProblems: [problem(2, 1)], tapRequest: gridCellCenter(2, 1),
      pathFollower: { anchorGridX: 1, anchorGridY: 1, breadcrumbs: [{ x: 2, y: 1 }], speed: 100 },
    }));
    expect(intent.breadcrumbs).toEqual([{ x: 2, y: 1 }]);
    expect(intent.tapEat).toBeNull();
  });

  test('reversal truncates to the anchor and held continuation stops at board edges', () => {
    const path: Components['pathFollower'] = {
      anchorGridX: 1, anchorGridY: 1, breadcrumbs: [{ x: 2, y: 1 }], speed: 100,
    };
    expect(updateBreadcrumbs(path, 'left')).toEqual([]);
    expect(canContinueFrom({ x: 5, y: 4 }, 'right')).toBe(false);
    expect(canContinueFrom({ x: 5, y: 4 }, 'down')).toBe(false);
    expect(canContinueFrom({ x: 5, y: 4 }, 'left')).toBe(true);
    expect(canContinueFrom({ x: 5, y: 4 }, undefined)).toBe(false);
    expect(activeDirection(direction => direction === 'left' || direction === 'right')).toBeUndefined();
  });
});
