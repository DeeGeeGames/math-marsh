import type { BoardSize } from '../boardGeometry';
import type { GameEngine, GameSystemRegistrar } from '../Engine';
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
  eliminatingEnemyQuery,
  mathProblemQuery,
  playerQuery,
  spiderWebQuery
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { EnemyType } from '../../types/shared';
import { enemySpawnIntervalForLevel, enemyChallengeLevelForDifficulty } from '../enemyDifficulty';

export function addEnemySpawnSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('enemySpawnSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.ENEMY_SPAWN)
    .addQuery('enemies', enemyQuery)
    .addQuery('eliminatingEnemies', { ...eliminatingEnemyQuery, mutates: ['timers'] } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .addQuery('spiderWebs', spiderWebQuery)
    .addSingleton('player', { ...playerQuery, mutates: ['timers'] } as const)
    .withResources(['currentLevel', 'enemySpawn', 'board'])
    .setProcess(({ queries, ecs, resources: { currentLevel, enemySpawn, board } }) => {
      const player = queries.player;
      if (!player || player.components.player.gameOverPending) return;

      const occupiedCells = collectGridCellKeys([
        player,
        ...queries.enemies,
        ...queries.spiderWebs,
      ]);
      queries.enemies.forEach(enemy => {
        const plannedMove = enemy.components.enemy.plannedMove;
        if (plannedMove) occupiedCells.add(gridCellKey(plannedMove));
      });
      const lilyPadCells = activeLilyPadGridCells(queries.mathProblems);

      queries.eliminatingEnemies.forEach(enemy => {
        if (enemy.components.timers.enemyRespawn?.active) return;

        const spawnCell = spawnEnemyOnLilyPad(
          ecs,
          enemy.components.enemy.enemyType,
          occupiedCells,
          lilyPadCells,
          board,
        );
        if (!spawnCell) {
          enemy.components.timers.enemyRespawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
          return;
        }

        occupiedCells.add(gridCellKey(spawnCell));
        ecs.commands.removeEntity(enemy.id);
      });

      const { index, roster } = enemySpawn;
      if (index >= roster.length) return;
      if (player.components.timers.enemySpawn?.active) return;

      const nextEnemyType = roster[index];
      if (!nextEnemyType) return;

      const spawned = spawnEnemyOnLilyPad(ecs, nextEnemyType, occupiedCells, lilyPadCells, board);
      if (!spawned) {
        player.components.timers.enemySpawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
        return;
      }

      console.log(`Spawned ${nextEnemyType} (#${index + 1}/${roster.length})`);

      const nextIndex = index + 1;
      ecs.setResource('enemySpawn', { index: nextIndex, roster });

      player.components.timers.enemySpawn = createTimer(enemySpawnIntervalForLevel(ecs.tryGetResource('mathSession')
        ? enemyChallengeLevelForDifficulty(ecs.getResource('mathDifficulty')) : currentLevel) / 1000);
    });
}

function spawnEnemyOnLilyPad(
  ecs: GameEngine,
  enemyType: EnemyType,
  occupiedCells: ReadonlySet<string>,
  lilyPadCells: readonly GridCell[],
  board: BoardSize,
): GridCell | undefined {
  const spawnCell = getRandomAvailableLilyPad(occupiedCells, lilyPadCells, board);
  if (!spawnCell) return undefined;

  const pixelPos = gridToPixel(spawnCell.x, spawnCell.y);
  const behaviors = GAME_CONFIG.ENEMY_TYPES[enemyType].AI_BEHAVIORS;
  const behavior = randomEntry(behaviors);
  if (behavior === undefined) return undefined;

  createEnemy(ecs.commands, pixelPos.x, pixelPos.y, enemyType, behavior);
  return spawnCell;
}

function randomEntry<T>(entries: readonly T[]): T | undefined {
  return entries[Math.floor(Math.random() * entries.length)];
}

function getRandomAvailableLilyPad(
  occupiedCells: ReadonlySet<string>,
  lilyPadCells: readonly GridCell[],
  board: BoardSize,
): GridCell | undefined {
  const available = lilyPadCells
    .filter(position => !occupiedCells.has(gridCellKey(position)));
  const edge = available.filter(cell => isEdgeGridCell(cell, board));

  return randomEntry(edge.length > 0 ? edge : available);
}
