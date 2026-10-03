import { createTweenSequence } from 'ecspresso/plugins/scripting/tween';
import { ANIMATION_CONFIG } from '../../config';
import type { EnemyType } from '../../types/shared';
import { type GameEngine } from '../Engine';
import type { AllComponents } from '../types';
import {
  lizardWalkAway,
  lizardWalkSide,
  lizardWalkToward,
  lizardTurnSideAway,
  lizardTurnTowardSide,
  spiderWalkAway,
  spiderWalkSide,
  spiderWalkToward,
  spiderTurnSideAway,
  spiderTurnTowardSide,
} from '../assets';

type Facing = AllComponents['enemySprite']['facing'];
type SpriteStep = AllComponents['spriteAnimation']['steps'][number];
type SpriteEnemyType = Exclude<EnemyType, 'frog'>;
type GridPoint = { x: number; y: number };
type PositionTarget = { component: 'position'; field: 'x' | 'y'; to: number };
type SpriteStepOptions = Pick<SpriteStep, 'flipX' | 'reverse'>;
type SpriteSheets = {
  walkAway: string;
  walkSide: string;
  walkToward: string;
  turnSideAway: string;
  turnTowardSide: string;
};

const FRAME_COUNT = 8;
const TURN_DURATION_S = 0.18;
const MOVE_DURATION_S = ANIMATION_CONFIG.MOVEMENT_DURATION / 1000;

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

const SPRITE_SHEETS: Record<SpriteEnemyType, SpriteSheets> = {
  lizard: {
    walkAway: lizardWalkAway,
    walkSide: lizardWalkSide,
    walkToward: lizardWalkToward,
    turnSideAway: lizardTurnSideAway,
    turnTowardSide: lizardTurnTowardSide,
  },
  spider: {
    walkAway: spiderWalkAway,
    walkSide: spiderWalkSide,
    walkToward: spiderWalkToward,
    turnSideAway: spiderTurnSideAway,
    turnTowardSide: spiderTurnTowardSide,
  },
} as const;

export const ENEMY_SPRITE_IMAGES = Object.values(SPRITE_SHEETS)
  .flatMap(({
    walkAway,
    walkSide,
    walkToward,
    turnSideAway,
    turnTowardSide,
  }) => [
    walkAway,
    walkSide,
    walkToward,
    turnSideAway,
    turnTowardSide,
  ]);

export const defaultEnemyRenderable = (
  enemyType: SpriteEnemyType,
  layer: number,
  color: string,
  size: number,
): AllComponents['renderable'] => ({
  shape: 'image',
  color,
  size,
  layer,
  imageSrc: SPRITE_SHEETS[enemyType].walkToward,
  spriteSheet: {
    frameCount: FRAME_COUNT,
    frameIndex: FRAME_COUNT - 1,
  },
});

export const defaultEnemySprite = (): AllComponents['enemySprite'] => ({
  facing: 'toward',
});

const facingFromDelta = (dx: number, dy: number): Facing => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'away' : 'toward';
};

const isSide = (facing: Facing): boolean => facing === 'left' || facing === 'right';
const sideFlip = (facing: Facing): boolean => facing === 'left';
const randomSideTurnBridge = (): Facing => Math.random() < 0.5 ? 'toward' : 'away';
const randomDepthTurnBridge = (): Facing => Math.random() < 0.5 ? 'left' : 'right';

const spriteStep = (
  imageSrc: string,
  duration: number,
  options: SpriteStepOptions = {},
): SpriteStep => ({
  imageSrc,
  frameCount: FRAME_COUNT,
  duration,
  ...options,
});

const walkStepForFacing = (
  enemyType: SpriteEnemyType,
  facing: Facing,
  duration: number,
): SpriteStep => {
  const sheets = SPRITE_SHEETS[enemyType];
  if (facing === 'toward') return spriteStep(sheets.walkToward, duration);
  if (facing === 'away') return spriteStep(sheets.walkAway, duration);
  return spriteStep(sheets.walkSide, duration, { flipX: sideFlip(facing) });
};

function turnThrough(
  enemyType: SpriteEnemyType,
  from: Facing,
  bridge: Facing,
  to: Facing,
): SpriteStep[] {
  return [
    ...turnBetween(enemyType, from, bridge),
    ...turnBetween(enemyType, bridge, to),
  ];
}

const turnBetween = (
  enemyType: SpriteEnemyType,
  from: Facing,
  to: Facing,
): SpriteStep[] => {
  if (from === to) return [];

  const sheets = SPRITE_SHEETS[enemyType];

  if (from === 'toward' && isSide(to)) {
    return [spriteStep(sheets.turnTowardSide, TURN_DURATION_S, { flipX: sideFlip(to) })];
  }
  if (isSide(from) && to === 'toward') {
    return [spriteStep(sheets.turnTowardSide, TURN_DURATION_S, {
      flipX: sideFlip(from),
      reverse: true,
    })];
  }
  if (from === 'away' && isSide(to)) {
    return [spriteStep(sheets.turnSideAway, TURN_DURATION_S, {
      flipX: sideFlip(to),
      reverse: true,
    })];
  }
  if (isSide(from) && to === 'away') {
    return [spriteStep(sheets.turnSideAway, TURN_DURATION_S, { flipX: sideFlip(from) })];
  }
  if (isSide(from) && isSide(to)) {
    return turnThrough(enemyType, from, randomSideTurnBridge(), to);
  }

  return turnThrough(enemyType, from, randomDepthTurnBridge(), to);
};

const totalStepDuration = (steps: readonly SpriteStep[]): number =>
  steps.reduce((sum, step) => sum + step.duration, 0);

const positionTarget = (field: 'x' | 'y', to: number): PositionTarget => ({
  component: 'position',
  field,
  to,
});

const setEnemyFacing = (
  ecs: GameEngine,
  entityId: number,
  facing: Facing,
): void => {
  ecs.mutateComponent(entityId, 'enemySprite', sprite => {
    sprite.facing = facing;
  });
};

const startSpriteAnimation = (
  ecs: GameEngine,
  entityId: number,
  steps: SpriteStep[],
): void => {
  const firstStep = steps[0];
  if (!firstStep) return;

  ecs.mutateComponent(entityId, 'renderable', renderable => {
    renderable.imageSrc = firstStep.imageSrc;
    renderable.spriteSheet = {
      frameCount: firstStep.frameCount,
      frameIndex: firstStep.reverse ? firstStep.frameCount - 1 : 0,
      flipX: firstStep.flipX,
    };
  });
  ecs.commands.addComponent(entityId, 'spriteAnimation', {
    elapsed: 0,
    duration: totalStepDuration(steps),
    currentStep: 0,
    steps,
  });
};

export const startEnemyGridMovement = (
  ecs: GameEngine,
  entityId: number,
  enemyType: SpriteEnemyType,
  fromGrid: GridPoint,
  toGrid: GridPoint,
  toX: number,
  toY: number,
): void => {
  const position = ecs.getComponent(entityId, 'position');
  const enemySprite = ecs.getComponent(entityId, 'enemySprite');
  if (!position || !enemySprite) return;

  const targetFacing = facingFromDelta(toGrid.x - fromGrid.x, toGrid.y - fromGrid.y);
  const turnSteps = turnBetween(enemyType, enemySprite.facing, targetFacing);
  const walkDuration = Math.max(0.2, MOVE_DURATION_S - totalStepDuration(turnSteps));
  const steps = [
    ...turnSteps,
    walkStepForFacing(enemyType, targetFacing, walkDuration),
  ];
  const stationaryTargets = [
    positionTarget('x', position.x),
    positionTarget('y', position.y),
  ];

  setEnemyFacing(ecs, entityId, targetFacing);
  startSpriteAnimation(ecs, entityId, steps);
  ecs.commands.addComponent(entityId, 'tween', createTweenSequence([
    ...turnSteps.map(step => ({ targets: stationaryTargets, duration: step.duration, easing: easeOutQuad })),
    {
      targets: [
        positionTarget('x', toX),
        positionTarget('y', toY),
      ],
      duration: walkDuration,
      easing: easeOutQuad,
    },
  ]).tween);
};

export function startEnemyGridTurn(
  ecs: GameEngine,
  entityId: number,
  enemyType: SpriteEnemyType,
  fromGrid: GridPoint,
  toGrid: GridPoint,
): void {
  const enemySprite = ecs.getComponent(entityId, 'enemySprite');
  if (!enemySprite) return;

  const targetFacing = facingFromDelta(toGrid.x - fromGrid.x, toGrid.y - fromGrid.y);
  const turnSteps = turnBetween(enemyType, enemySprite.facing, targetFacing);
  if (turnSteps.length === 0) return;

  const idleStep = walkStepForFacing(enemyType, targetFacing, 0.01);
  setEnemyFacing(ecs, entityId, targetFacing);
  startSpriteAnimation(ecs, entityId, [
    ...turnSteps,
    { ...idleStep, staticFrameIndex: FRAME_COUNT - 1 },
  ]);
}
