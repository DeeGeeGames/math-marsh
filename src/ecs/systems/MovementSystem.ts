import { gameEngine } from '../Engine';
import type { Components, GameAction } from '../types';
import { GAME_CONFIG, MOVEMENT_CONFIG } from '../../config';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { playerMovementQuery } from '../queries';
import { clamp, gridToPixel } from '../gameUtils';
import { playSound } from '../../audio/audio';

type Direction = Extract<GameAction, 'up' | 'down' | 'left' | 'right'>;

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const satisfies readonly Direction[];

const DIRECTION_DELTAS = {
  up:    { dx:  0, dy: -1 },
  right: { dx:  1, dy:  0 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
} as const satisfies Record<Direction, { dx: number; dy: number }>;

function activeDirection(
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

function canContinueFrom(
  gridPoint: Readonly<{ x: number; y: number }>,
  direction: Direction | undefined,
): boolean {
  if (!direction) return false;
  const nextGrid = adjacentGridPoint(gridPoint, direction);
  return nextGrid.x !== gridPoint.x || nextGrid.y !== gridPoint.y;
}

function updateBreadcrumbs(
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

export function addMovementSystemToEngine(): void {
  gameEngine.addSystem('movementSystem')
    .setPriority(SYSTEM_PRIORITIES.MOVEMENT)
    .inPhase('preUpdate')
    .withResources(['inputState'])
    .setProcessEach(playerMovementQuery, ({ entity, dt, resources: { inputState } }) => {
      const position = entity.components.position;
      const player = entity.components.player;
      const pf = entity.components.pathFollower;

      if (player.gameOverPending) return;

      const frozen = entity.components.timers.freeze?.active === true;

      // Phase A — input updates the breadcrumb queue. Skipped while frozen so
      // the player can't queue moves through a stun.
      if (!frozen) {
        const pressedDirection = activeDirection(
          direction => inputState.actions.justActivated(direction),
        );
        if (pressedDirection) {
          const breadcrumbs = updateBreadcrumbs(pf, pressedDirection);
          if (breadcrumbs !== pf.breadcrumbs) playSound('move');
          pf.breadcrumbs = breadcrumbs;
        }
      }

      // Phase B — motion.
      if (frozen) {
        pf.speed = 0;
        return;
      }

      const heldDirection = activeDirection(
        direction => inputState.actions.isActive(direction),
      );

      const head = pf.breadcrumbs[0];
      const targetGrid = head ?? { x: pf.anchorGridX, y: pf.anchorGridY };
      const target = gridToPixel(targetGrid.x, targetGrid.y);

      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const remaining = Math.abs(dx) + Math.abs(dy);

      if (remaining < 1e-3 && pf.breadcrumbs.length === 0) {
        pf.speed = 0;
        position.x = target.x;
        position.y = target.y;
        return;
      }

      // Held input reserves a continuation without adding a real breadcrumb,
      // so releasing can still stop the player on the tile being entered.
      const brakeDistance = (pf.speed * pf.speed) / (2 * MOVEMENT_CONFIG.ACCEL);
      const hasContinuation = canContinueFrom(targetGrid, heldDirection);
      const shouldBrake = pf.breadcrumbs.length <= 1
        && !hasContinuation
        && remaining <= brakeDistance;
      const accel = shouldBrake ? -MOVEMENT_CONFIG.ACCEL : MOVEMENT_CONFIG.ACCEL;
      pf.speed = clamp(pf.speed + accel * dt, 0, MOVEMENT_CONFIG.MAX_SPEED);

      // Cardinal motion is recomputed each frame from sign(target - position).
      const step = pf.speed * dt;
      if (remaining > step) {
        position.x += Math.sign(dx) * step;
        position.y += Math.sign(dy) * step;
        return;
      }

      position.x = target.x;
      position.y = target.y;

      if (pf.breadcrumbs.length > 0) {
        pf.anchorGridX = targetGrid.x;
        pf.anchorGridY = targetGrid.y;
        pf.breadcrumbs = pf.breadcrumbs.slice(1);
      }

      if (pf.breadcrumbs.length === 0 && heldDirection) {
        pf.breadcrumbs = updateBreadcrumbs(pf, heldDirection);
      }
    });
}
