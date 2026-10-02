import type { EnemyType } from '../types/shared';
import type { MathDifficulty } from './types';

export type EnemyRoster = Readonly<Partial<Record<EnemyType, number>>>;

export interface EnemyRosterConfig {
  readonly predefined: readonly EnemyRoster[];
  readonly random: {
    readonly minEnemies: number;
    readonly initialMaxEnemies: number;
    readonly maxEnemies: number;
    readonly levelsPerIncrease: number;
    readonly weights: Readonly<Record<EnemyType, number>>;
  };
}

// Each entry is one level's total roster, spawned one enemy at a time.
// After the last entry, the random upper count grows by one at the configured
// interval, up to maxEnemies. Weights control the relative chance of each type.
export const ENEMY_ROSTER_CONFIG = {
  easy: {
    predefined: [
      { lizard: 1 },
      { lizard: 2 },
      { spider: 1 },
      { lizard: 1, spider: 1 },
      { frog: 1 },
      { spider: 2 },
    ],
    random: {
      minEnemies: 1,
      initialMaxEnemies: 2,
      maxEnemies: 3,
      levelsPerIncrease: 4,
      weights: { lizard: 5, spider: 3, frog: 1 },
    },
  },
  medium: {
    predefined: [
      { lizard: 1 },
      { spider: 2 },
      { frog: 1 },
      { lizard: 2, spider: 1 },
      { spider: 3 },
      { lizard: 1, spider: 1, frog: 1 },
    ],
    random: {
      minEnemies: 2,
      initialMaxEnemies: 3,
      maxEnemies: 4,
      levelsPerIncrease: 3,
      weights: { lizard: 4, spider: 3, frog: 2 },
    },
  },
  expert: {
    predefined: [
      { lizard: 2 },
      { frog: 1 },
      { spider: 3 },
      { lizard: 2, frog: 1 },
      { lizard: 5 },
      { lizard: 1, spider: 2, frog: 1 },
    ],
    random: {
      minEnemies: 3,
      initialMaxEnemies: 4,
      maxEnemies: 5,
      levelsPerIncrease: 2,
      weights: { lizard: 3, spider: 3, frog: 2 },
    },
  },
} as const satisfies Readonly<Record<MathDifficulty, EnemyRosterConfig>>;

const ENEMY_TYPES = ['lizard', 'spider', 'frog'] as const;

function validateCount(value: number, path: string): void {
  if (Number.isSafeInteger(value) && value >= 0) return;
  throw new Error(`${path} must be a non-negative safe integer`);
}

export function validateEnemyRosterConfig(config: EnemyRosterConfig, difficulty: MathDifficulty): void {
  const prefix = `Enemy roster configuration (${difficulty})`;
  config.predefined.forEach((roster, index) => {
    ENEMY_TYPES.forEach(type => {
      validateCount(roster[type] ?? 0, `${prefix}.predefined[${index}].${type}`);
    });
  });

  const random = config.random;
  (['minEnemies', 'initialMaxEnemies', 'maxEnemies', 'levelsPerIncrease'] as const).forEach(key => {
    validateCount(random[key], `${prefix}.random.${key}`);
  });
  if (random.minEnemies > random.initialMaxEnemies || random.initialMaxEnemies > random.maxEnemies) {
    throw new Error(`${prefix}: minEnemies <= initialMaxEnemies <= maxEnemies is required`);
  }
  if (random.levelsPerIncrease === 0) {
    throw new Error(`${prefix}.random.levelsPerIncrease must be greater than zero`);
  }

  ENEMY_TYPES.forEach(type => {
    const weight = random.weights[type];
    if (Number.isFinite(weight) && weight >= 0) return;
    throw new Error(`${prefix}.random.weights.${type} must be finite and non-negative`);
  });
  const totalWeight = ENEMY_TYPES.reduce((total, type) => total + random.weights[type], 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error(`${prefix}.random.weights must have a finite, positive total`);
  }
}

// Validate all tracks at startup, including settings for later random levels.
(['easy', 'medium', 'expert'] as const).forEach(difficulty => {
  validateEnemyRosterConfig(ENEMY_ROSTER_CONFIG[difficulty], difficulty);
});

function expandRoster(roster: EnemyRoster): readonly EnemyType[] {
  return ENEMY_TYPES.flatMap(type => Array.from({ length: roster[type] ?? 0 }, () => type));
}

function weightedEnemy(weights: Readonly<Record<EnemyType, number>>, random: () => number): EnemyType {
  const totalWeight = ENEMY_TYPES.reduce((total, type) => total + weights[type], 0);
  const roll = random() * totalWeight;
  return ENEMY_TYPES.find((_, index) =>
    roll < ENEMY_TYPES.slice(0, index + 1).reduce((total, type) => total + weights[type], 0),
  ) ?? 'frog';
}

export function enemyRosterForLevel(
  level: number,
  difficulty: MathDifficulty,
  random: () => number = Math.random,
): readonly EnemyType[] {
  const config: EnemyRosterConfig = ENEMY_ROSTER_CONFIG[difficulty];
  const levelIndex = Math.max(1, Math.floor(level)) - 1;
  const predefined = config.predefined[levelIndex];
  if (predefined) return expandRoster(predefined);

  const randomLevelIndex = levelIndex - config.predefined.length;
  const maxCount = Math.min(
    config.random.maxEnemies,
    config.random.initialMaxEnemies + Math.floor(randomLevelIndex / config.random.levelsPerIncrease),
  );
  const count = config.random.minEnemies + Math.floor(
    random() * (maxCount - config.random.minEnemies + 1),
  );
  return Array.from({ length: count }, () => weightedEnemy(config.random.weights, random));
}
