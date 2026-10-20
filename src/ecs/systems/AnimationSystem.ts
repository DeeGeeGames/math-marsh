import type { GameEngine, GameSystemRegistrar } from '../Engine';
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
  startSpinShrinkDeathAnimation(ecs, entityId, currentRotation, 'player');
};

export const startEnemyDeathAnimation = (
  ecs: GameEngine,
  entityId: number,
  currentRotation: number,
): void => {
  const position = ecs.getComponent(entityId, 'position');
  if (!position) return;

  const { BOUNCE_HEIGHT, BOUNCE_HALF_DURATION, FREEZE_DURATION } = ANIMATION_CONFIG.ENEMY_DEATH;
  startSpinShrinkDeathAnimation(ecs, entityId, currentRotation, 'enemyElimination', [
    {
      targets: [{ component: 'position', field: 'y', from: position.y, to: position.y - BOUNCE_HEIGHT }],
      duration: BOUNCE_HALF_DURATION / 1000,
      easing: easeOutQuad,
    },
    {
      targets: [
        { component: 'position', field: 'y', from: position.y - BOUNCE_HEIGHT, to: position.y },
        { component: 'enemyElimination', field: 'impact.landed', from: 0, to: 1 },
      ],
      duration: BOUNCE_HALF_DURATION / 1000,
      easing: function(t: number): number { return t * t; },
    },
    { targets: [], duration: FREEZE_DURATION / 1000 },
  ]);
};

const startSpinShrinkDeathAnimation = (
  ecs: GameEngine,
  entityId: number,
  currentRotation: number,
  scaleComponent: 'player' | 'enemyElimination',
  introSteps: readonly TweenSequenceStepInput[] = [],
): void => {
  ecs.mutateComponent(entityId, 'position', position => {
    if (position.rotation === undefined) position.rotation = currentRotation;
  });
  const spinTo = currentRotation + ANIMATION_CONFIG.DEATH.SPIN_ROTATIONS * 360;
  queueTween(ecs, entityId, [
    ...introSteps,
    {
      targets: [
        { component: scaleComponent, field: 'deathScale', to: ANIMATION_CONFIG.DEATH.SCALE_END },
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

export function addShakeSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('shakeSystem')
    .inGroup('gameplay')
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
