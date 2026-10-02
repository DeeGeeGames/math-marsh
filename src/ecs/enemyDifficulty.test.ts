import { describe, expect, test } from 'bun:test';
import {
  enemyMoveBaseIntervalForLevel,
  enemySpawnIntervalForLevel,
} from './enemyDifficulty';
import { GAME_CONFIG } from '../config';
import { AI_CONFIG } from './systemConfigs';

describe('enemy difficulty', () => {
  test('reduces spawn gaps by level without going below the configured minimum', () => {
    expect(enemySpawnIntervalForLevel(1)).toBe(GAME_CONFIG.TIMING.BASE_SPAWN_INTERVAL);
    expect(enemySpawnIntervalForLevel(2)).toBeLessThan(enemySpawnIntervalForLevel(1));
    expect(enemySpawnIntervalForLevel(20)).toBe(GAME_CONFIG.TIMING.MIN_SPAWN_INTERVAL);
  });

  test('reduces enemy idle time starting at level six', () => {
    expect(enemyMoveBaseIntervalForLevel(5)).toBe(AI_CONFIG.BASE_MOVE_INTERVAL);
    expect(enemyMoveBaseIntervalForLevel(6)).toBeLessThan(enemyMoveBaseIntervalForLevel(5));
    expect(enemyMoveBaseIntervalForLevel(30)).toBe(AI_CONFIG.MIN_MOVE_INTERVAL);
  });
});
