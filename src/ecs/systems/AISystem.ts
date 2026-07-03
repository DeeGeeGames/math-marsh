import { gameEngine, type GameEngine } from '../Engine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { createNavGrid, findPath, type NavGrid } from 'ecspresso/plugins/ai/pathfinding';
import { pixelToGrid, gridToPixel } from '../gameUtils';
import { GAME_CONFIG } from '../../config';
import type { AIBehavior, EnemyType } from '../../types/shared';
import {
  enemyQuery,
  mathProblemQuery,
  playerQuery,
  type EnemyEntity,
  type PlayerEntity
} from '../queries';
import {
  activeLilyPadCellKeys,
  gridCells,
  isActiveLilyPadCell,
  type GridCell,
} from '../lilyPads';
import { AI_CONFIG, SYSTEM_PRIORITIES } from '../systemConfigs';
import { isEntityAnimating } from './AnimationSystem';
import { createSpiderWeb } from './SpiderWebSystem';
import { isFrogAttacking } from './FrogTongueSystem';
import { startFrogGridMovement } from './FrogSpriteSystem';
import { startEnemyGridMovement } from './EnemySpriteSystem';
import { enemyMoveBaseIntervalForLevel } from '../enemyDifficulty';

const SPIDER_CONFIG = GAME_CONFIG.ENEMY_TYPES.spider;

const navGrid: NavGrid = createNavGrid({
  width: GAME_CONFIG.GRID.WIDTH,
  height: GAME_CONFIG.GRID.HEIGHT,
  cellSize: GAME_CONFIG.GRID.CELL_SIZE,
});

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
] as const;

const BEHAVIOR_MULTIPLIERS: Record<AIBehavior, number> = {
  chase: AI_CONFIG.CHASE_SPEED_MULTIPLIER,
  patrol: AI_CONFIG.PATROL_SPEED_MULTIPLIER,
  random: AI_CONFIG.RANDOM_SPEED_MULTIPLIER,
  guard: AI_CONFIG.GUARD_SPEED_MULTIPLIER,
};

const ENEMY_TYPE_MULTIPLIERS: Record<EnemyType, number> = {
  lizard: AI_CONFIG.ENEMY_SPEED_MULTIPLIERS.lizard,
  spider: AI_CONFIG.ENEMY_SPEED_MULTIPLIERS.spider,
  frog: AI_CONFIG.ENEMY_SPEED_MULTIPLIERS.frog,
};

const GUARD_RADIUS = 2;
const GUARD_MOVE_CHANCE = 0.3;

const cellOf = (entity: { components: { position: { x: number; y: number } } }): number => {
  const { x, y } = pixelToGrid(entity.components.position.x, entity.components.position.y);
  return navGrid.cellFromXY(x, y);
};

/**
 * Next grid step from `startCell` toward `goalCell` using A*, respecting `blocked`.
 * `startCell` is always passable to A* (per pathfinding contract) even when in `blocked`.
 */
function nextStepTowards(
  startCell: number,
  goalCell: number,
  blocked: Set<number>
): GridCell | undefined {
  if (startCell === goalCell) return navGrid.cellToXY(startCell);
  const path = findPath(navGrid, startCell, goalCell, { blockedCells: blocked });
  if (!path || path.length < 2) return undefined;
  return navGrid.cellToXY(path[1]);
}

interface AIContext {
  enemy: EnemyEntity;
  player: PlayerEntity;
  currentGrid: GridCell;
  startCell: number;
  blocked: Set<number>;
  activeLilyPadCells: ReadonlySet<string>;
}

const AI_PROCESSORS: Record<AIBehavior, (ctx: AIContext) => GridCell> = {
  chase: processChaseAI,
  patrol: processPatrolAI,
  random: processRandomAI,
  guard: processGuardAI,
};

export function addAISystemToEngine(): void {
  gameEngine.addSystem('aiSystem')
    .setPriority(SYSTEM_PRIORITIES.AI)
    .inPhase('preUpdate')
    .addQuery('enemies', { ...enemyQuery, optional: ['frogTongue'], mutates: ['enemy', 'timers'] } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .addSingleton('player', playerQuery)
    .withResources(['currentLevel'])
    .setProcess(({ queries, ecs, resources: { currentLevel } }) => {
      const { enemies, player } = queries;
      if (!player) return;

      // Shared per-frame blocker set: all enemy cells plus destination cells
      // already claimed by earlier enemy decisions this frame.
      const blocked = new Set(enemies.map(cellOf));
      const activeLilyPadCells = activeLilyPadCellKeys(queries.mathProblems);

      for (const enemy of enemies) {
        if (enemy.components.timers.enemySpawnTelegraph?.active) continue;
        if (isEntityAnimating(ecs, enemy.id)) continue;
        if (isFrogAttacking(enemy.components.frogTongue)) continue;
        processEnemyAI(ecs, enemy, player, blocked, activeLilyPadCells, currentLevel);
      }
    });
}

function processEnemyAI(
  ecs: GameEngine,
  enemy: EnemyEntity,
  player: PlayerEntity,
  blocked: Set<number>,
  activeLilyPadCells: ReadonlySet<string>,
  currentLevel: number,
): void {
  const enemyPos = enemy.components.position;
  const enemyData = enemy.components.enemy;
  const timers = enemy.components.timers;

  if (timers.enemyMove?.active) return;

  const currentGrid = pixelToGrid(enemyPos.x, enemyPos.y);
  const startCell = navGrid.cellFromXY(currentGrid.x, currentGrid.y);

  const { x: nextGridX, y: nextGridY } = AI_PROCESSORS[enemyData.behaviorType]({
    enemy, player, currentGrid, startCell, blocked, activeLilyPadCells,
  });

  const newPixelPos = gridToPixel(nextGridX, nextGridY);
  const moved = newPixelPos.x !== enemyPos.x || newPixelPos.y !== enemyPos.y;

  if (moved) {
    blocked.add(navGrid.cellFromXY(nextGridX, nextGridY));

    if (enemyData.enemyType === 'frog') {
      startFrogGridMovement(ecs, enemy.id, currentGrid, { x: nextGridX, y: nextGridY }, newPixelPos.x, newPixelPos.y);
    } else {
      startEnemyGridMovement(ecs, enemy.id, enemyData.enemyType, currentGrid, { x: nextGridX, y: nextGridY }, newPixelPos.x, newPixelPos.y);
    }
  }

  if (enemyData.enemyType === 'spider' && moved &&
      Math.random() < SPIDER_CONFIG.WEB_PLACEMENT_CHANCE) {
    // The spider has vacated startCell, so the only thing that could occupy
    // it is the player.
    if (startCell !== cellOf(player)) {
      createSpiderWeb(ecs, currentGrid.x, currentGrid.y);
    }
  }

  const moveInterval = calculateMoveInterval(enemyData.behaviorType, currentLevel, enemyData.enemyType);
  const variation = (Math.random() - 0.5) * moveInterval * 0.2;
  timers.enemyMove = createTimer((moveInterval + variation) / 1000);
}

function calculateMoveInterval(behaviorType: AIBehavior, currentLevel: number, enemyType: EnemyType): number {
  const adjustedInterval = enemyMoveBaseIntervalForLevel(currentLevel);
  const multiplier = BEHAVIOR_MULTIPLIERS[behaviorType] * ENEMY_TYPE_MULTIPLIERS[enemyType];

  return Math.round(adjustedInterval * multiplier);
}

const randomEntry = <T>(entries: readonly T[]): T | undefined =>
  entries[Math.floor(Math.random() * entries.length)];

const cellIndex = ({ x, y }: GridCell): number => navGrid.cellFromXY(x, y);

const pathBlockedCells = (
  activeLilyPadCells: ReadonlySet<string>,
  occupiedCells: ReadonlySet<number>,
): Set<number> =>
  new Set([
    ...gridCells()
      .filter(cell => !isActiveLilyPadCell(cell, activeLilyPadCells))
      .map(cellIndex),
    ...occupiedCells,
  ]);

const adjacentLilyPadMoves = (
  currentGrid: GridCell,
  activeLilyPadCells: ReadonlySet<string>,
  blocked: ReadonlySet<number>,
): GridCell[] =>
  DIRECTIONS
    .map(({ x, y }) => ({ x: currentGrid.x + x, y: currentGrid.y + y }))
    .filter(({ x, y }) => x >= 0 && x < navGrid.width && y >= 0 && y < navGrid.height)
    .filter(cell => isActiveLilyPadCell(cell, activeLilyPadCells))
    .filter(cell => !blocked.has(cellIndex(cell)));

const nextLilyPadStepTowards = (
  ctx: AIContext,
  target: GridCell,
): GridCell =>
  nextStepTowards(
    ctx.startCell,
    navGrid.cellFromXY(target.x, target.y),
    pathBlockedCells(ctx.activeLilyPadCells, ctx.blocked),
  ) ?? processRandomAI(ctx);

function processChaseAI(ctx: AIContext): GridCell {
  const { player, currentGrid, activeLilyPadCells } = ctx;
  const playerGrid = pixelToGrid(player.components.position.x, player.components.position.y);
  const distance = Math.abs(currentGrid.x - playerGrid.x) + Math.abs(currentGrid.y - playerGrid.y);

  if (distance > AI_CONFIG.DETECTION_RANGE || !isActiveLilyPadCell(playerGrid, activeLilyPadCells)) {
    return processRandomAI(ctx);
  }

  return nextLilyPadStepTowards(ctx, playerGrid);
}

function processPatrolAI(ctx: AIContext): GridCell {
  const { enemy, currentGrid, activeLilyPadCells } = ctx;
  const enemyData = enemy.components.enemy;

  if (!enemyData.waypoints || enemyData.waypoints.length === 0) {
    enemyData.waypoints = generatePatrolWaypoints(currentGrid);
    enemyData.currentWaypoint = 0;
  }

  const waypoints = enemyData.waypoints;
  const waypointIndex = enemyData.currentWaypoint ?? 0;
  const target = waypoints[waypointIndex];

  if (currentGrid.x === target.x && currentGrid.y === target.y) {
    enemyData.currentWaypoint = (waypointIndex + 1) % waypoints.length;
    return currentGrid;
  }

  if (!isActiveLilyPadCell(target, activeLilyPadCells)) return processRandomAI(ctx);

  return nextLilyPadStepTowards(ctx, target);
}

function processRandomAI({ currentGrid, blocked, activeLilyPadCells }: AIContext): GridCell {
  return randomEntry(adjacentLilyPadMoves(currentGrid, activeLilyPadCells, blocked)) ?? currentGrid;
}

function processGuardAI(ctx: AIContext): GridCell {
  const { enemy, currentGrid, activeLilyPadCells } = ctx;
  const enemyData = enemy.components.enemy;

  if (!enemyData.guardPosition) {
    enemyData.guardPosition = { x: currentGrid.x, y: currentGrid.y };
  }
  const guardPos = enemyData.guardPosition;
  const distance = Math.abs(currentGrid.x - guardPos.x) + Math.abs(currentGrid.y - guardPos.y);

  if (distance > GUARD_RADIUS) {
    if (!isActiveLilyPadCell(guardPos, activeLilyPadCells)) return processRandomAI(ctx);

    return nextLilyPadStepTowards(ctx, guardPos);
  }

  if (Math.random() >= GUARD_MOVE_CHANCE) return currentGrid;

  const step = processRandomAI(ctx);
  const stepDistance = Math.abs(step.x - guardPos.x) + Math.abs(step.y - guardPos.y);
  return stepDistance <= GUARD_RADIUS ? step : currentGrid;
}

function generatePatrolWaypoints(startPos: { x: number; y: number }): Array<{ x: number; y: number }> {
  const size = 3;
  const maxX = GAME_CONFIG.GRID.WIDTH - 1;
  const maxY = GAME_CONFIG.GRID.HEIGHT - 1;
  return [
    { x: startPos.x, y: startPos.y },
    { x: Math.min(maxX, startPos.x + size), y: startPos.y },
    { x: Math.min(maxX, startPos.x + size), y: Math.min(maxY, startPos.y + size) },
    { x: startPos.x, y: Math.min(maxY, startPos.y + size) },
  ];
}
