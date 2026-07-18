import { gameEngine, type GameEngine } from '../Engine';
import { createTweenSequence, type TweenSequenceStepInput } from 'ecspresso/plugins/scripting/tween';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { ANIMATION_CONFIG } from '../../config';

export { ANIMATION_CONFIG };

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

const MOVEMENT_DURATION_S = ANIMATION_CONFIG.MOVEMENT_DURATION / 1000;
const DEATH_DURATION_S = ANIMATION_CONFIG.DEATH.DURATION / 1000;

const queueTween = (
  ecs: GameEngine,
  entityId: number,
  steps: readonly TweenSequenceStepInput[],
): void => {
  ecs.commands.addComponent(entityId, 'tween', createTweenSequence(steps).tween);
};

// A tween component on an entity means it's currently animating movement or
// death. Shake is a separate component and does NOT block input.
export const isEntityAnimating = (ecs: GameEngine, entityId: number): boolean =>
  ecs.hasComponent(entityId, 'tween');

/**
 * Start a grid movement animation, optionally with a simultaneous rotation.
 * Position and rotation share one tween step so the easing curve stays
 * continuous (a split sequence introduces a velocity discontinuity at the
 * step boundary that reads as a stutter).
 */
export const startGridMovement = (
  ecs: GameEngine,
  entityId: number,
  toX: number,
  toY: number,
  toRotation?: number,
): void => {
  const targets = [
    { component: 'position' as const, field: 'x' as const, to: toX },
    { component: 'position' as const, field: 'y' as const, to: toY },
    ...(toRotation === undefined
      ? []
      : [{ component: 'position' as const, field: 'rotation' as const, to: toRotation }]),
  ];
  queueTween(ecs, entityId, [
    { targets, duration: MOVEMENT_DURATION_S, easing: easeOutQuad },
  ]);
};

/**
 * Start the death animation: shrink deathScale to 0 while spinning rotation
 * by `SPIN_ROTATIONS` full turns.
 */
export const startDeathAnimation = (
  ecs: GameEngine,
  entityId: number,
  currentRotation: number,
): void => {
  const spinTo = currentRotation + ANIMATION_CONFIG.DEATH.SPIN_ROTATIONS * 360;
  queueTween(ecs, entityId, [
    {
      targets: [
        { component: 'player', field: 'deathScale', to: ANIMATION_CONFIG.DEATH.SCALE_END },
        { component: 'position', field: 'rotation', to: spinTo },
      ],
      duration: DEATH_DURATION_S,
      easing: easeOutQuad,
    },
  ]);
};

/**
 * Start a shake effect with diminishing intensity. Shake is random per-frame
 * (not a tween), so it lives in its own component processed by shakeSystem.
 */
export const startShake = (
  ecs: GameEngine,
  entityId: number,
  intensity: number,
  durationMs: number,
): void => {
  ecs.commands.addComponent(entityId, 'shake', {
    intensity,
    duration: durationMs / 1000,
    elapsed: 0,
    offsetX: 0,
    offsetY: 0,
  });
};

export function addShakeSystemToEngine(): void {
  gameEngine.addSystem('shakeSystem')
    .setPriority(SYSTEM_PRIORITIES.ANIMATION)
    .inScreens(['playing', 'tutorial'])
    .setProcessEach({ with: ['shake'], mutates: ['shake'] } as const, ({ entity, dt, ecs }) => {
      const shake = entity.components.shake;
      shake.elapsed += dt;
      if (shake.elapsed >= shake.duration) {
        ecs.commands.removeComponent(entity.id, 'shake');
        return;
      }
      const remaining = shake.intensity * (1 - shake.elapsed / shake.duration);
      shake.offsetX = (Math.random() - 0.5) * remaining * 2;
      shake.offsetY = (Math.random() - 0.5) * remaining * 2;
    });
}
