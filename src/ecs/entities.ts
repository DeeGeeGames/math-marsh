import type { GameEngine } from './Engine';
import { GAME_CONFIG } from '../config';
import type { AIBehavior, EnemyType } from '../types/shared';
import type { AllComponents } from './types';
import { pixelToGrid } from './gameUtils';
import { defaultPlayerRenderable, defaultPlayerSprite } from './systems/PlayerSpriteSystem';
import { defaultFrogRenderable, defaultFrogSprite } from './systems/FrogSpriteSystem';
import { defaultEnemyRenderable, defaultEnemySprite } from './systems/EnemySpriteSystem';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { ENEMY_SPAWN_TELEGRAPH_DURATION_MS } from './systemConfigs';

const playerComponents = (x: number, y: number): Partial<AllComponents> => {
  const grid = pixelToGrid(x, y);
  return {
    position: { x, y, rotation: 0 },
    renderable: defaultPlayerRenderable(),
    playerSprite: defaultPlayerSprite(),
    player: {
      score: GAME_CONFIG.GAMEPLAY.STARTING_SCORE,
      lives: GAME_CONFIG.GAMEPLAY.PLAYER_LIVES,
      gameOverPending: false,
      deathScale: 1.0
    },
    collider: {
      width: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.PLAYER,
      height: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.PLAYER,
      group: 'player'
    },
    pathFollower: {
      anchorGridX: grid.x,
      anchorGridY: grid.y,
      breadcrumbs: [],
      speed: 0,
    }
  };
};

const enemyComponents = (
  x: number,
  y: number,
  enemyType: EnemyType,
  behaviorType: AIBehavior
): Partial<AllComponents> => {
  const size = GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.ENEMY;
  return {
    position: { x, y },
    renderable: enemyType === 'frog'
      ? defaultFrogRenderable(GAME_CONFIG.LAYERS.ENTITIES, GAME_CONFIG.ENEMY_TYPES.frog.COLOR, size)
      : defaultEnemyRenderable(
        enemyType,
        GAME_CONFIG.LAYERS.ENTITIES,
        GAME_CONFIG.ENEMY_TYPES[enemyType].COLOR,
        size,
      ),
    enemy: {
      enemyType,
      behaviorType
    },
    timers: {
      enemySpawnTelegraph: createTimer(ENEMY_SPAWN_TELEGRAPH_DURATION_MS / 1000),
    },
    collider: {
      width: size,
      height: size,
      group: 'enemy'
    },
    ...(enemyType === 'frog' ? { frogSprite: defaultFrogSprite() } : { enemySprite: defaultEnemySprite() }),
  };
};

const mathProblemComponents = (
  x: number,
  y: number,
  value: number,
  isCorrect: boolean | undefined,
  difficulty: number
): Partial<AllComponents> => ({
  position: { x, y },
  renderable: {
    shape: 'rectangle',
    color: GAME_CONFIG.COLORS.MATH_PROBLEM,
    size: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.MATH_PROBLEM,
    layer: GAME_CONFIG.LAYERS.MATH_PROBLEMS
  },
  mathProblem: {
    value,
    isCorrect,
    difficulty,
    consumed: false
  },
  collider: {
    width: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.MATH_PROBLEM,
    height: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.MATH_PROBLEM,
    group: 'problem'
  }
});

// Player is unscoped so it survives the screen-exit cleanup that runs on
// level transitions, preserving score and lives across levels.
export const createPlayer = (ecs: GameEngine, x: number, y: number): { id: number } =>
  ecs.spawn(playerComponents(x, y));

export const createEnemy = (
  commands: GameEngine['commands'],
  x: number,
  y: number,
  enemyType: EnemyType,
  behaviorType: AIBehavior,
): void => {
  commands.spawn(enemyComponents(x, y, enemyType, behaviorType));
};

export const createMathProblem = (
  commands: GameEngine['commands'],
  x: number,
  y: number,
  value: number,
  isCorrect: boolean | undefined,
  difficulty: number,
): void => {
  commands.spawn(mathProblemComponents(x, y, value, isCorrect, difficulty));
};
