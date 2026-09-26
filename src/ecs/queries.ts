import { type QueryResultEntity } from 'ecspresso';
import type { AllComponents } from './types';

/**
 * Centralized Query Definitions
 * Reusable query definitions used across multiple systems
 */

// Common entity queries
export const playerQuery = {
  with: ['position', 'player', 'pathFollower', 'timers'],
} as const;

export const playerMovementQuery = {
  with: ['position', 'player', 'pathFollower', 'timers'],
  mutates: ['position', 'pathFollower'],
} as const;

export const playerCollisionQuery = {
  with: ['position', 'player', 'pathFollower', 'collider', 'timers'],
} as const;

export const mathProblemQuery = {
  with: ['position', 'mathProblem'],
  optional: ['answerConsumption'],
} as const;

export const timeAdjustmentQuery = {
  with: ['timeAdjustment'],
} as const;

export const mathProblemWithRenderableQuery = {
  with: ['position', 'mathProblem', 'collider', 'renderable'],
  optional: ['answerConsumption'],
} as const;

export const enemyQuery = {
  with: ['position', 'enemy', 'timers'],
} as const;

export const enemyWithColliderQuery = {
  with: ['position', 'enemy', 'collider', 'timers'],
} as const;

export const renderableEntityQuery = {
  with: ['position', 'renderable'],
} as const;

export const positionEntityQuery = {
  with: ['position'],
} as const;

export const spiderWebQuery = {
  with: ['position', 'spiderWeb', 'timers'],
} as const;

export const spiderWebWithRenderableQuery = {
  with: ['position', 'spiderWeb', 'renderable', 'collider', 'timers'],
} as const;

export const frogTongueQuery = {
  with: ['position', 'enemy', 'frogTongue', 'timers'],
} as const;

/**
 * Centralized Entity Types
 * Type-safe entity types derived from query definitions
 */

export type PlayerEntity = QueryResultEntity<AllComponents, typeof playerQuery>;
export type PlayerCollisionEntity = QueryResultEntity<AllComponents, typeof playerCollisionQuery>;
export type MathProblemEntity = QueryResultEntity<AllComponents, typeof mathProblemQuery>;
export type MathProblemEntityWithRenderable = QueryResultEntity<AllComponents, typeof mathProblemWithRenderableQuery>;
export type EnemyEntity = QueryResultEntity<AllComponents, typeof enemyQuery>;
export type EnemyEntityWithCollider = QueryResultEntity<AllComponents, typeof enemyWithColliderQuery>;
export type RenderableEntity = QueryResultEntity<AllComponents, typeof renderableEntityQuery>;
export type PositionEntity = QueryResultEntity<AllComponents, typeof positionEntityQuery>;

export type SpiderWebEntity = QueryResultEntity<AllComponents, typeof spiderWebQuery>;
export type SpiderWebEntityWithRenderable = QueryResultEntity<AllComponents, typeof spiderWebWithRenderableQuery>;
export type FrogTongueEntity = QueryResultEntity<AllComponents, typeof frogTongueQuery>;
