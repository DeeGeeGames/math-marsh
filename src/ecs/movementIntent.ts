import type { Components, GameAction } from './types';
import { GAME_CONFIG, MOVEMENT_CONFIG } from '../config';
import { clamp, gridToPixel, sameGridCell } from './gameUtils';
import { shortestCardinalRoute } from './tapRoute';
import { closestActiveLilyPadGridCell, isPointOnLilyPad, type BoardPoint, type GridCell } from './lilyPads';
import type { MathProblemEntity } from './queries';

export type Direction = Extract<GameAction, 'up' | 'down' | 'left' | 'right'>;

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const satisfies readonly Direction[];

const DIRECTION_DELTAS = {
  up:    { dx:  0, dy: -1 },
  right: { dx:  1, dy:  0 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
} as const satisfies Record<Direction, { dx: number; dy: number }>;

export function activeDirection(
  predicate: (direction: Direction) => boolean,
): Direction | undefined {
  const directions = DIRECTIONS.filter(predicate);
  return directions.length === 1 ? directions[0] : undefined;
}

function adjacentGridPoint(
  gridPoint: Readonly<{ x: number; y: number }>,
  direction: Direction,
): { x: number; y: number } {
  const delta = DIRECTION_DELTAS[direction];
  return {
    x: clamp(gridPoint.x + delta.dx, 0, GAME_CONFIG.GRID.WIDTH - 1),
    y: clamp(gridPoint.y + delta.dy, 0, GAME_CONFIG.GRID.HEIGHT - 1),
  };
}

export function canContinueFrom(
  gridPoint: Readonly<{ x: number; y: number }>,
  direction: Direction | undefined,
): boolean {
  if (!direction) return false;
  const nextGrid = adjacentGridPoint(gridPoint, direction);
  return nextGrid.x !== gridPoint.x || nextGrid.y !== gridPoint.y;
}

export function updateBreadcrumbs(
  pathFollower: Readonly<Components['pathFollower']>,
  direction: Direction,
): Components['pathFollower']['breadcrumbs'] {
  const cursor = pathFollower.breadcrumbs.at(-1) ?? {
    x: pathFollower.anchorGridX,
    y: pathFollower.anchorGridY,
  };
  const nextGrid = adjacentGridPoint(cursor, direction);

  if (nextGrid.x === cursor.x && nextGrid.y === cursor.y) {
    return pathFollower.breadcrumbs;
  }

  // Rewrite-on-reversal: if the candidate is already in the path
  // (anchor + breadcrumbs), truncate to that point. Backtracking and
  // 180-degree reversals fall out naturally.
  const matchingBreadcrumb = pathFollower.breadcrumbs.findIndex(
    breadcrumb => breadcrumb.x === nextGrid.x && breadcrumb.y === nextGrid.y,
  );
  const matchesAnchor = nextGrid.x === pathFollower.anchorGridX
    && nextGrid.y === pathFollower.anchorGridY;

  if (matchesAnchor) return [];
  if (matchingBreadcrumb >= 0) {
    return pathFollower.breadcrumbs.slice(0, matchingBreadcrumb + 1);
  }
  if (pathFollower.breadcrumbs.length >= MOVEMENT_CONFIG.MAX_QUEUE_LENGTH) {
    return pathFollower.breadcrumbs;
  }

  return [...pathFollower.breadcrumbs, nextGrid];
}

type MovementIntent = {
  breadcrumbs: Components['pathFollower']['breadcrumbs'];
  tapEat: GridCell | null;
  tapTarget: GridCell | null;
  playMoveSound: boolean;
};

type MovementIntentInput = {
  pathFollower: Readonly<Components['pathFollower']>;
  position: Readonly<Components['position']>;
  mathProblems: readonly MathProblemEntity[];
  tapRequest: BoardPoint | null;
  frozen: boolean;
  pressedDirection: Direction | undefined;
};

function tapIntent(input: MovementIntentInput): MovementIntent {
  const { pathFollower, position, tapRequest, mathProblems } = input;
  const unchanged: MovementIntent = {
    breadcrumbs: pathFollower.breadcrumbs,
    tapEat: null,
    tapTarget: null,
    playMoveSound: false,
  };
  if (input.frozen || !tapRequest) return unchanged;
  const target = closestActiveLilyPadGridCell(tapRequest, mathProblems);
  if (!target) return unchanged;

  const head = pathFollower.breadcrumbs[0];
  const start = head ?? { x: pathFollower.anchorGridX, y: pathFollower.anchorGridY };
  const startPosition = gridToPixel(start.x, start.y);
  const settled = pathFollower.breadcrumbs.length === 0
    && Math.abs(position.x - startPosition.x) < 1e-3
    && Math.abs(position.y - startPosition.y) < 1e-3;
  if (settled && sameGridCell(start, target) && isPointOnLilyPad(tapRequest, target)) {
    return { ...unchanged, tapEat: target, tapTarget: target };
  }

  // Finish the current segment before following a new tap route. Unlike
  // directional queueing, a tap route can cross the entire board.
  const route = shortestCardinalRoute(start, target);
  return {
    ...unchanged,
    breadcrumbs: head ? [head, ...route] : route,
    tapTarget: target,
    playMoveSound: route.length > 0,
  };
}

/** Resolve tap input first, then let a fresh directional press take over. */
export function resolveMovementIntent(input: MovementIntentInput): MovementIntent {
  const tap = tapIntent(input);
  if (input.frozen || !input.pressedDirection) return tap;
  const queued = tap.breadcrumbs.length > 1 ? tap.breadcrumbs.slice(0, 1) : tap.breadcrumbs;
  const breadcrumbs = updateBreadcrumbs({ ...input.pathFollower, breadcrumbs: queued }, input.pressedDirection);
  return { ...tap, breadcrumbs, playMoveSound: tap.playMoveSound || breadcrumbs !== queued };
}
