import { createTweenSequence } from 'ecspresso/plugins/scripting/tween';
import { gameEngine, type GameEngine } from '../Engine';
import type { AllComponents } from '../types';
import { ANIMATION_CONFIG } from '../../config';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import {
  frogHopAway,
  frogHopSide,
  frogHopToward,
  frogMouthOpenAway,
  frogMouthOpenSide,
  frogMouthOpenToward,
  frogTurnFrontSide,
  frogTurnSideAway,
} from '../assets';

type FrogFacing = AllComponents['frogSprite']['facing'];
type SpriteStep = AllComponents['spriteAnimation']['steps'][number];
type GridPoint = { x: number; y: number };
type SpriteStepOptions = Pick<SpriteStep, 'flipX' | 'reverse' | 'staticFrameIndex'> & {
  frameCount?: number;
};

const FRAME_COUNT = 8;
const MOUTH_OPEN_FRAME_COUNT = 4;
const TURN_DURATION_S = 0.18;
const JUMP_INTENT_DELAY_S = 1;
const MOUTH_OPEN_DURATION_S = 0.16;
const MOUTH_CLOSE_IDLE_SETTLE_S = 0.01;
const MOVE_DURATION_S = ANIMATION_CONFIG.MOVEMENT_DURATION / 1000;

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

export const defaultFrogRenderable = (
  layer: number,
  color: string,
  size: number,
): AllComponents['renderable'] => ({
  shape: 'image',
  color,
  size,
  layer,
  imageSrc: frogHopToward,
  spriteSheet: {
    frameCount: FRAME_COUNT,
    frameIndex: FRAME_COUNT - 1,
  },
});

export const defaultFrogSprite = (): AllComponents['frogSprite'] => ({
  facing: 'toward',
});

const facingFromDelta = (dx: number, dy: number): FrogFacing => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'away' : 'toward';
};

const isSide = (facing: FrogFacing): boolean => facing === 'left' || facing === 'right';
const sideFlip = (facing: FrogFacing): boolean => facing === 'left';
const randomSideTurnBridge = (): FrogFacing => Math.random() < 0.5 ? 'toward' : 'away';
const randomDepthTurnBridge = (): FrogFacing => Math.random() < 0.5 ? 'left' : 'right';

const spriteStep = (
  imageSrc: string,
  duration: number,
  { frameCount = FRAME_COUNT, ...options }: SpriteStepOptions = {},
): SpriteStep => ({
  imageSrc,
  frameCount,
  duration,
  ...options,
});

const hopStepForFacing = (facing: FrogFacing, duration: number): SpriteStep => {
  if (facing === 'toward') {
    return spriteStep(frogHopToward, duration);
  }
  if (facing === 'away') {
    return spriteStep(frogHopAway, duration);
  }
  return spriteStep(frogHopSide, duration, { flipX: sideFlip(facing) });
};

const mouthOpenStepForFacing = (facing: FrogFacing, duration: number): SpriteStep => {
  if (facing === 'toward') {
    return spriteStep(frogMouthOpenToward, duration, { frameCount: MOUTH_OPEN_FRAME_COUNT });
  }
  if (facing === 'away') {
    return spriteStep(frogMouthOpenAway, duration, { frameCount: MOUTH_OPEN_FRAME_COUNT });
  }
  return spriteStep(frogMouthOpenSide, duration, {
    flipX: sideFlip(facing),
    frameCount: MOUTH_OPEN_FRAME_COUNT,
  });
};

function turnThrough(from: FrogFacing, bridge: FrogFacing, to: FrogFacing): SpriteStep[] {
  return [
    ...turnBetween(from, bridge),
    ...turnBetween(bridge, to),
  ];
}

const turnBetween = (from: FrogFacing, to: FrogFacing): SpriteStep[] => {
  if (from === to) return [];

  if (from === 'toward' && isSide(to)) {
    return [spriteStep(frogTurnFrontSide, TURN_DURATION_S, { flipX: sideFlip(to) })];
  }
  if (isSide(from) && to === 'toward') {
    return [spriteStep(frogTurnFrontSide, TURN_DURATION_S, {
      flipX: sideFlip(from),
      reverse: true,
    })];
  }
  if (from === 'away' && isSide(to)) {
    return [spriteStep(frogTurnSideAway, TURN_DURATION_S, {
      flipX: sideFlip(to),
      reverse: true,
    })];
  }
  if (isSide(from) && to === 'away') {
    return [spriteStep(frogTurnSideAway, TURN_DURATION_S, { flipX: sideFlip(from) })];
  }
  if (isSide(from) && isSide(to)) {
    return turnThrough(from, randomSideTurnBridge(), to);
  }

  return turnThrough(from, randomDepthTurnBridge(), to);
};

const finalFrameIndexForStep = (step: SpriteStep): number =>
  step.staticFrameIndex ?? (step.reverse ? 0 : step.frameCount - 1);

const initialFrameIndexForStep = (step: SpriteStep): number =>
  step.reverse ? step.frameCount - 1 : 0;

const intentDelayStepForFacing = (
  facing: FrogFacing,
  turnSteps: readonly SpriteStep[],
): SpriteStep => {
  const finalTurnStep = turnSteps.at(-1);
  if (finalTurnStep) {
    return spriteStep(finalTurnStep.imageSrc, JUMP_INTENT_DELAY_S, {
      flipX: finalTurnStep.flipX,
      staticFrameIndex: finalFrameIndexForStep(finalTurnStep),
    });
  }

  const facingStep = hopStepForFacing(facing, JUMP_INTENT_DELAY_S);
  return {
    ...facingStep,
    staticFrameIndex: facingStep.frameCount - 1,
  };
};

const applySpriteStep = (
  renderable: AllComponents['renderable'],
  step: SpriteStep,
  frameIndex: number,
): void => {
  renderable.imageSrc = step.imageSrc;
  renderable.spriteSheet = {
    frameCount: step.frameCount,
    frameIndex,
    flipX: step.flipX,
  };
};

const applySpriteStepToEntity = (
  ecs: GameEngine,
  entityId: number,
  step: SpriteStep,
  frameIndex: number,
): void => {
  ecs.mutateComponent(entityId, 'renderable', renderable => {
    applySpriteStep(renderable, step, frameIndex);
  });
};

const getFrogSpriteAnimationTarget = (
  ecs: GameEngine,
  entityId: number,
): AllComponents['frogSprite'] | undefined => {
  if (!ecs.hasComponent(entityId, 'renderable')) return undefined;
  return ecs.getComponent(entityId, 'frogSprite');
};

const setFrogFacing = (
  ecs: GameEngine,
  entityId: number,
  facing: FrogFacing,
): void => {
  ecs.mutateComponent(entityId, 'frogSprite', sprite => {
    sprite.facing = facing;
  });
};

const totalStepDuration = (steps: readonly SpriteStep[]): number =>
  steps.reduce((sum, step) => sum + step.duration, 0);

const lastStep = (steps: readonly SpriteStep[]): SpriteStep => steps[steps.length - 1];

const findCurrentStep = (
  steps: readonly SpriteStep[],
  elapsed: number,
): { step: SpriteStep; stepIndex: number; elapsedBeforeStep: number } => {
  let elapsedBeforeStep = 0;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    if (elapsed < elapsedBeforeStep + step.duration) {
      return { step, stepIndex, elapsedBeforeStep };
    }
    elapsedBeforeStep += step.duration;
  }

  return {
    step: lastStep(steps),
    stepIndex: steps.length - 1,
    elapsedBeforeStep: totalStepDuration(steps) - lastStep(steps).duration,
  };
};

const frameIndexForStep = (
  step: SpriteStep,
  elapsed: number,
  elapsedBeforeStep: number,
): number => {
  if (step.staticFrameIndex !== undefined) {
    return Math.max(0, Math.min(step.frameCount - 1, step.staticFrameIndex));
  }

  const stepElapsed = Math.max(0, elapsed - elapsedBeforeStep);
  const progress = Math.min(1, stepElapsed / step.duration);
  const forwardFrame = Math.min(
    step.frameCount - 1,
    Math.floor(progress * step.frameCount),
  );

  return step.reverse ? step.frameCount - 1 - forwardFrame : forwardFrame;
};

const startSpriteAnimation = (
  ecs: GameEngine,
  entityId: number,
  steps: SpriteStep[],
): number => {
  const firstStep = steps[0];
  if (!firstStep) return 0;

  const duration = totalStepDuration(steps);
  applySpriteStepToEntity(ecs, entityId, firstStep, initialFrameIndexForStep(firstStep));
  ecs.commands.addComponent(entityId, 'spriteAnimation', {
    elapsed: 0,
    duration,
    currentStep: 0,
    steps,
  });
  return duration;
};

export const startFrogGridMovement = (
  ecs: GameEngine,
  entityId: number,
  fromGrid: GridPoint,
  toGrid: GridPoint,
  toX: number,
  toY: number,
): void => {
  const position = ecs.getComponent(entityId, 'position');
  const frogSprite = getFrogSpriteAnimationTarget(ecs, entityId);
  if (!position || !frogSprite) return;

  const targetFacing = facingFromDelta(toGrid.x - fromGrid.x, toGrid.y - fromGrid.y);
  const turnSteps = turnBetween(frogSprite.facing, targetFacing);
  const hopDuration = Math.max(0.2, MOVE_DURATION_S - totalStepDuration(turnSteps));
  const steps = [
    ...turnSteps,
    intentDelayStepForFacing(targetFacing, turnSteps),
    hopStepForFacing(targetFacing, hopDuration),
  ];

  setFrogFacing(ecs, entityId, targetFacing);
  startSpriteAnimation(ecs, entityId, steps);

  const targets = [
    { component: 'position' as const, field: 'x' as const, to: position.x },
    { component: 'position' as const, field: 'y' as const, to: position.y },
  ];

  ecs.commands.addComponent(entityId, 'tween', createTweenSequence([
    ...turnSteps.map(step => ({ targets, duration: step.duration, easing: easeOutQuad })),
    { targets, duration: JUMP_INTENT_DELAY_S, easing: easeOutQuad },
    {
      targets: [
        { component: 'position' as const, field: 'x' as const, to: toX },
        { component: 'position' as const, field: 'y' as const, to: toY },
      ],
      duration: hopDuration,
      easing: easeOutQuad,
    },
  ]).tween);
};

export const startFrogTongueAnimation = (
  ecs: GameEngine,
  entityId: number,
  direction: GridPoint,
): void => {
  const frogSprite = getFrogSpriteAnimationTarget(ecs, entityId);
  if (!frogSprite) return;
  if (direction.x === 0 && direction.y === 0) return;

  const targetFacing = facingFromDelta(direction.x, direction.y);
  const openingStep = mouthOpenStepForFacing(targetFacing, MOUTH_OPEN_DURATION_S);

  setFrogFacing(ecs, entityId, targetFacing);
  startSpriteAnimation(ecs, entityId, [openingStep]);
};

export const closeFrogMouth = (
  ecs: GameEngine,
  entityId: number,
): number => {
  const frogSprite = getFrogSpriteAnimationTarget(ecs, entityId);
  if (!frogSprite) return 0;

  const closeStep = {
    ...mouthOpenStepForFacing(frogSprite.facing, MOUTH_OPEN_DURATION_S),
    reverse: true,
  };
  const idleStep = {
    ...hopStepForFacing(frogSprite.facing, MOUTH_CLOSE_IDLE_SETTLE_S),
    staticFrameIndex: FRAME_COUNT - 1,
  };
  const steps = [closeStep, idleStep];

  return startSpriteAnimation(ecs, entityId, steps);
};

export function addFrogSpriteAnimationSystemToEngine(): void {
  gameEngine.addSystem('frogSpriteAnimationSystem')
    .setPriority(SYSTEM_PRIORITIES.ANIMATION)
    .inScreens(['playing', 'tutorial'])
    .setProcessEach(
      { with: ['renderable', 'spriteAnimation'], mutates: ['renderable', 'spriteAnimation'] } as const,
      ({ entity, dt, ecs }) => {
        const animation = entity.components.spriteAnimation;
        animation.elapsed += dt;
        const { step: currentStep, stepIndex, elapsedBeforeStep } = findCurrentStep(
          animation.steps,
          animation.elapsed,
        );

        animation.currentStep = stepIndex;

        applySpriteStep(
          entity.components.renderable,
          currentStep,
          frameIndexForStep(currentStep, animation.elapsed, elapsedBeforeStep),
        );

        if (animation.elapsed >= animation.duration) {
          const finalStep = lastStep(animation.steps);
          applySpriteStep(
            entity.components.renderable,
            finalStep,
            finalFrameIndexForStep(finalStep),
          );
          ecs.commands.removeComponent(entity.id, 'spriteAnimation');
        }
      },
    );
}
