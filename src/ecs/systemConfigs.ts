import { GAME_CONFIG } from '../config';
import type { EquationFeedbackKind } from './types';

/**
 * System Configuration Constants
 * Centralized configuration for all ECS systems
 */

// Problem Management System Configuration (unique values not in GAME_CONFIG)
export const PROBLEM_CONFIG = {
  TOTAL_PROBLEMS: 30,           // Total problems needed to fill entire 6x5 grid
} as const;

// AI System Configuration (unique values not in GAME_CONFIG)
export const AI_CONFIG = {
  BASE_MOVE_INTERVAL: 2_500,       // Base milliseconds between enemy moves (slowed down)
  MIN_MOVE_INTERVAL: 800,         // Minimum move interval (fastest)
  DETECTION_RANGE: 6,             // Grid cells within which AI detects player
  CHASE_SPEED_MULTIPLIER: 0.8,    // Chase moves slightly faster
  PATROL_SPEED_MULTIPLIER: 1.2,   // Patrol moves slower
  RANDOM_SPEED_MULTIPLIER: 1.0,   // Random normal speed
  GUARD_SPEED_MULTIPLIER: 1.5,    // Guard moves slowest
  
  // Enemy type-specific speed multipliers
  ENEMY_SPEED_MULTIPLIERS: {
    lizard: GAME_CONFIG.ENEMY_TYPES.lizard.MOVE_SPEED_MULTIPLIER,
    spider: GAME_CONFIG.ENEMY_TYPES.spider.MOVE_SPEED_MULTIPLIER,
    frog: GAME_CONFIG.ENEMY_TYPES.frog.MOVE_SPEED_MULTIPLIER,
  },
} as const;

export const ANSWER_CONSUMPTION_DURATION_MS = 720;
export const CORRECT_ANSWER_HOLD_DURATION_MS = 500;

export const EQUATION_FEEDBACK_DURATION_MS: Record<EquationFeedbackKind, number> = {
  correct: ANSWER_CONSUMPTION_DURATION_MS + CORRECT_ANSWER_HOLD_DURATION_MS,
  incorrect: 420,
} as const;

export const LEVEL_COMPLETE_DURATION_MS = 1_600;
export const ENEMY_SPAWN_TELEGRAPH_DURATION_MS = 650;
export const FROG_TONGUE_WINDUP_DURATION_MS = 450;
export const SPIDER_WEB_BUILD_DURATION_MS = 320;

// System Priorities (for consistent ordering)
export const SYSTEM_PRIORITIES = {
  INPUT_PROMPTS: 99,             // Reads ECSpresso input state after the input plugin
  TIMERS: 95,                   // Timer updates after input, before gameplay intent
  AI: 85,                       // AI behavior
  MOVEMENT: 80,                 // Movement processing
  ANIMATION: 75,                // Animation interpolation (after movement, before collision)
  COLLISION: 70,                // Collision detection
  EQUATION_FEEDBACK: 60,        // Delayed equation transitions after answer feedback
  GAMEPLAY_TIME: 55,            // Run timer after gameplay state updates, before HUD
  UI: 50,                       // UI updates
  ENEMY_SPAWN: 40,              // Enemy spawning
  PROBLEM_MANAGEMENT: 30,       // Problem lifecycle
  LEVEL_COMPLETE: 25,           // Advances after the level-complete overlay
  FROG_TONGUE: 22,              // Frog Tongue system (before render, after problem management)
  RENDER: 10,                   // Rendering (should be last)
} as const;
