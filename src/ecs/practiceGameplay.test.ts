import { createProfilePersistence } from '../profiles/persistence';
import { goToNextLevel } from './systems/nextLevel';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import * as audio from '../audio/audio';
import type { GameEngine } from './Engine';
import { BOARD_SIZES } from './boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from './entities';
import { handleEquationProblemSelection } from './equationSelection';
import { gridToPixel } from './gameUtils';
import { activePlayerProfile, initialPlayerLearnerData, type PlayerProfilesState } from './playerProfiles';
import { currentPracticeFact, createPracticeSession, practiceEquationMode, type PracticeSession } from './practiceSession';
import { finishPractice, submitPracticeAttempt } from './practiceLifecycle';
import { submittedPracticeFact } from './practiceSession';
import type { MathProblemEntityWithRenderable } from './queries';
import { configureGameScreens } from './screenConfiguration';
import { addEquationFeedbackSystemToEngine } from './systems/EquationFeedbackSystem';
import { addProblemManagementSystemToEngine } from './systems/ProblemManagementSystem';
import { EQUATION_FEEDBACK_DURATION_MS } from './systemConfigs';
import { initialSavedMathProgress } from './mathProgressStore';

let restoreSound: (() => void) | undefined;
beforeEach(function(): void {
  const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
  restoreSound = function(): void { sound.mockRestore(); };
});
afterEach(function(): void { restoreSound?.(); });

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
  resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

const profiles = function(): PlayerProfilesState {
  return {
    profiles: ['owner', 'other'].map(id => ({ id, name: id, ...initialPlayerLearnerData() })),
    activeProfileId: 'owner', initialLearnerData: initialPlayerLearnerData(),
    persistence: 'session-only', canPersist: false,
  };
};

const problemsIn = function(world: GameEngine): MathProblemEntityWithRenderable[] {
  return world.getEntitiesWithQuery(['position', 'mathProblem', 'collider', 'renderable']).map(function(entity) {
    return { ...entity, components: { ...entity.components, answerConsumption: entity.components.answerConsumption } };
  });
};

const createWorld = async function(level = 1, manageBoard = false): Promise<GameEngine> {
  const world = ECSpresso.create<TestConfig>().withScreens(configureGameScreens).build();
  const initial = createPracticeSession('owner', { topicId: 'add-make-5', related: false, pond: 'expert' });
  if (!initial) throw new Error('Missing Practice session');
  const fact = initial.deck.find(candidate => candidate.left === 2 && candidate.right === 3);
  if (!fact) throw new Error('Missing test fact');
  const session: PracticeSession = { ...initial, deck: [fact, ...initial.deck.filter(candidate => candidate.id !== fact.id)] };
  world.setResource('practiceSession', session);
  world.setResource('profilePersistence', createProfilePersistence(() => undefined));
  world.setResource('playerProfiles', profiles());
  world.setResource('mathSession', null);
  world.setResource('equationsSolved', 0);
  world.setResource('equationsSolvedThisBoard', 0);
  world.setResource('currentLevel', level);
  world.setResource('gameMode', ['add']);
  world.setResource('mathDifficulty', 'expert');
  world.setResource('board', BOARD_SIZES.expert);
  world.setResource('enemySpawn', { index: 0, roster: [] });
  world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
  world.setResource('equationMode', { ...practiceEquationMode(session, level), target: 5 });
  addEquationFeedbackSystemToEngine(world);
  if (manageBoard) addProblemManagementSystemToEngine(world);
  await world.initialize();
  await world.setScreen('playing', { level, isFreshGame: true });
  world.spawn({ ...playerComponents(0, 0), timers: {} }, { scope: null });
  return world;
};

const select = function(world: GameEngine, problem: MathProblemEntityWithRenderable): void {
  handleEquationProblemSelection(world,
    world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']),
    problem, problemsIn(world), {
      equationMode: world.getResource('equationMode'), gameMode: ['add'], mathDifficulty: 'expert',
    });
};

const activeSession = function(world: GameEngine): PracticeSession {
  const session = world.getResource('practiceSession');
  if (!session) throw new Error('Missing session');
  return session;
};

describe('Practice gameplay boundaries', () => {
  test('Make board transitions skip unused two-pad tutorials while Arcade keeps them', async () => {
    const world = await createWorld();
    const transition = spyOn(world, 'setScreen').mockImplementation(async () => {});
    try {
      goToNextLevel(world, 2, 'expert', 'pending', 'pending');
      expect(transition).toHaveBeenLastCalledWith('playing', { level: 2, isFreshGame: false });
      world.setResource('practiceSession', null);
      goToNextLevel(world, 2, 'expert', 'pending', 'pending');
      expect(transition).toHaveBeenLastCalledWith('tutorial', {
        kind: 'operands', isReplay: false, returnTo: { kind: 'level', level: 2 },
      });
    } finally { transition.mockRestore(); await world.dispose(); }
  });

  test('a missing-operand wrong retry credits its actual ordered fact once without changing Arcade', async () => {
    const world = await createWorld(2);
    try {
      [2, 4, 3].forEach((value, index) => world.spawn(mathProblemComponents(index * 100, 0, value, 1)));
      const [left, wrong, right] = problemsIn(world);
      if (!left || !wrong || !right) throw new Error('Missing pads');
      const beforeProfiles = world.getResource('playerProfiles');
      select(world, wrong);
      expect(activeSession(world)).toMatchObject({ solved: 0, attempts: [{ factId: 'add:2:3', correct: false }] });
      expect(world.getResource('equationMode').selectedProblemIds).toEqual([]);
      expect(left.components.mathProblem.consumed).toBe(false);
      select(world, left);
      expect(activeSession(world)).toMatchObject({ solved: 1, attempts: [
        { factId: 'add:2:3', correct: false }, { factId: 'add:2:3', correct: true },
      ] });
      expect(activePlayerProfile(world.getResource('playerProfiles'))?.practiceProgress.facts['add:2:3'])
        .toEqual({ attempts: 2, correct: 1 });
      expect(world.getResource('playerProfiles').profiles.find(profile => profile.id === 'other'))
        .toBe(beforeProfiles.profiles.find(profile => profile.id === 'other'));
      expect(activePlayerProfile(world.getResource('playerProfiles'))?.mathProgress).toEqual(initialSavedMathProgress());
      expect(world.getResource('mathSession')).toBeNull();
      select(world, right);
      expect(activeSession(world).attempts).toHaveLength(2);
      expect(world.getResource('equationsSolved')).toBe(1);
      expect(world.getResource('equationMode').feedback?.kind).toBe('correct');
    } finally { await world.dispose(); }
  });

  test('a switched player cannot receive another player session evidence', async () => {
    const world = await createWorld();
    try {
      const before = world.getResource('playerProfiles');
      world.setResource('playerProfiles', { ...before, activeProfileId: 'other' });
      const session = activeSession(world);
      submitPracticeAttempt(world, { factId: currentPracticeFact(session).id, correct: true });
      expect(activeSession(world)).toBe(session);
      expect(world.getResource('playerProfiles').profiles).toBe(before.profiles);
    } finally { await world.dispose(); }
  });

  test('final correct feedback completes once after its hold; partial finish preserves solved evidence', async () => {
    const world = await createWorld();
    const transition = spyOn(world, 'setScreen').mockImplementation(async () => {});
    try {
      world.setResource('practiceSession', { ...activeSession(world), solved: 11 });
      const answer = world.spawn(mathProblemComponents(0, 0, 2, 1));
      const problem = problemsIn(world).find(candidate => candidate.id === answer.id);
      if (!problem) throw new Error('Missing answer');
      select(world, problem);
      expect(activeSession(world).solved).toBe(12);
      expect(activeSession(world).outcome).toBe('active');
      world.getResource('gameplayClock').elapsed = (EQUATION_FEEDBACK_DURATION_MS.correct - 1) / 1000;
      world.update(0);
      expect(transition).not.toHaveBeenCalled();
      world.getResource('gameplayClock').elapsed = EQUATION_FEEDBACK_DURATION_MS.correct / 1000;
      world.update(0);
      expect(activeSession(world).outcome).toBe('completed');
      expect(transition).toHaveBeenCalledTimes(1);
      expect(transition).toHaveBeenCalledWith('practiceResults', {});
      world.update(0);
      finishPractice(world);
      expect(transition).toHaveBeenCalledTimes(1);
      const owner = activePlayerProfile(world.getResource('playerProfiles'));
      expect(owner?.practiceProgress.facts['add:2:3']).toEqual({ attempts: 1, correct: 1 });
    } finally { transition.mockRestore(); await world.dispose(); }
  });

  test('board repair preserves selected topic and uses free distinct pads when enemies occupy its only answer', async () => {
    const world = await createWorld(2, true);
    try {
      [2, 3, 40, 40, 40, 40].forEach((value, index) => {
        const position = gridToPixel(index % 3, Math.floor(index / 3));
        world.spawn(mathProblemComponents(position.x, position.y, value, 1));
      });
      const blocked = problemsIn(world)[0];
      if (!blocked) throw new Error('Missing occupied pad');
      world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
      world.update(0);
      const mode = world.getResource('equationMode');
      expect(mode.promptValues).toEqual([2, 3]);
      expect(mode.target).toBe(5);
      expect(blocked.components.mathProblem.value).toBe(2);
      const free = problemsIn(world).filter(problem => problem.id !== blocked.id);
      expect(free.some(problem => submittedPracticeFact(activeSession(world), mode, [problem.components.mathProblem.value]))).toBe(true);
      expect(activeSession(world).selection.topicId).toBe('add-make-5');
      expect(activeSession(world).attempts).toEqual([]);
    } finally { await world.dispose(); }
  });

  test('arithmetic-only out-of-topic solutions cannot prevent catalog answer repair', async () => {
    const world = await createWorld(2, true);
    try {
      [6, -1, 6, -1, 6, -1].forEach((value, index) => world.spawn(mathProblemComponents(index * 100, 0, value, 1)));
      world.update(0);
      const mode = world.getResource('equationMode');
      const free = problemsIn(world);
      expect(free.some(problem => submittedPracticeFact(activeSession(world), mode, [problem.components.mathProblem.value]))).toBe(true);
      expect(mode.promptValues).toEqual([2, 3]);
    } finally { await world.dispose(); }
  });

  test('exit produces one partial result without discarding prior evidence', async () => {
    const world = await createWorld();
    const transition = spyOn(world, 'setScreen').mockImplementation(async () => {});
    try {
      submitPracticeAttempt(world, { factId: 'add:2:3', correct: true });
      submitPracticeAttempt(world, { factId: 'add:0:5', correct: false });
      finishPractice(world);
      finishPractice(world);
      expect(activeSession(world)).toMatchObject({ solved: 1, outcome: 'partial', attempts: [
        { factId: 'add:2:3', correct: true }, { factId: 'add:0:5', correct: false },
      ] });
      expect(transition).toHaveBeenCalledTimes(1);
      expect(activePlayerProfile(world.getResource('playerProfiles'))?.practiceProgress.facts['add:2:3'])
        .toEqual({ attempts: 1, correct: 1 });
    } finally { transition.mockRestore(); await world.dispose(); }
  });
});
