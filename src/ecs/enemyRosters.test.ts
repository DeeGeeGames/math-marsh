import { describe, expect, test } from 'bun:test';
import {
  ENEMY_ROSTER_CONFIG,
  enemyRosterForLevel,
  validateEnemyRosterConfig,
  type EnemyRosterConfig,
} from './enemyRosters';

describe('enemy rosters', () => {
  test('predefined levels support single types, duplicates, and mixed rosters independently', () => {
    expect(enemyRosterForLevel(3, 'easy')).toEqual(['spider']);
    expect(enemyRosterForLevel(3, 'medium')).toEqual(['frog']);
    expect(enemyRosterForLevel(3, 'expert')).toEqual(['spider', 'spider', 'spider']);
    expect(enemyRosterForLevel(5, 'expert')).toEqual(Array.from({ length: 5 }, () => 'lizard'));
    expect(enemyRosterForLevel(6, 'medium')).toEqual(['lizard', 'spider', 'frog']);
  });

  test('predefined rosters do not consume randomness and normalize level numbers', () => {
    function unexpectedRandom(): number {
      throw new Error('Predefined levels should not roll a random roster');
    }
    expect(enemyRosterForLevel(0, 'easy', unexpectedRandom)).toEqual(['lizard']);
    expect(enemyRosterForLevel(3.9, 'medium', unexpectedRandom)).toEqual(['frog']);
  });

  test('random generation begins immediately after each predefined track', () => {
    (['easy', 'medium', 'expert'] as const).forEach(difficulty => {
      const config = ENEMY_ROSTER_CONFIG[difficulty];
      const firstRandomLevel = config.predefined.length + 1;
      expect(enemyRosterForLevel(firstRandomLevel, difficulty, () => 0)).toHaveLength(config.random.minEnemies);
      expect(enemyRosterForLevel(firstRandomLevel, difficulty, () => 0.999)).toHaveLength(config.random.initialMaxEnemies);
    });
  });

  test('random count grows at the configured interval and stops at the track cap', () => {
    (['easy', 'medium', 'expert'] as const).forEach(difficulty => {
      const config = ENEMY_ROSTER_CONFIG[difficulty];
      const firstRandomLevel = config.predefined.length + 1;
      const firstIncrease = firstRandomLevel + config.random.levelsPerIncrease;
      expect(enemyRosterForLevel(firstIncrease - 1, difficulty, () => 0.999)).toHaveLength(config.random.initialMaxEnemies);
      expect(enemyRosterForLevel(firstIncrease, difficulty, () => 0.999)).toHaveLength(config.random.initialMaxEnemies + 1);
      expect(enemyRosterForLevel(1000, difficulty, () => 0.999)).toHaveLength(config.random.maxEnemies);
    });
  });

  test('random enemy selection follows the configured weights and permits repeated types', () => {
    const level = ENEMY_ROSTER_CONFIG.medium.predefined.length + 1;
    expect(enemyRosterForLevel(level, 'medium', () => 0)).toEqual(['lizard', 'lizard']);
    expect(enemyRosterForLevel(level, 'medium', () => 0.5)).toEqual(['spider', 'spider', 'spider']);
    expect(enemyRosterForLevel(level, 'medium', () => 0.999)).toEqual(['frog', 'frog', 'frog']);
  });
});

describe('enemy roster configuration validation', () => {
  const config: EnemyRosterConfig = ENEMY_ROSTER_CONFIG.easy;

  test('accepts zero counts, an empty predefined track, and disabled enemy types', () => {
    expect(() => validateEnemyRosterConfig({
      predefined: [],
      random: {
        ...config.random,
        minEnemies: 0,
        weights: { lizard: 0.5, spider: 0, frog: 0 },
      },
    }, 'easy')).not.toThrow();
    expect(() => validateEnemyRosterConfig({
      ...config,
      predefined: [{ lizard: 0 }],
    }, 'easy')).not.toThrow();
  });

  test('rejects invalid predefined counts with the track, level entry, and enemy type', () => {
    [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].forEach(count => {
      expect(() => validateEnemyRosterConfig({
        ...config,
        predefined: [{ spider: count }],
      }, 'medium')).toThrow('Enemy roster configuration (medium).predefined[0].spider');
    });
  });

  test('rejects invalid random counts and growth intervals', () => {
    (['minEnemies', 'initialMaxEnemies', 'maxEnemies', 'levelsPerIncrease'] as const).forEach(key => {
      [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].forEach(value => {
        expect(() => validateEnemyRosterConfig({
          ...config,
          random: { ...config.random, [key]: value },
        }, 'easy')).toThrow(`random.${key} must be a non-negative safe integer`);
      });
    });
    expect(() => validateEnemyRosterConfig({
      ...config,
      random: { ...config.random, levelsPerIncrease: 0 },
    }, 'easy')).toThrow('levelsPerIncrease must be greater than zero');
  });

  test('rejects inverted count ranges', () => {
    [{ minEnemies: 3 }, { initialMaxEnemies: 4 }, { maxEnemies: 1 }].forEach(overrides => {
      expect(() => validateEnemyRosterConfig({
        ...config,
        random: { ...config.random, ...overrides },
      }, 'expert')).toThrow('minEnemies <= initialMaxEnemies <= maxEnemies is required');
    });
  });

  test('rejects negative, non-finite, all-zero, and overflowing weights', () => {
    (['lizard', 'spider', 'frog'] as const).forEach(type => {
      [-1, NaN, Infinity].forEach(weight => {
        expect(() => validateEnemyRosterConfig({
          ...config,
          random: { ...config.random, weights: { ...config.random.weights, [type]: weight } },
        }, 'easy')).toThrow(`random.weights.${type} must be finite and non-negative`);
      });
    });
    [
      { lizard: 0, spider: 0, frog: 0 },
      { lizard: Number.MAX_VALUE, spider: Number.MAX_VALUE, frog: 0 },
    ].forEach(weights => {
      expect(() => validateEnemyRosterConfig({
        ...config,
        random: { ...config.random, weights },
      }, 'easy')).toThrow('weights must have a finite, positive total');
    });
  });
});
