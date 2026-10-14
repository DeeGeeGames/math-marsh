import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import type { LevelCompleteScreenConfig, PlayingScreenConfig } from '../types';
import { createPracticeSession } from '../practiceMode';
import { initialSavedPracticeProgress } from '../practiceProgressStore';
import { createPracticeEquationModeState } from '../practiceSteps';
import { playerComponents } from '../entities';
import { addPracticeProgressionSystemToEngine } from './PracticeProgressionSystem';

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};
type PracticeTestWorld = ReturnType<ReturnType<typeof ECSpresso.create<TestConfig>>['build']>;

const createWorld = async function(): Promise<PracticeTestWorld> {
	const world = ECSpresso.create<TestConfig>()
		.withScreens(screens => screens
			.add('playing', { initialState: (config: PlayingScreenConfig) => config })
			.add('levelComplete', { initialState: (config: LevelCompleteScreenConfig) => ({ ...config, transitionStarted: false }) })
			.add('practiceResult', { initialState: () => ({}) }))
		.build();
	world.setResource('practiceProgress', initialSavedPracticeProgress());
	world.setResource('practiceProgressPersistence', 'persistent');
	world.setResource('practiceRoundSummary', null);
	world.setResource('practiceAccelerationStreak', 0);
	world.setResource('practiceSession', createPracticeSession('add', 1));
	const equationMode = createPracticeEquationModeState(1, 'add', 0);
	if (!equationMode) throw new Error('Missing practice equation mode');
	world.setResource('equationMode', equationMode);
	world.setResource('gameplayOnboardingSession', { active: false });
	world.setResource('skitProgress', []);
	world.spawn({ ...playerComponents(0, 0), timers: {} });
	addPracticeProgressionSystemToEngine(world);
	await world.initialize();
	await world.setScreen('playing', { level: 1, isFreshGame: true });
	return world;
};

describe('practice progression system', () => {
	test('counts active gameplay only and carries a sample across board-clear screens', async () => {
		const world = await createWorld();
		try {
			world.update(1);
			expect(world.getResource('practiceSession')?.assessment.activeSeconds).toBe(1);
			await world.pushScreen('levelComplete', { completedLevel: 1, nextLevel: 1, startedAt: 0 });
			world.update(5);
			expect(world.getResource('practiceSession')?.assessment.activeSeconds).toBe(1);
			await world.popScreen();
			world.update(0.5);
			expect(world.getResource('practiceSession')?.assessment.activeSeconds).toBe(1.5);
		} finally {
			await world.dispose();
		}
	});

	test('applies a fast six-correct round, saves crossed steps, and awards crossed scenes', async () => {
		const world = await createWorld();
		try {
			const session = createPracticeSession('add', 1);
			world.setResource('practiceSession', {
				...session,
				assessment: {
					correctAnswers: 6,
					incorrectAnswers: 0,
					activeSeconds: 12,
					expectedSecondsTotal: 60,
				},
			});
			world.update(0.01);
			await Promise.resolve();
			world.update(0);
			await Promise.resolve();
			expect(world.getResource('practiceProgress').add).toEqual({ currentStep: 3, highestUnlockedStep: 3 });
			expect(world.getResource('practiceAccelerationStreak')).toBe(1);
			expect(world.getResource('skitProgress')).toEqual(['snack-break']);
			expect(world.getResource('practiceRoundSummary')?.unlockedSceneIds).toEqual(['snack-break']);
			expect(world.getCurrentScreen()).toBe('practiceResult');
		} finally {
			await world.dispose();
		}
	});

	test('stops assessment timing and progression while the player death sequence is pending', async () => {
		const world = await createWorld();
		try {
			const player = world.getSingleton(['position', 'player', 'pathFollower', 'timers']);
			world.mutateComponent(player.id, 'player', state => { state.gameOverPending = true; });
			world.setResource('practiceSession', {
				...createPracticeSession('add', 1),
				assessment: {
					correctAnswers: 6,
					incorrectAnswers: 0,
					activeSeconds: 0,
					expectedSecondsTotal: 60,
				},
			});

			world.update(2);

			expect(world.getResource('practiceSession')?.assessment.activeSeconds).toBe(0);
			expect(world.getResource('practiceRoundSummary')).toBeNull();
			expect(world.getCurrentScreen()).toBe('playing');
		} finally {
			await world.dispose();
		}
	});
});
