import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import type { EquationOperation, LevelCompleteScreenConfig, PlayingScreenConfig } from '../types';
import { createMathSession, equationModeForMathSession } from '../mathMode';
import { initialSavedMathProgress } from '../mathProgressStore';
import { createMathAssessment, type MathAssessmentState } from '../mathAssessment';
import * as audio from '../../audio/audio';
import { gridCells } from '../lilyPads';
import { gridToPixel } from '../gameUtils';
import { BOARD_SIZES } from '../boardGeometry';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { addProblemManagementSystemToEngine } from './ProblemManagementSystem';
import { mathProblemComponents, playerComponents } from '../entities';
import { addMathProgressionSystemToEngine } from './MathProgressionSystem';

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};
type MathTestWorld = ReturnType<ReturnType<typeof ECSpresso.create<TestConfig>>['build']>;

const createWorld = async function(includeProblems = false): Promise<MathTestWorld> {
	const world = ECSpresso.create<TestConfig>()
		.withScreens(screens => screens
			.add('playing', { initialState: (config: PlayingScreenConfig) => config })
			.add('levelComplete', { initialState: (config: LevelCompleteScreenConfig) => ({ ...config, transitionStarted: false }) })
			.add('paused', { initialState: () => ({}) }))
		.build();
	const progress = initialSavedMathProgress();
	const session = createMathSession(progress);
	world.setResource('mathProgress', progress);
	world.setResource('mathProgressPersistence', 'persistent');
	world.setResource('mathRoundSummary', null);
	world.setResource('mathRoundCompletedThisBoard', false);
	world.setResource('mathSession', session);
	world.setResource('equationMode', equationModeForMathSession(session, ['add'], 1));
	world.setResource('gameplayOnboardingSession', { active: false });
	world.setResource('skitProgress', []);
	world.spawn({ ...playerComponents(0, 0), timers: {} });
	addMathProgressionSystemToEngine(world);
	if (includeProblems) {
		world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
		world.setResource('board', BOARD_SIZES.easy);
		world.setResource('enemySpawn', { index: 0, roster: [] });
		world.setResource('currentLevel', 1);
		world.setResource('gameMode', ['add']);
		world.setResource('mathDifficulty', 'easy');
		gridCells(BOARD_SIZES.easy).forEach(cell => {
			const pixel = gridToPixel(cell.x, cell.y);
			world.spawn(mathProblemComponents(pixel.x, pixel.y, 3, 1));
		});
		addProblemManagementSystemToEngine(world);
	}
	await world.initialize();
	await world.setScreen('playing', { level: 1, isFreshGame: true });
	return world;
};

const setAssessment = function(world: MathTestWorld, operation: EquationOperation, assessment: MathAssessmentState): void {
	const session = world.getResource('mathSession');
	if (!session) throw new Error('Missing math session');
	world.setResource('mathSession', {
		tracks: { ...session.tracks, [operation]: { ...session.tracks[operation], assessment } },
	});
};

const fastAssessment = function(): MathAssessmentState {
	return { correctAnswers: 6, incorrectAnswers: 0, activeSeconds: 12, expectedSecondsTotal: 60 };
};

describe('math progression system', () => {
	test('times only the current operation and carries incomplete samples across board screens', async () => {
		const world = await createWorld();
		try {
			setAssessment(world, 'add', { ...createMathAssessment(), correctAnswers: 3, expectedSecondsTotal: 30 });
			world.update(1);
			expect(world.getResource('mathSession')?.tracks.add.assessment.activeSeconds).toBe(1);
			const session = world.getResource('mathSession');
			if (!session) throw new Error('Missing math session');
			world.setResource('equationMode', equationModeForMathSession(session, ['multiply'], 1));
			world.update(2);
			expect(world.getResource('mathSession')?.tracks.multiply.assessment.activeSeconds).toBe(2);
			expect(world.getResource('mathSession')?.tracks.add.assessment.activeSeconds).toBe(1);
			await world.pushScreen('levelComplete', { completedLevel: 1, nextLevel: 2, startedAt: 0 });
			world.update(5);
			await world.popScreen();
			world.update(0.5);
			expect(world.getResource('mathSession')?.tracks.multiply.assessment.activeSeconds).toBe(2.5);
			expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(3);
			expect(world.getResource('mathRoundSummary')).toBeNull();
			expect(world.getResource('mathProgress').add.currentStep).toBe(1);
		} finally { await world.dispose(); }
	});

	test('awards +2/+4/+4 and all crossed scenes during normal play, once per sample', async () => {
		const world = await createWorld();
		try {
			for (const step of [3, 7, 11]) {
				world.setResource('mathRoundCompletedThisBoard', false);
				setAssessment(world, 'add', fastAssessment());
				world.update(0);
				expect(world.getResource('mathProgress').add).toEqual({ currentStep: step, highestUnlockedStep: step });
				expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(0);
				expect(world.getResource('equationMode').level).toBe(1);
				expect(world.getCurrentScreen()).toBe('playing');
				const summary = world.getResource('mathRoundSummary');
				world.update(0);
				expect(world.getResource('mathRoundSummary')).toBe(summary);
				expect(world.getResource('mathProgress').add.currentStep).toBe(step);
			}
			expect(world.getResource('mathSession')?.tracks.add.accelerationStreak).toBe(3);
			expect(world.getResource('skitProgress')).toEqual(['snack-break', 'the-big-jump', 'the-web-guitar', 'the-big-plan']);
		} finally { await world.dispose(); }
	});

	test('evaluates a completed prior operation after prompt changes without erasing the next operation sample', async () => {
		const world = await createWorld();
		try {
			setAssessment(world, 'add', fastAssessment());
			setAssessment(world, 'multiply', { correctAnswers: 2, incorrectAnswers: 1, activeSeconds: 20, expectedSecondsTotal: 24 });
			const session = world.getResource('mathSession');
			if (!session) throw new Error('Missing math session');
			world.setResource('equationMode', equationModeForMathSession(session, ['multiply'], 3, 2));
			const mode = world.getResource('equationMode');
			world.update(1);
			expect(world.getResource('mathProgress').add.currentStep).toBe(3);
			expect(world.getResource('mathProgress').multiply.currentStep).toBe(1);
			expect(world.getResource('mathSession')?.tracks.add.assessment).toEqual(createMathAssessment());
			expect(world.getResource('mathSession')?.tracks.multiply.assessment).toEqual({
				correctAnswers: 2, incorrectAnswers: 1, activeSeconds: 21, expectedSecondsTotal: 24,
			});
			expect(world.getResource('equationMode')).toBe(mode);
			expect(world.getResource('mathRoundSummary')?.operation).toBe('add');
		} finally { await world.dispose(); }
	});

	test('advances slow accurate play one step and repeats low accuracy without losing unlocks', async () => {
		const world = await createWorld();
		try {
			const progress = { ...initialSavedMathProgress(), add: { currentStep: 3, highestUnlockedStep: 11 } };
			world.setResource('mathProgress', progress);
			world.setResource('mathSession', createMathSession(progress));
			setAssessment(world, 'add', { ...fastAssessment(), activeSeconds: 90 });
			world.update(0);
			expect(world.getResource('mathProgress').add).toEqual({ currentStep: 4, highestUnlockedStep: 11 });
			expect(world.getResource('mathSession')?.tracks.add.accelerationStreak).toBe(0);
			world.setResource('mathRoundCompletedThisBoard', false);
			setAssessment(world, 'add', { ...fastAssessment(), incorrectAnswers: 2 });
			world.update(0);
			expect(world.getResource('mathProgress').add).toEqual({ currentStep: 4, highestUnlockedStep: 11 });
			expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(0);
			expect(world.getResource('skitProgress')).toEqual([]);
		} finally { await world.dispose(); }
	});

	test('routes a completed assessment through the existing board intermission', async () => {
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const world = await createWorld(true);
		try {
			setAssessment(world, 'add', fastAssessment());
			world.update(0);
			await Promise.resolve();
			expect(world.getResource('mathProgress').add.currentStep).toBe(3);
			expect(world.getResource('mathRoundCompletedThisBoard')).toBe(true);
			expect(world.getCurrentScreen()).toBe('levelComplete');
			const summary = world.getResource('mathRoundSummary');
			world.update(5);
			expect(world.getResource('mathRoundSummary')).toBe(summary);
			expect(world.getResource('mathSession')?.tracks.add.assessment.activeSeconds).toBe(0);
		} finally {
			await world.dispose();
			sound.mockRestore();
		}
	});

	test('stops timing and progression during pauses, onboarding, and pending player death', async () => {
		const world = await createWorld();
		try {
			setAssessment(world, 'add', { ...fastAssessment(), activeSeconds: 0 });
			await world.pushScreen('paused', {});
			world.update(2);
			await world.popScreen();
			world.setResource('gameplayOnboardingSession', { active: true, kind: 'basics', isReplay: false, stepIndex: 0, returnTo: { kind: 'previousScreen' } });
			world.update(2);
			world.setResource('gameplayOnboardingSession', { active: false });
			const player = world.getSingleton(['position', 'player', 'pathFollower', 'timers']);
			world.mutateComponent(player.id, 'player', state => { state.gameOverPending = true; });
			world.update(2);
			expect(world.getResource('mathSession')?.tracks.add.assessment.activeSeconds).toBe(0);
			expect(world.getResource('mathRoundSummary')).toBeNull();
			expect(world.getCurrentScreen()).toBe('playing');
		} finally { await world.dispose(); }
	});
});
