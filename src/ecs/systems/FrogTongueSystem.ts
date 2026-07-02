import { gameEngine, type GameEngine } from '../Engine';
import { GAME_CONFIG } from '../../config';
import { pixelToGrid } from '../gameUtils';
import {
  createCoroutine,
  waitSeconds,
  waitUntil,
  type CoroutineGenerator,
} from 'ecspresso/plugins/scripting/coroutine';
import type { AllComponents } from '../types';
import { isEntityAnimating } from './AnimationSystem';
import { closeFrogMouth, startFrogTongueAnimation } from './FrogSpriteSystem';
import { FROG_TONGUE_WINDUP_DURATION_MS } from '../systemConfigs';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { playSound } from '../../audio/audio';

const FROG_CONFIG = GAME_CONFIG.ENEMY_TYPES.frog;
const CELL = GAME_CONFIG.GRID.CELL_SIZE;

const DIRECTIONS = [
  { x:  0, y: -1 },
  { x:  0, y:  1 },
  { x: -1, y:  0 },
  { x:  1, y:  0 },
] as const;

const COOLDOWN_SECONDS = FROG_CONFIG.TONGUE_COOLDOWN / 1000;
const HOLD_SECONDS = FROG_CONFIG.TONGUE_HOLD_DURATION / 1000;
const ATTACK_DELAY_MIN_SECONDS = FROG_CONFIG.TONGUE_ATTACK_DELAY_MIN / 1000;
const ATTACK_DELAY_MAX_SECONDS = FROG_CONFIG.TONGUE_ATTACK_DELAY_MAX / 1000;

const randomAttackDelaySeconds = (): number =>
  ATTACK_DELAY_MIN_SECONDS + Math.random() * (ATTACK_DELAY_MAX_SECONDS - ATTACK_DELAY_MIN_SECONDS);

// `initializeFrogTongue` guarantees the frogTongue component is attached
// alongside the coroutine, so a missing component would indicate a logic bug.
function getTongue(ecs: GameEngine, entityId: number): AllComponents['frogTongue'] {
  const c = ecs.getComponent(entityId, 'frogTongue');
  if (!c) throw new Error(`frog ${entityId} missing frogTongue component`);
  return c;
}

function getTimers(ecs: GameEngine, entityId: number): AllComponents['timers'] {
  const timers = ecs.getComponent(entityId, 'timers');
  if (!timers) throw new Error(`frog ${entityId} missing timers component`);
  return timers;
}

const markTongueChanged = (ecs: GameEngine, frogId: number): void => {
  ecs.markChanged(frogId, 'frogTongue');
};

function* tongueLifecycle(ecs: GameEngine, frogId: number): CoroutineGenerator {
  while (true) {
    const tongue = getTongue(ecs, frogId);
    tongue.phase = 'idle';
    tongue.segments = [];
    tongue.currentLength = 0;
    tongue.direction = { x: 0, y: 0 };
    markTongueChanged(ecs, frogId);

    yield* waitSeconds(COOLDOWN_SECONDS);
    yield* waitSeconds(randomAttackDelaySeconds());
    yield* waitUntil(() => !isEntityAnimating(ecs, frogId));

    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const timers = getTimers(ecs, frogId);
    tongue.direction = direction;
    tongue.phase = 'windingUp';
    timers.frogTongueWindup = createTimer(
      FROG_TONGUE_WINDUP_DURATION_MS / 1000,
    );
    startFrogTongueAnimation(ecs, frogId, direction);
    markTongueChanged(ecs, frogId);
    yield* waitUntil(() => timers.frogTongueWindup?.active !== true);

    tongue.phase = 'extending';
    markTongueChanged(ecs, frogId);
    playSound('frogTongue');
    console.log(`🐸 Frog ${frogId} starting tongue attack in direction (${tongue.direction.x}, ${tongue.direction.y})`);

    const maxLength = tongue.maxRange * CELL;
    while (tongue.currentLength < maxLength) {
      const dt: number = yield;
      tongue.currentLength = Math.min(tongue.currentLength + FROG_CONFIG.TONGUE_SPEED * dt, maxLength);
      updateTongueSegments(ecs, frogId, tongue);
      // Segments stopped growing despite remaining range — hit obstacle.
      const expectedSegments = Math.floor(tongue.currentLength / CELL);
      if (tongue.segments.length < expectedSegments && tongue.segments.length < tongue.maxRange) break;
    }

    tongue.phase = 'holding';
    markTongueChanged(ecs, frogId);
    yield* waitSeconds(HOLD_SECONDS);

    tongue.phase = 'retracting';
    markTongueChanged(ecs, frogId);
    while (tongue.currentLength > 0) {
      const dt: number = yield;
      tongue.currentLength = Math.max(0, tongue.currentLength - FROG_CONFIG.TONGUE_SPEED * dt);
      updateTongueSegments(ecs, frogId, tongue);
    }
    yield* waitSeconds(closeFrogMouth(ecs, frogId));
  }
}

function updateTongueSegments(
  ecs: GameEngine,
  frogId: number,
  tongue: AllComponents['frogTongue'],
): void {
  const frogPos = ecs.getComponent(frogId, 'position');
  if (!frogPos) throw new Error(`frog ${frogId} missing position component`);

  tongue.segments = [];

  if (tongue.direction.x === 0 && tongue.direction.y === 0) {
    markTongueChanged(ecs, frogId);
    return;
  }

  const tongueGridLength = Math.floor(tongue.currentLength / CELL);
  if (tongueGridLength <= 0) {
    markTongueChanged(ecs, frogId);
    return;
  }

  const frogGrid = pixelToGrid(frogPos.x, frogPos.y);
  const blockedCells = collectEnemyBlockedCells(ecs, frogId);

  for (let i = 1; i <= tongueGridLength; i++) {
    const gx = frogGrid.x + tongue.direction.x * i;
    const gy = frogGrid.y + tongue.direction.y * i;

    if (gx < 0 || gx >= GAME_CONFIG.GRID.WIDTH || gy < 0 || gy >= GAME_CONFIG.GRID.HEIGHT) {
      console.log(`🐸 Tongue hit grid boundary at (${gx}, ${gy}), stopping extension`);
      break;
    }

    if (blockedCells.has(`${gx},${gy}`)) {
      console.log(`🐸 Tongue hit obstacle at grid (${gx}, ${gy}), stopping extension`);
      break;
    }

    tongue.segments.push({ x: gx, y: gy });
  }

  markTongueChanged(ecs, frogId);
}

function collectEnemyBlockedCells(ecs: GameEngine, frogId: number): Set<string> {
  return new Set(
    ecs.getEntitiesWithQuery(['enemy', 'position'])
      .filter(enemy => enemy.id !== frogId)
      .map(enemy => {
        const grid = pixelToGrid(enemy.components.position.x, enemy.components.position.y);
        return `${grid.x},${grid.y}`;
      })
  );
}

function queueFrogTongueInit(ecs: GameEngine, frogId: number): void {
  ecs.commands.addComponents(frogId, {
    frogTongue: {
      direction: { x: 0, y: 0 },
      maxRange: FROG_CONFIG.TONGUE_RANGE,
      currentLength: 0,
      segments: [],
      phase: 'idle',
    },
    coroutine: createCoroutine(tongueLifecycle(ecs, frogId)).coroutine,
  });

  console.log(`🐸 Initialized frog tongue for entity ${frogId}`);
}

/** True while the frog is mid-tongue (any non-idle phase). */
export const isFrogAttacking = (tongue: AllComponents['frogTongue'] | undefined): boolean =>
  tongue !== undefined && tongue.phase !== 'idle';

/**
 * Register a reactive query that wires up the tongue coroutine for any
 * frog-type enemy as soon as it spawns.
 */
export function registerFrogTongueInit(): void {
  gameEngine.addReactiveQuery('frog-init', {
    with: ['enemy'],
    onEnter: ({ entity, ecs }) => {
      if (entity.components.enemy.enemyType !== 'frog') return;
      queueFrogTongueInit(ecs, entity.id);
    },
  });
}
