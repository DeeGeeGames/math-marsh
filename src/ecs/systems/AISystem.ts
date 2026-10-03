import type { GameEngine, GameSystemRegistrar } from '../Engine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { createNavGrid, findPath, type NavGrid } from 'ecspresso/plugins/ai/pathfinding';
import { pixelToGrid, gridToPixel } from '../gameUtils';
import { ANIMATION_CONFIG, GAME_CONFIG } from '../../config';
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
import { startFrogGridMovement, startFrogGridTurn } from './FrogSpriteSystem';
import { startEnemyGridMovement, startEnemyGridTurn } from './EnemySpriteSystem';
import { enemyMoveBaseIntervalForLevel } from '../enemyDifficulty';

const SPIDER_CONFIG = GAME_CONFIG.ENEMY_TYPES.spider;

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
const MOVE_DURATION_S = ANIMATION_CONFIG.MOVEMENT_DURATION / 1000;
// Leave enough time for a two-part turn (0.36s) in the second half of the pause.
const MIN_IDLE_DURATION_S = 0.8;

const cellOf = (entity: { components: { position: { x: number; y: number } } }, navGrid: NavGrid): number => {
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
  blocked: Set<number>,
  navGrid: NavGrid,
): GridCell | undefined {
  if (startCell === goalCell) return navGrid.cellToXY(startCell);
  const path = findPath(navGrid, startCell, goalCell, { blockedCells: blocked });
  if (!path || path.length < 2) return undefined;
  return navGrid.cellToXY(path[1]);
}

interface AIContext {
  navGrid: NavGrid;
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

export function addAISystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('aiSystem')
    .setPriority(SYSTEM_PRIORITIES.AI)
    .inPhase('preUpdate')
    .addQuery('enemies', { ...enemyQuery, optional: ['frogTongue'], mutates: ['enemy', 'timers'] } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .addSingleton('player', playerQuery)
    .withResources(['currentLevel', 'board'])
    .setProcess(({ queries, ecs, resources: { currentLevel, board } }) => {
      const navGrid = createNavGrid({ ...board, cellSize: GAME_CONFIG.GRID.CELL_SIZE });
      const { enemies, player } = queries;
      if (!player) return;

      const activeLilyPadCells = activeLilyPadCellKeys(queries.mathProblems);

      enemies.forEach(enemy => {
        if (enemy.components.timers.enemySpawnTelegraph?.active) return;
        if (isFrogAttacking(enemy.components.frogTongue)) {
          // An attack can start only before a movement plan is announced.
          // Resume with a full pause afterward so the next cue has time to read.
          delete enemy.components.timers.enemyMove;
          return;
        }
        if (isEntityAnimating(ecs, enemy.id) || ecs.hasComponent(enemy.id, 'spriteAnimation')) return;

        // Reserve announced destinations until landing, including plans made
        // by earlier enemies this frame. An enemy never blocks its own plan.
        const blocked = new Set(enemies
          .filter(other => other.id !== enemy.id)
          .flatMap(other => {
            const plannedMove = other.components.enemy.plannedMove;
            return [
              cellOf(other, navGrid),
              ...(plannedMove ? [navGrid.cellFromXY(plannedMove.x, plannedMove.y)] : []),
            ];
          }));
        processEnemyAI(ecs, enemy, player, blocked, activeLilyPadCells, currentLevel, navGrid);
      });
    });
}

function processEnemyAI(
  ecs: GameEngine,
  enemy: EnemyEntity,
  player: PlayerEntity,
  blocked: Set<number>,
  activeLilyPadCells: ReadonlySet<string>,
  currentLevel: number,
  navGrid: NavGrid,
): void {
  const enemyPos = enemy.components.position;
  const enemyData = enemy.components.enemy;
  const timers = enemy.components.timers;

  const currentGrid = pixelToGrid(enemyPos.x, enemyPos.y);
  const startCell = navGrid.cellFromXY(currentGrid.x, currentGrid.y);
  const moveTimer = timers.enemyMove;

  if (!moveTimer) {
    delete enemyData.plannedMove;
    const moveInterval = calculateMoveInterval(enemyData.behaviorType, currentLevel, enemyData.enemyType);
    const variation = (Math.random() - 0.5) * moveInterval * 0.2;
    // The interval previously included the move itself; start the idle timer
    // after landing, retaining that cadence unless it leaves no useful warning.
    timers.enemyMove = createTimer(Math.max(
      MIN_IDLE_DURATION_S,
      (moveInterval + variation) / 1000 - MOVE_DURATION_S,
    ));
    return;
  }

  if (moveTimer.elapsed < moveTimer.duration / 2) return;

  if (!enemyData.plannedMove) {
    const nextGrid = AI_PROCESSORS[enemyData.behaviorType]({
      enemy, player, currentGrid, startCell, blocked, activeLilyPadCells, navGrid,
    });
    enemyData.plannedMove = nextGrid;
    if (nextGrid.x === currentGrid.x && nextGrid.y === currentGrid.y) return;

    if (enemyData.enemyType === 'frog') {
      startFrogGridTurn(ecs, enemy.id, currentGrid, nextGrid);
      return;
    }
    startEnemyGridTurn(ecs, enemy.id, enemyData.enemyType, currentGrid, nextGrid);
    return;
  }

  if (moveTimer.active) return;

  const { x: nextGridX, y: nextGridY } = enemyData.plannedMove;
  delete timers.enemyMove;

  // A vanished pad or new occupant cancels the move, never redirects it after
  // the warning. The next idle cycle will announce a fresh decision.
  if (!isActiveLilyPadCell(enemyData.plannedMove, activeLilyPadCells) ||
      blocked.has(navGrid.cellFromXY(nextGridX, nextGridY))) {
    delete enemyData.plannedMove;
    return;
  }

  const newPixelPos = gridToPixel(nextGridX, nextGridY);
  const moved = newPixelPos.x !== enemyPos.x || newPixelPos.y !== enemyPos.y;

  if (moved) {
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
    if (startCell !== cellOf(player, navGrid)) {
      createSpiderWeb(ecs, currentGrid.x, currentGrid.y);
    }
  }
}

function calculateMoveInterval(behaviorType: AIBehavior, currentLevel: number, enemyType: EnemyType): number {
  const adjustedInterval = enemyMoveBaseIntervalForLevel(currentLevel);
  const multiplier = BEHAVIOR_MULTIPLIERS[behaviorType] * ENEMY_TYPE_MULTIPLIERS[enemyType];

  return Math.round(adjustedInterval * multiplier);
}

const randomEntry = <T>(entries: readonly T[]): T | undefined =>
  entries[Math.floor(Math.random() * entries.length)];

const cellIndex = ({ x, y }: GridCell, navGrid: NavGrid): number => navGrid.cellFromXY(x, y);

const pathBlockedCells = (
  activeLilyPadCells: ReadonlySet<string>,
  occupiedCells: ReadonlySet<number>,
  navGrid: NavGrid,
): Set<number> =>
  new Set([
    ...gridCells(navGrid)
      .filter(cell => !isActiveLilyPadCell(cell, activeLilyPadCells))
      .map(cell => cellIndex(cell, navGrid)),
    ...occupiedCells,
  ]);

const adjacentLilyPadMoves = (
  currentGrid: GridCell,
  activeLilyPadCells: ReadonlySet<string>,
  blocked: ReadonlySet<number>,
  navGrid: NavGrid,
): GridCell[] =>
  DIRECTIONS
    .map(({ x, y }) => ({ x: currentGrid.x + x, y: currentGrid.y + y }))
    .filter(({ x, y }) => x >= 0 && x < navGrid.width && y >= 0 && y < navGrid.height)
    .filter(cell => isActiveLilyPadCell(cell, activeLilyPadCells))
    .filter(cell => !blocked.has(cellIndex(cell, navGrid)));

const nextLilyPadStepTowards = (
  ctx: AIContext,
  target: GridCell,
): GridCell =>
  nextStepTowards(
    ctx.startCell,
    ctx.navGrid.cellFromXY(target.x, target.y),
    pathBlockedCells(ctx.activeLilyPadCells, ctx.blocked, ctx.navGrid),
    ctx.navGrid,
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
    enemyData.waypoints = generatePatrolWaypoints(currentGrid, ctx.navGrid);
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

function processRandomAI({ currentGrid, blocked, activeLilyPadCells, navGrid }: AIContext): GridCell {
  return randomEntry(adjacentLilyPadMoves(currentGrid, activeLilyPadCells, blocked, navGrid)) ?? currentGrid;
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

function generatePatrolWaypoints(startPos: { x: number; y: number }, navGrid: NavGrid): Array<{ x: number; y: number }> {
  const size = 3;
  const maxX = navGrid.width - 1;
  const maxY = navGrid.height - 1;
  return [
    { x: startPos.x, y: startPos.y },
    { x: Math.min(maxX, startPos.x + size), y: startPos.y },
    { x: Math.min(maxX, startPos.x + size), y: Math.min(maxY, startPos.y + size) },
    { x: startPos.x, y: Math.min(maxY, startPos.y + size) },
  ];
}
