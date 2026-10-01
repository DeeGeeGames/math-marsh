import { describe, expect, test } from 'bun:test';
import ECSpresso from 'ecspresso';
import { createCoroutine, createCoroutinePlugin, waitSeconds, waitUntil, type CoroutineGenerator } from 'ecspresso/plugins/scripting/coroutine';
import { createTweenSequence, createTweenPlugin, type TweenComponentTypes } from 'ecspresso/plugins/scripting/tween';
import { SYSTEM_PRIORITIES } from './systemConfigs';

// Exercise the phase boundary: AI queues a tween, which is not visible to
// other preUpdate systems until the command buffer is flushed.
interface SchedulingFixture {
  world: {
    update(dt: number): void;
    dispose(): void;
    hasComponent(id: number, component: 'tween'): boolean;
  };
  frog: {
    id: number;
    components: {
      position: { x: number };
      attack: { phase: 'idle' | 'extending' | 'retracting'; ready: boolean };
    };
  };
}

const createSchedulingFixture = async function (): Promise<SchedulingFixture> {
  const world = ECSpresso.create()
    .withPlugin(createCoroutinePlugin({ priority: SYSTEM_PRIORITIES.FROG_TONGUE, phase: 'preUpdate' }))
    .withPlugin(createTweenPlugin({ priority: SYSTEM_PRIORITIES.ANIMATION }))
    .withComponentTypes<{
      position: { x: number };
      attack: { phase: 'idle' | 'extending' | 'retracting'; ready: boolean };
    }>()
    .build();

  const movementTween = function (): TweenComponentTypes['tween'] {
    return createTweenSequence([{
      targets: [{ component: 'position', field: 'x', to: 100 }],
      duration: 1,
    }]).tween;
  };

  world.addSystem('movement-intent')
    .inPhase('preUpdate')
    .setPriority(SYSTEM_PRIORITIES.AI)
    .setProcessEach({ with: ['position', 'attack'] }, ({ entity, ecs }) => {
      if (ecs.hasComponent(entity.id, 'tween')) return;
      if (entity.components.attack.phase !== 'idle') return;
      ecs.commands.addComponent(entity.id, 'tween', movementTween());
    });

  await world.initialize();
  const frog = world.spawn({ position: { x: 0 }, attack: { phase: 'idle', ready: false } });
  const lifecycle = function* (): CoroutineGenerator {
    yield* waitUntil(() => frog.components.attack.ready && !world.hasComponent(frog.id, 'tween'));
    frog.components.attack.phase = 'extending';
    yield* waitSeconds(0.5);
    frog.components.attack.phase = 'retracting';
    yield* waitSeconds(0.5);
    frog.components.attack.phase = 'idle';
  };
  world.addComponent(frog.id, 'coroutine', createCoroutine(lifecycle()).coroutine);
  return { world, frog };
};

describe('frog attack scheduling', () => {
  test('an attack becoming ready prevents movement through retraction', async () => {
    const { world, frog } = await createSchedulingFixture();
    frog.components.attack.ready = true;
    world.update(0.1);
    expect(frog.components.attack.phase).toBe('extending');
    expect(world.hasComponent(frog.id, 'tween')).toBe(false);

    Array.from({ length: 6 }).forEach(() => world.update(0.1));
    expect(frog.components.attack.phase).toBe('retracting');
    expect(frog.components.position.x).toBe(0);
    expect(world.hasComponent(frog.id, 'tween')).toBe(false);

    Array.from({ length: 6 }).forEach(() => world.update(0.1));
    expect(frog.components.attack.phase).toBe('idle');
    expect(frog.components.position.x).toBeGreaterThan(0);
    world.dispose();
  });

  test('an attack waits for an existing hop to finish', async () => {
    const { world, frog } = await createSchedulingFixture();
    world.update(0.1);
    frog.components.attack.ready = true;
    world.update(0.1);
    expect(frog.components.attack.phase).toBe('idle');
    expect(frog.components.position.x).toBeGreaterThan(0);

    Array.from({ length: 11 }).forEach(() => world.update(0.1));
    expect(frog.components.attack.phase).toBe('extending');
    expect(frog.components.position.x).toBe(100);
    expect(world.hasComponent(frog.id, 'tween')).toBe(false);
    world.dispose();
  });
});
