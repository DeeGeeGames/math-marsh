import { describe, expect, spyOn, test } from 'bun:test';
import * as audio from '../audio/audio';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import type { GameEngine } from './Engine';
import type { TimerSlot, TutorialScreenConfig } from './types';
import type { SkitScreenConfig } from './skitSequence';
import { mathProblemComponents, playerComponents } from './entities';
import { handleEquationProblemSelection } from './equationSelection';
import { mathProblemWithRenderableQuery, playerCollisionQuery } from './queries';
import { frameDeltaSeconds } from './frameTime';
import { gameplayClockPlugin, gameplayTimeMs } from './gameplayClock';
import { registerGameplayClockLifecycle } from './gameplayClockLifecycle';
import { createEquationModeState } from '../math/equations';
import { addGameplayTimeSystemToEngine } from './systems/GameplayTimeSystem';
import { queueTimeAdjustment } from './timeAdjustments';

// withScreens recreates the built-in screen resource from these definitions.
type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
  resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

const createWorld = async function() {
  const world = ECSpresso.create<TestConfig>()
    .withPlugin(createTimerPlugin<TimerSlot>())
    .withPlugin(gameplayClockPlugin)
    .withScreens(screens => screens
      .add('playing', { initialState: (config: { level: number; isFreshGame: boolean }) => config })
      .add('levelComplete', { initialState: (config: { completedLevel: number; nextLevel: number; startedAt: number }) => ({ ...config, transitionStarted: false }) })
      .add('skit', { initialState: (config: SkitScreenConfig) => ({ ...config, elapsed: 0, transitionStarted: false }) })
      .add('tutorial', { initialState: (config: TutorialScreenConfig) => ({ ...config }) })
      .add('menu', { initialState: () => ({}) })
      .add('gameOver', { initialState: () => ({}) }))
    .build();
  world.setResource('equationMode', createEquationModeState(1, 'easy', ['add']));
  world.setResource('remainingTimeSeconds', 20);
  addGameplayTimeSystemToEngine(world.systemScope({ inScreens: ['playing'] }));
  registerGameplayClockLifecycle(world);
  await world.initialize();
  await world.setScreen('playing', { level: 1, isFreshGame: true });
  const player = world.spawn({ ...playerComponents(150, 150), timers: {} }, { scope: null });
  return { world, player };
};

const queueFromPlaying = function(world: GameEngine, seconds: number): void {
  let queued = false;
  // Exercise the producer's actual screen scope, as collision/answer systems do.
  world.addSystem('test-adjustment')
    .inScreens(['playing'])
    .setProcess(({ ecs }) => {
      if (queued) return;
      queued = true;
      queueTimeAdjustment(ecs, { x: 150, y: 150 }, seconds, gameplayTimeMs(ecs.getResource('gameplayClock')));
    });
  world.update(0);
};

describe('run-owned time adjustments', () => {
  test('a correct level-three answer queues its scaled reward and keeps it through a level change', async () => {
    const { world } = await createWorld();
    const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
    try {
      const equationMode = {
        ...createEquationModeState(3, 'medium', ['add']),
        promptKind: 'selectResult' as const,
        operandsRequired: 1,
        target: 3,
        promptValues: [1, 2],
      };
      world.setResource('equationMode', equationMode);
      world.setResource('equationsSolved', 0);
      world.spawn(mathProblemComponents(150, 150, 3, 1));
      let selected = false;
      world.addSystem('test-equation-selection')
        .addSingleton('player', playerCollisionQuery)
        .addSingleton('problem', mathProblemWithRenderableQuery)
        .setProcess(({ ecs, queries: { player, problem } }) => {
          if (selected || !player || !problem) return;
          selected = true;
          handleEquationProblemSelection(ecs, player, problem, [problem], {
            equationMode,
            gameMode: ['add'],
            mathDifficulty: 'medium',
          });
        });
      world.update(0);
      expect(world.getSingleton(['timeAdjustment']).components.timeAdjustment.seconds).toBe(14);
      expect(world.getResource('remainingTimeSeconds')).toBe(20);
      expect(world.getResource('equationsSolved')).toBe(1);
      await world.setScreen('playing', { level: 4, isFreshGame: false });
      world.setResource('equationMode', createEquationModeState(4, 'medium', ['add']));
      world.update(0.8);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(33.2);
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(0);
    } finally {
      sound.mockRestore();
      world.dispose();
    }
  });

  test('a long visible frame cannot drain the bank or trigger death', async () => {
    const { world, player } = await createWorld();
    try {
      world.update(frameDeltaSeconds(91000, 1000, false));
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(19.9);
      expect(player.components.player?.gameOverPending).toBe(false);
      expect(gameplayTimeMs(world.getResource('gameplayClock'))).toBeCloseTo(100);
    } finally { world.dispose(); }
  });

  test('a pending penalty pauses during celebration and applies exactly once after a level change', async () => {
    const { world, player } = await createWorld();
    try {
      queueFromPlaying(world, -15);
      world.update(0.2);
      await world.pushScreen('levelComplete', { completedLevel: 1, nextLevel: 2, startedAt: 0 });
      world.update(5);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(19.8);
      expect(gameplayTimeMs(world.getResource('gameplayClock'))).toBeCloseTo(200);
      await world.setScreen('playing', { level: 2, isFreshGame: false });
      world.setResource('equationMode', createEquationModeState(2, 'easy', ['add']));
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(1);
      expect(world.getParent(world.getSingleton(['timeAdjustment']).id)).toBe(player.id);
      world.update(0.6);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(4.2);
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(0);
      world.update(0.1);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(4.1);
    } finally { world.dispose(); }
  });

  test('an in-flight bonus protects an empty bank after level feedback is reset', async () => {
    const { world, player } = await createWorld();
    try {
      queueFromPlaying(world, 10);
      await world.setScreen('playing', { level: 2, isFreshGame: false });
      world.setResource('equationMode', createEquationModeState(2, 'easy', ['add']));
      world.setResource('remainingTimeSeconds', 0.1);
      world.update(0.2);
      expect(world.getResource('remainingTimeSeconds')).toBe(0);
      expect(player.components.player?.gameOverPending).toBe(false);
      world.update(0.6);
      expect(world.getResource('remainingTimeSeconds')).toBe(10);
      expect(player.components.player?.gameOverPending).toBe(false);
    } finally { world.dispose(); }
  });

  test('a pending penalty survives a skit and level tutorial and settles on gameplay return', async () => {
    const { world } = await createWorld();
    try {
      queueFromPlaying(world, -15);
      world.update(0.2);
      await world.pushScreen('levelComplete', { completedLevel: 1, nextLevel: 2, startedAt: 0 });
      await world.setScreen('skit', { nextLevel: 2 });
      world.update(5);
      expect(gameplayTimeMs(world.getResource('gameplayClock'))).toBeCloseTo(200);
      await world.setScreen('tutorial', { kind: 'operands', isReplay: false, returnTo: { kind: 'level', level: 2 } });
      world.update(2);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(19.8);
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(1);
      await world.setScreen('playing', { level: 2, isFreshGame: false });
      world.setResource('equationMode', createEquationModeState(2, 'easy', ['add']));
      world.update(0);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(4.8);
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(0);
      world.update(0.1);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(4.7);
    } finally { world.dispose(); }
  });

  test('replacing the player clears pending adjustments before a new run', async () => {
    const { world, player } = await createWorld();
    try {
      queueFromPlaying(world, -15);
      await world.setScreen('menu', {});
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(1);
      world.removeEntity(player.id);
      world.spawn({ ...playerComponents(150, 150), timers: {} }, { scope: null });
      world.setResource('remainingTimeSeconds', 90);
      await world.setScreen('playing', { level: 1, isFreshGame: true });
      world.update(0.8);
      expect(world.getEntitiesWithQuery(['timeAdjustment'])).toHaveLength(0);
      expect(world.getResource('remainingTimeSeconds')).toBeCloseTo(89.2);
    } finally { world.dispose(); }
  });
});
