import { GAME_CONFIG } from '../config';
import { AI_CONFIG } from './systemConfigs';

const SPAWN_INTERVAL_REDUCTION_PER_LEVEL_MS = 150;
const MOVE_INTERVAL_REDUCTION_PER_LEVEL_MS = 170;
const MOVE_INTERVAL_REDUCTION_START_LEVEL = 6;

const normalizedLevel = (level: number): number =>
  Math.max(1, Math.floor(level));

export const enemySpawnIntervalForLevel = (level: number): number =>
  Math.max(
    GAME_CONFIG.TIMING.MIN_SPAWN_INTERVAL,
    GAME_CONFIG.TIMING.BASE_SPAWN_INTERVAL -
      (normalizedLevel(level) - 1) * SPAWN_INTERVAL_REDUCTION_PER_LEVEL_MS,
  );

export const enemyMoveBaseIntervalForLevel = (level: number): number =>
  Math.max(
    AI_CONFIG.MIN_MOVE_INTERVAL,
    AI_CONFIG.BASE_MOVE_INTERVAL -
      Math.max(0, normalizedLevel(level) - MOVE_INTERVAL_REDUCTION_START_LEVEL + 1) *
        MOVE_INTERVAL_REDUCTION_PER_LEVEL_MS,
  );
