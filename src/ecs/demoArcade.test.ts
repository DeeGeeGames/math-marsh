import * as audio from '../audio/audio';
import { expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from './Engine';
import { configureGameScreens } from './screenConfiguration';
import { createRunActions } from '../application/runActions';
import { createProfilePersistence } from '../profiles/persistence';
import { activePlayerProfile } from '../profiles/rules';
import { createDemoArcadeRun, completeDemoArcadeRound, isDemoArcadeComplete } from './demoArcade';
import { addLevelCompleteSystemToEngine } from './systems/LevelCompleteSystem';
import { goToNextLevel } from './systems/nextLevel';
import { skipGameplayOnboarding, startNormalGame } from '../onboarding/gameplayOnboardingFlow';
import type { SteamAppRole } from '../platform/desktop';
import { addMathProgressionSystemToEngine } from './systems/MathProgressionSystem';
import { equationModeForMathSession } from './mathMode';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY, serializedProfileStore } from '../profiles/codec';

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
  resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

// Match the actual screen schema without loading the renderer or singleton.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const fixture = async function(role: SteamAppRole) {
  const world = ECSpresso.create<TestConfig>().withScreens(configureGameScreens).build();
  const persistence = createProfilePersistence(() => undefined);
  const profiles = persistence.create(persistence.load(), 'Mira', 'mira').state;
  world.setResource('profilePersistence', persistence);
  world.setResource('playerProfiles', { ...profiles, profiles: profiles.profiles.map(profile => ({
    ...profile, onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
  })) });
  world.setResource('steamAppRole', role);
  world.setResource('demoArcadeRun', null);
  world.setResource('practiceSession', null);
  world.setResource('gameplayOnboardingSession', { active: false });
  world.setResource('mathDifficulty', 'easy');
  const runs = createRunActions(world, { playSound: () => {}, startNormalGame: () => startNormalGame(world) });
  addLevelCompleteSystemToEngine(world);
  await world.initialize();
  const clear = async function(level: number): Promise<void> {
    await world.setScreen('levelComplete', { completedLevel: level, nextLevel: level + 1, startedAt: -10000 });
    world.update(0);
    await Bun.sleep(0);
  };
  return { world, runs, clear };
};

test('demo limit counts five distinct completed ponds, independently of starting level', () => {
  let run = createDemoArcadeRun('demo');
  for (const level of [17, 18, 19, 20]) run = completeDemoArcadeRound(run, level);
  expect(isDemoArcadeComplete(run)).toBe(false);
  const previous = run;
  expect(completeDemoArcadeRound(run, 17)).toBe(previous);
  expect(completeDemoArcadeRound(run, Number.NaN)).toBe(previous);
  run = completeDemoArcadeRound(run, 21);
  expect(isDemoArcadeComplete(run)).toBe(true);
  expect(completeDemoArcadeRound(run, 22)).toBe(run);
  expect(createDemoArcadeRun('paid')).toBeNull();
  expect(createDemoArcadeRun(null)).toBeNull();
});

test('six demo runs can each finish five ponds; completion and tutorial routes refuse pond six', async () => {
  const { world, runs, clear } = await fixture('demo');
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      runs.startGame(['add'], 'easy', 17);
      await Bun.sleep(0);
      expect(world.getCurrentScreen()).toBe('playing');
      expect(world.getResource('demoArcadeRun')).toEqual({ completedLevels: [] });
      for (const level of [17, 18, 19, 20]) {
        await clear(level);
        expect(world.getCurrentScreen()).not.toBe('gameOver');
      }
      await clear(21);
      expect(world.getCurrentScreen()).toBe('gameOver');
      expect(world.getResource('demoArcadeRun')?.completedLevels).toEqual([17, 18, 19, 20, 21]);
      goToNextLevel(world, 22, 'easy', 'completed', 'completed');
      await Bun.sleep(0);
      expect(world.getCurrentScreen()).toBe('gameOver');
      // A late tutorial continuation must not restart the completed run either.
      startNormalGame(world);
      await Bun.sleep(0);
      expect(world.getCurrentScreen()).toBe('gameOver');
    }
    runs.replayGame();
    await Bun.sleep(0);
    expect(world.getCurrentScreen()).toBe('playing');
    expect(world.getResource('demoArcadeRun')).toEqual({ completedLevels: [] });
    expect(world.getResource('startingLevel')).toBe(1);
  } finally { await world.dispose(); }
});

test('paid and non-Steam runs continue beyond five ponds and have no demo run state', async () => {
  for (const role of ['paid', null] as const) {
    const { world, runs, clear } = await fixture(role);
    try {
      runs.startGame(['add'], 'easy', 17);
      for (const level of [17, 18, 19, 20, 21, 22]) await clear(level);
      expect(world.getCurrentScreen()).not.toBe('gameOver');
      expect(world.getResource('demoArcadeRun')).toBeNull();
    } finally { await world.dispose(); }
  }
});

test('cancelled tutorial offers and early losses leave unlimited replay; Practice remains unrestricted', async () => {
  const { world, runs } = await fixture('demo');
  const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
  try {
    const profiles = world.getResource('playerProfiles');
    world.setResource('playerProfiles', { ...profiles, profiles: profiles.profiles.map(profile => ({
      ...profile, onboarding: { ...profile.onboarding, basics: 'pending' },
    })) });
    runs.startGame(['multiply'], 'easy');
    await Bun.sleep(0);
    expect(world.getCurrentScreen()).toBe('tutorialOffer');
    await world.setScreen('menu', {});
    expect(world.getResource('demoArcadeRun')?.completedLevels).toHaveLength(0);
    runs.startGame(['multiply'], 'easy');
    await Bun.sleep(0);
    skipGameplayOnboarding(world);
    await Bun.sleep(0);
    expect(world.getCurrentScreen()).toBe('playing');
    expect(world.getResource('demoArcadeRun')?.completedLevels).toHaveLength(0);
    for (let i = 0; i < 6; i++) {
      await world.setScreen('gameOver', {});
      runs.replayGame();
      await Bun.sleep(0);
      expect(world.getCurrentScreen()).toBe('playing');
    }
    runs.startPractice({ topicId: 'multiply-table-12', pond: 'expert', related: true });
    await Bun.sleep(0);
    expect(world.getResource('practiceSession')?.selection.topicId).toBe('multiply-table-12');
    expect(world.getResource('demoArcadeRun')).toBeNull();
    expect(activePlayerProfile(world.getResource('playerProfiles'))?.practiceProgress.lastSelection?.topicId)
      .toBe('multiply-table-12');
  } finally { sound.mockRestore(); await world.dispose(); }
});

test('final demo pond keeps assessment progress temporary on a read-only paid profile', async () => {
  const { world, runs, clear } = await fixture('demo');
  try {
    const profiles = world.getResource('playerProfiles');
    const values = new Map([
      [PLAYER_PROFILES_KEY, serializedProfileStore(profiles.profiles)],
      [ACTIVE_PLAYER_PROFILE_KEY, 'mira'],
    ]);
    const original = [...values];
    let writes = 0;
    const persistence = createProfilePersistence(() => ({
      getItem: key => values.get(key) ?? null,
      setItem: () => { writes++; throw new Error('Paid save must not be written'); },
      getPersistenceMode: () => 'read-only',
    }));
    world.setResource('profilePersistence', persistence);
    world.setResource('playerProfiles', persistence.load());
    runs.startGame(['add'], 'easy', 17);
    await Bun.sleep(0);
    for (const level of [17, 18, 19, 20]) await clear(level);
    const session = world.getResource('mathSession');
    if (!session) throw new Error('Missing math session');
    world.setResource('mathSession', { tracks: { ...session.tracks, add: { ...session.tracks.add,
      assessment: { correctAnswers: 6, incorrectAnswers: 0, activeSeconds: 120, expectedSecondsTotal: 30 },
    } } });
    world.setResource('equationMode', equationModeForMathSession(session, ['add'], 21));
    world.setResource('mathRoundCompletedThisBoard', false);
    world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
    addMathProgressionSystemToEngine(world);
    world.update(0);
    expect(activePlayerProfile(world.getResource('playerProfiles'))?.mathProgress.add.currentStep).toBe(2);
    await clear(21);
    expect(world.getCurrentScreen()).toBe('gameOver');
    expect(activePlayerProfile(world.getResource('playerProfiles'))?.mathProgress.add.currentStep).toBe(2);
    expect(world.getResource('playerProfiles').persistence).toBe('read-only');
    expect(writes).toBe(0);
    expect([...values]).toEqual(original);
  } finally { await world.dispose(); }
});

test('pause, tutorials, and Practice ponds do not consume an Arcade round budget', async () => {
  const { world, runs, clear } = await fixture('demo');
  try {
    runs.startGame(['add'], 'easy');
    await Bun.sleep(0);
    await world.pushScreen('paused', {});
    world.update(0);
    await world.popScreen();
    await world.setScreen('tutorial', { kind: 'basics', isReplay: true, returnTo: { kind: 'newGame' } });
    world.update(0);
    expect(world.getResource('demoArcadeRun')?.completedLevels).toEqual([]);
    runs.startPractice({ topicId: 'multiply-table-12', related: false, pond: 'easy' });
    await Bun.sleep(0);
    for (const level of [1, 2, 3, 4, 5, 6]) await clear(level);
    expect(world.getCurrentScreen()).toBe('playing');
    expect(world.getResource('demoArcadeRun')).toBeNull();
    expect(world.getResource('practiceSession')?.selection.topicId).toBe('multiply-table-12');
  } finally { await world.dispose(); }
});
