import { gameEngine, type GameEngine } from '../Engine';
import { createEnemy } from '../entities';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import { gridToPixel } from '../gameUtils';
import {
  activeLilyPadGridCells,
  collectGridCellKeys,
  gridCellKey,
  isEdgeGridCell,
  type GridCell,
} from '../lilyPads';
import {
  enemyQuery,
  mathProblemQuery,
  playerQuery,
  spiderWebQuery
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { EnemyType } from '../../types/shared';
import { enemySpawnIntervalForLevel, enemySpawnOrderForLevel } from '../enemyDifficulty';

export function addEnemySpawnSystemToEngine(): void {
  gameEngine.addSystem('enemySpawnSystem')
    .setPriority(SYSTEM_PRIORITIES.ENEMY_SPAWN)
    .addQuery('enemies', enemyQuery)
    .addQuery('mathProblems', mathProblemQuery)
    .addQuery('spiderWebs', spiderWebQuery)
    .addSingleton('player', { ...playerQuery, mutates: ['timers'] } as const)
    .withResources(['currentLevel'])
    .setProcess(({ queries, ecs, resources: { currentLevel } }) => {
      const player = queries.player;
      if (!player) return;

      const spawnOrder = enemySpawnOrderForLevel(currentLevel);
      const { index } = ecs.getResource('enemySpawn');
      const currentEnemyCount = queries.enemies.length;
      const cycleComplete = index >= spawnOrder.length;

      if (cycleComplete && currentEnemyCount === 0) {
        ecs.setResource('enemySpawn', { index: 0 });
        console.log('🔄 Resetting spawn cycle - ready to spawn new enemy sequence');
        return;
      }

      const enemyLimit = Math.min(GAME_CONFIG.ENEMY_SPAWN.MAX_ENEMIES, spawnOrder.length);
      if (cycleComplete || currentEnemyCount >= enemyLimit) return;
      if (player.components.timers.enemySpawn?.active) return;

      const nextEnemyType = spawnOrder[index];
      if (!nextEnemyType) return;

      const occupiedCells = collectGridCellKeys([
        player,
        ...queries.enemies,
        ...queries.spiderWebs,
      ]);
      const lilyPadCells = activeLilyPadGridCells(queries.mathProblems);
      const spawned = spawnEnemyOnLilyPad(ecs, nextEnemyType, occupiedCells, lilyPadCells);
      if (!spawned) {
        player.components.timers.enemySpawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
        return;
      }

      console.log(`Spawned ${nextEnemyType} (#${index + 1}/${spawnOrder.length})`);

      const nextIndex = index + 1;
      ecs.setResource('enemySpawn', { index: nextIndex });
      if (nextIndex >= spawnOrder.length) console.log(`🔄 Spawn cycle complete - ${spawnOrder.length} enemy types spawned`);

      player.components.timers.enemySpawn = createTimer(enemySpawnIntervalForLevel(currentLevel) / 1000);
    });
}

function spawnEnemyOnLilyPad(
  ecs: GameEngine,
  enemyType: EnemyType,
  occupiedCells: ReadonlySet<string>,
  lilyPadCells: readonly GridCell[],
): boolean {
  const spawnCell = getRandomAvailableLilyPad(occupiedCells, lilyPadCells);
  if (!spawnCell) return false;

  const pixelPos = gridToPixel(spawnCell.x, spawnCell.y);
  const behaviors = GAME_CONFIG.ENEMY_TYPES[enemyType].AI_BEHAVIORS;
  const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

  createEnemy(ecs.commands, pixelPos.x, pixelPos.y, enemyType, behavior);
  return true;
}

function randomEntry<T>(entries: readonly T[]): T | undefined {
  return entries[Math.floor(Math.random() * entries.length)];
}

function getRandomAvailableLilyPad(
  occupiedCells: ReadonlySet<string>,
  lilyPadCells: readonly GridCell[],
): GridCell | undefined {
  const available = lilyPadCells
    .filter(position => !occupiedCells.has(gridCellKey(position)));
  const edge = available.filter(isEdgeGridCell);

  return randomEntry(edge.length > 0 ? edge : available);
}
