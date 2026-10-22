import { createProfilePersistence } from '../profiles/persistence';
import { expect, test } from 'bun:test';
import ECSpresso from 'ecspresso';
import type { Components, Resources } from '../ecs/types';
import { configureGameScreens } from '../ecs/screenConfiguration';
import { createPlayerProfile, activePlayerProfile, loadPlayerProfiles } from '../ecs/playerProfiles';
import { finishPracticeSession, recordPracticeAttempt, currentPracticeFact } from '../ecs/practiceSession';
import { createRunActions } from './runActions';
import { createProfileActions } from './profileActions';
import { createNavigationActions } from './navigationActions';

// No Engine singleton, browser globals, screens, or audio adapters are imported.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const fixture = function() {
  const engine = ECSpresso.create().withComponentTypes<Components>().withResourceTypes<Resources>()
    .withScreens(configureGameScreens).build();
  const first = createPlayerProfile(loadPlayerProfiles({ getItem: () => null, setItem: () => {} }), 'Mira', 'mira');
  engine.setResource('profilePersistence', createProfilePersistence(() => undefined));
  engine.setResource('playerProfiles', first.state);
  engine.setResource('practiceSession', null);
  engine.setResource('mathSession', null);
  engine.setResource('mathRoundSummary', null);
  const sounds: string[] = [];
  let starts = 0;
  const runs = createRunActions(engine, { playSound: sound => sounds.push(sound), startNormalGame: () => { starts++; } });
  const profiles = createProfileActions(engine, { playSound: sound => sounds.push(sound), clearPlayerRun: runs.clearPlayerRun,
    focusRenamedProfile: () => {}, createId: () => 'jordan' });
  return { engine, runs, profiles, sounds, starts: (): number => starts };
};

test('Arcade setup preserves ordered resources, selected starting level, and pending tutorial offer', async () => {
  const { engine, runs, starts } = fixture();
  try {
    await engine.initialize();
    runs.startGame(['multiply'], 'medium', 17.9);
    expect(engine.getResource('startingLevel')).toBe(17);
    expect(engine.getResource('gameMode')).toEqual(['multiply']);
    expect(engine.getResource('mathDifficulty')).toBe('medium');
    expect(engine.getResource('mathSession')).not.toBeNull();
    expect(engine.getResource('practiceSession')).toBeNull();
    await Promise.resolve();
    expect(engine.getCurrentScreen()).toBe('tutorialOffer');
    expect(starts()).toBe(0);
    const previous = engine.getResource('mathSession');
    runs.replayGame();
    expect(engine.getResource('startingLevel')).toBe(1);
    expect(engine.getResource('mathSession')).not.toBe(previous);
  } finally { engine.dispose(); }
});

test('Practice repeated selection creates a fresh owned session, preserves evidence, and isolates profile switches', async () => {
  const { engine, runs, profiles } = fixture();
  try {
    await engine.initialize();
    const selection = { topicId: 'multiply-table-2', related: true, pond: 'expert' } as const;
    runs.startPractice(selection);
    const session = engine.getResource('practiceSession');
    if (!session) throw new Error('Practice did not start');
    expect(session.ownerId).toBe('mira');
    expect(engine.getResource('mathSession')).toBeNull();
    expect(engine.getResource('startingLevel')).toBe(1);
    expect(engine.getResource('mathDifficulty')).toBe('expert');
    const partial = finishPracticeSession(recordPracticeAttempt(session, currentPracticeFact(session).id, true));
    engine.setResource('practiceSession', partial);
    runs.startPractice(partial.selection);
    expect(engine.getResource('practiceSession')).toMatchObject({ ownerId: 'mira', solved: 0, outcome: 'active', attempts: [] });
    expect(activePlayerProfile(engine.getResource('playerProfiles'))?.practiceProgress.lastSelection).toEqual(selection);
    expect(profiles.createPlayer('Jordan')).toBeUndefined();
    expect(engine.getResource('practiceSession')).toBeNull();
    expect(engine.getResource('mathSession')).toBeNull();
    expect(engine.getResource('mathRoundCompletedThisBoard')).toBe(false);
    expect(activePlayerProfile(engine.getResource('playerProfiles'))?.practiceProgress.lastSelection).toBeNull();
    await engine.setScreen('playerRoster', {});
    profiles.switchPlayer('mira');
    expect(activePlayerProfile(engine.getResource('playerProfiles'))?.practiceProgress.lastSelection).toEqual(selection);
  } finally { engine.dispose(); }
});

test('navigation delegates tutorials, preserves Practice early exit, and keeps settings exclusions', async () => {
  const { engine, runs } = fixture();
  let finished = 0;
  const tutorials: string[] = [];
  const navigation = createNavigationActions(engine, {
    playSound: () => {}, finishPractice: () => { finished++; },
    startGameplayOnboarding: () => tutorials.push('start'), skipGameplayOnboarding: () => tutorials.push('skip'),
    nextGameplayOnboardingStep: () => tutorials.push('next'), previousGameplayOnboardingStep: () => tutorials.push('previous'),
  });
  try {
    await engine.initialize();
    runs.startPractice({ topicId: 'add-make-5', related: false, pond: 'easy' });
    navigation.goToMenu();
    expect(finished).toBe(1);
    expect(engine.getResource('practiceSession')?.outcome).toBe('active');
    await engine.setScreen('practice', {});
    navigation.openSettings();
    expect(engine.getCurrentScreen()).toBe('practice');
    await engine.setScreen('menu', {});
    navigation.openSettings();
    await Promise.resolve();
    expect(engine.getCurrentScreen()).toBe('settings');
    expect(engine.getScreenState('settings').returnTo).toBe('menu');
    navigation.startTutorial(); navigation.nextTutorialStep(); navigation.previousTutorialStep(); navigation.skipTutorial();
    expect(tutorials).toEqual(['start', 'next', 'previous', 'skip']);
  } finally { engine.dispose(); }
});

test('profile rename returns validation errors and restores focus after the overlay has popped', async () => {
  const { engine, runs } = fixture();
  const restored: { id: string; screen: string | null }[] = [];
  const profiles = createProfileActions(engine, {
    playSound: () => {}, clearPlayerRun: runs.clearPlayerRun,
    focusRenamedProfile: id => restored.push({ id, screen: engine.getCurrentScreen() }),
  });
  try {
    await engine.initialize();
    await engine.setScreen('playerManagement', {});
    await engine.pushScreen('playerRename', { profileId: 'mira' });
    expect(profiles.renamePlayer('mira', '')).toBeDefined();
    expect(engine.getCurrentScreen()).toBe('playerRename');
    expect(restored).toEqual([]);
    expect(profiles.renamePlayer('mira', 'Mira Two')).toBeUndefined();
    expect(restored).toEqual([]);
    await Bun.sleep(0);
    expect(restored).toEqual([{ id: 'mira', screen: 'playerManagement' }]);
    expect(activePlayerProfile(engine.getResource('playerProfiles'))?.name).toBe('Mira Two');
  } finally { engine.dispose(); }
});
