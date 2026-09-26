import { gameplayTimeMs } from '../gameplayClock';
import type { GameSystemRegistrar } from '../Engine';
import { MOVEMENT_CONFIG } from '../../config';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { mathProblemQuery, playerMovementQuery } from '../queries';
import { clamp, gridToPixel } from '../gameUtils';
import { playSound } from '../../audio/audio';
import { activeDirection, canContinueFrom, resolveMovementIntent, updateBreadcrumbs } from '../movementIntent';

export function addMovementSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('movementSystem')
    .setPriority(SYSTEM_PRIORITIES.MOVEMENT)
    .inPhase('preUpdate')
    .addSingleton('player', playerMovementQuery)
    .addQuery('mathProblems', mathProblemQuery)
    .runWhenEmpty()
    .withResources(['inputState', 'tapRequest'])
    .setProcess(({ queries, dt, ecs, resources: { inputState, tapRequest } }) => {
      const entity = queries.player;
      if (!entity) return;
      const position = entity.components.position;
      const player = entity.components.player;
      const pf = entity.components.pathFollower;

      if (player.gameOverPending) return;

      const frozen = entity.components.timers.freeze?.active === true;

      if (tapRequest) ecs.setResource('tapRequest', null);
      const intent = resolveMovementIntent({
        pathFollower: pf,
        position,
        mathProblems: queries.mathProblems,
        tapRequest,
        frozen,
        pressedDirection: activeDirection(direction => inputState.actions.justActivated(direction)),
      });
      pf.breadcrumbs = intent.breadcrumbs;
      if (intent.tapEat) ecs.setResource('tapEat', intent.tapEat);
      if (intent.tapTarget) {
        ecs.setResource('tapFeedback', {
          ...intent.tapTarget,
          startedAt: gameplayTimeMs(ecs.getResource('gameplayClock')),
        });
      }
      if (intent.playMoveSound) playSound('move');

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
