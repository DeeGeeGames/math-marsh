import type { GameEngine, GameSystemRegistrar } from '../Engine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { activePlayerGridCell, pixelToGrid, positionInGridCell, sameGridCell, sameGridPosition } from '../gameUtils';
import { collectGridCellKeys, positionedEntityGridCellKey } from '../lilyPads';
import {
  playerCollisionQuery,
  mathProblemWithRenderableQuery,
  enemyWithColliderQuery,
  spiderWebWithRenderableQuery,
  frogTongueQuery,
  type PlayerCollisionEntity,
  type SpiderWebEntityWithRenderable,
  type FrogTongueEntity
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { ANIMATION_CONFIG, GAME_CONFIG } from '../../config';
import { startDamageReaction } from '../playerFeedback';
import { handleEquationProblemSelection } from '../equationSelection';
import { playSound } from '../../audio/audio';
import { queueTimeAdjustment } from '../timeAdjustments';
import { gameplayTimeMs } from '../gameplayClock';

const isInvulnerable = (player: PlayerCollisionEntity): boolean =>
  player.components.timers.invulnerability?.active === true;

const startInvulnerability = (player: PlayerCollisionEntity): void => {
  player.components.timers.invulnerability = createTimer(GAME_CONFIG.TIMING.INVULNERABILITY / 1000);
};

const applyPlayerDamage = (
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  startedAt: number,
): void => {
  queueTimeAdjustment(
    ecs,
    player.components.position,
    -GAME_CONFIG.GAMEPLAY.DAMAGE_PENALTY_SECONDS,
    startedAt,
  );
  startDamageReaction(ecs, player, ANIMATION_CONFIG.SHAKE.DAMAGE);
  startInvulnerability(player);
};

/**
 * Collision Detection System
 * Handles collisions between entities, particularly player-problem and player-web interactions
 */

// Add the collision system to ECSpresso
export function addCollisionSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('collisionSystem')
    .setPriority(SYSTEM_PRIORITIES.COLLISION)
    .addSingleton('player', { ...playerCollisionQuery, mutates: ['player', 'timers'] } as const)
    .addQuery('mathProblems', { ...mathProblemWithRenderableQuery, mutates: ['mathProblem', 'renderable'] } as const)
    .addQuery('enemies', enemyWithColliderQuery)
    .addQuery('spiderWebs', spiderWebWithRenderableQuery)
    .addQuery('frogTongues', frogTongueQuery)
    .withResources(['inputState', 'equationMode', 'gameMode', 'mathDifficulty', 'tapEat', 'gameplayClock', 'equationsSolved'])
    .setProcess(({ queries, ecs, resources }) => {
      const tapEat = resources.tapEat;
      if (tapEat) ecs.setResource('tapEat', null);
      const player = queries.player;
      if (!player) return;
      if (player.components.player.gameOverPending) return;

      const invulnerable = isInvulnerable(player);
      const frozen = player.components.timers.freeze?.active === true;

      if (!invulnerable) {
        for (const frog of queries.frogTongues) {
          const tongue = frog.components.frogTongue;
          if (tongue.phase !== 'idle' && tongue.segments.length > 0 && checkPlayerTongueCollision(player, frog)) {
            handlePlayerTongueCollision(ecs, player, frog, gameplayTimeMs(resources.gameplayClock));
            break;
          }
        }
      }
      if (player.components.player.gameOverPending) return;

      if (!frozen) {
        for (const spiderWeb of queries.spiderWebs) {
          if (spiderWeb.components.timers.webBuild?.active) continue;
          if (sameGridPosition(player.components.position, spiderWeb.components.position)) {
            handlePlayerSpiderWebCollision(ecs, player, spiderWeb);
            break;
          }
        }
      }

      const activeProblemCell = activePlayerGridCell(player);
      const enemyOccupiedCells = collectGridCellKeys(queries.enemies);
      const selectableMathProblems = queries.mathProblems
        .filter(problem => !problem.components.mathProblem.consumed)
        .filter(problem => !enemyOccupiedCells.has(positionedEntityGridCellKey(problem)));

      // Check for math problems that can be consumed
      for (const problem of selectableMathProblems) {
        // Math problems follow the intended active tile, not the rendered midpoint.
        if (positionInGridCell(problem.components.position, activeProblemCell)) {
          if (resources.inputState.actions.justActivated('eat')
            || (tapEat && sameGridCell(tapEat, activeProblemCell))) {
            handleEquationProblemSelection(
              ecs,
              player,
              problem,
              selectableMathProblems,
              resources,
            );
          }
        }
      }
      if (player.components.player.gameOverPending) return;

      if (!invulnerable) {
        for (const enemy of queries.enemies) {
          if (enemy.components.timers.enemySpawnTelegraph?.active) continue;
          if (sameGridPosition(player.components.position, enemy.components.position)) {
            handlePlayerEnemyCollision(ecs, player, gameplayTimeMs(resources.gameplayClock));
          }
        }
      }
    });
}

/**
 * Handle collision between player and enemy
 */
function handlePlayerEnemyCollision(ecs: GameEngine, player: PlayerCollisionEntity, startedAt: number): void {
  if (isInvulnerable(player)) return;

  console.log('Player hit by enemy!');
  playSound('damage');

  applyPlayerDamage(ecs, player, startedAt);
}

/**
 * Handle collision between player and spider web
 */
function handlePlayerSpiderWebCollision(
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  spiderWeb: SpiderWebEntityWithRenderable
): void {
  const freezeTime = spiderWeb.components.spiderWeb.freezeTime;
  console.log(`🕸️ Player caught in spider web! Freezing for ${freezeTime}ms`);
  playSound('web');

  player.components.timers.freeze = createTimer(freezeTime / 1000);
  ecs.commands.removeEntity(spiderWeb.id);
}

/**
 * Handle collision between player and frog tongue
 */
function handlePlayerTongueCollision(
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  frog: FrogTongueEntity,
  startedAt: number,
): void {
  const tongueComp = frog.components.frogTongue;

  if (tongueComp.phase === 'idle' || tongueComp.segments.length === 0) return;
  if (isInvulnerable(player)) {
    console.log(`🐸 Player hit by frog tongue but is invulnerable`);
    return;
  }
  if (player.components.player.gameOverPending) return;

  console.log(`🐸 Player hit by frog tongue! Taking damage.`);
  playSound('damage');

  applyPlayerDamage(ecs, player, startedAt);
}

/**
 * Check if player is colliding with frog tongue
 */
function checkPlayerTongueCollision(
  player: PlayerCollisionEntity,
  frog: FrogTongueEntity
): boolean {
  const tongue = frog.components.frogTongue;
  
  if (tongue.phase === 'idle' || tongue.segments.length === 0) {
    return false;
  }

  const playerGrid = pixelToGrid(player.components.position.x, player.components.position.y);
  const hit = tongue.segments.some(segment =>
    playerGrid.x === segment.x && playerGrid.y === segment.y
  );

  if (hit) {
    console.log(`🐸 Collision detected: Player at (${playerGrid.x}, ${playerGrid.y}) hit tongue segment`);
  }

  return hit;
}
