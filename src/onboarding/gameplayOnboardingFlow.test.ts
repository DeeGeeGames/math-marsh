import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import * as audio from '../audio/audio';
import type { GameEngine } from '../ecs/Engine';
import type { AllComponents, PlayingScreenConfig, TutorialScreenConfig } from '../ecs/types';
import { playerComponents } from '../ecs/entities';
import { createMathSession, type MathSession } from '../ecs/mathMode';
import { initialSavedMathProgress, type SavedMathProgress } from '../ecs/mathProgressStore';
import { goToNextLevel } from '../ecs/systems/nextLevel';
import { setupScriptedTutorialScene } from './gameplayOnboardingScene';
import { nextGameplayOnboardingStep, skipGameplayOnboarding } from './gameplayOnboardingFlow';
import { tutorialSteps } from './gameplayOnboarding';

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

type TestWorld = ReturnType<ReturnType<typeof ECSpresso.create<TestConfig>>['build']>;
type Fixture = Readonly<{
	world: TestWorld;
	player: { id: number; components: Pick<AllComponents, 'player' | 'position' | 'pathFollower'> };
	mathSession: MathSession;
	progress: SavedMathProgress;
}>;

const createWorld = async function(): Promise<Fixture> {
	const world = ECSpresso.create<TestConfig>()
		.withScreens(screens => screens
			.add('playing', { initialState: (config: PlayingScreenConfig) => config })
			.add('tutorial', { initialState: (config: TutorialScreenConfig) => config }))
		.build();
	const progress = { ...initialSavedMathProgress(), add: { currentStep: 7, highestUnlockedStep: 7 } };
	const initialSession = createMathSession(progress);
	const mathSession = {
		tracks: { ...initialSession.tracks, subtract: { ...initialSession.tracks.subtract, assessment: {
			correctAnswers: 2, incorrectAnswers: 1, activeSeconds: 18, expectedSecondsTotal: 20,
		} } },
	};
	world.setResource('mathSession', mathSession);
	world.setResource('mathProgress', progress);
	world.setResource('mathDifficulty', 'easy');
	world.setResource('gameMode', ['add']);
	world.setResource('remainingTimeSeconds', 42);
	world.setResource('operandOnboardingCompletion', 'pending');
	world.setResource('operandAndResultOnboardingCompletion', 'pending');
	world.setResource('gameplayOnboardingSession', { active: false });
	world.onScreenEnter('tutorial', ({ config }) => setupScriptedTutorialScene(world, config));
	await world.initialize();
	await world.setScreen('playing', { level: 2, isFreshGame: false });
	world.spawn({ ...playerComponents(150, 250), timers: {} }, { scope: null });
	const player = world.getSingleton(['player', 'position', 'pathFollower']);
	world.mutateComponent(player.id, 'pathFollower', path => {
		path.breadcrumbs = [{ x: 1, y: 2 }, { x: 2, y: 2 }];
		path.speed = 60;
	});
	return { world, player, mathSession, progress };
};

describe('adaptive level tutorial transitions', () => {
	for (const action of ['completed', 'skipped'] as const) {
		test(`${action} operands lesson chains into mixed lesson before resuming the same run`, async () => {
			const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
			const { world, player, mathSession, progress } = await createWorld();
			try {
				const position = { ...player.components.position };
				const path = { ...player.components.pathFollower, breadcrumbs: [...player.components.pathFollower.breadcrumbs] };
				goToNextLevel(world, 3, 'easy', 'pending', 'pending');
				await new Promise<void>(resolve => setTimeout(resolve, 0));
				const operands = world.getResource('gameplayOnboardingSession');
				if (!operands.active) throw new Error('Expected active operands lesson');
				expect(operands.kind).toBe('operands');
				expect(operands.returnTo).toEqual({ kind: 'level', level: 3 });
				world.mutateComponent(player.id, 'position', state => { state.x = 900; });
				world.mutateComponent(player.id, 'pathFollower', state => { state.breadcrumbs = []; });
				world.setResource('remainingTimeSeconds', 999);
				if (action === 'completed') {
					world.setResource('gameplayOnboardingSession', { ...operands, stepIndex: tutorialSteps('operands').length - 1 });
					nextGameplayOnboardingStep(world);
				} else {
					skipGameplayOnboarding(world);
				}
				await new Promise<void>(resolve => setTimeout(resolve, 0));
				const mixed = world.getResource('gameplayOnboardingSession');
				if (!mixed.active) throw new Error('Expected active mixed lesson');
				expect(world.getCurrentScreen()).toBe('tutorial');
				expect(mixed.kind).toBe('operandAndResult');
				expect(mixed.returnTo).toEqual({ kind: 'level', level: 3 });
				expect(mixed.playerSnapshot?.position).toEqual(position);
				expect(mixed.playerSnapshot?.pathFollower).toEqual(path);
				expect(mixed.playerSnapshot?.remainingTimeSeconds).toBe(42);
				expect(world.getResource('operandOnboardingCompletion')).toBe(action);
				world.mutateComponent(player.id, 'position', state => { state.y = 800; });
				world.setResource('remainingTimeSeconds', 999);
				world.setResource('gameplayOnboardingSession', { ...mixed, stepIndex: tutorialSteps('operandAndResult').length - 1 });
				nextGameplayOnboardingStep(world);
				await new Promise<void>(resolve => setTimeout(resolve, 0));
				expect(world.getCurrentScreen()).toBe('playing');
				expect(player.components.position).toEqual(position);
				expect(player.components.pathFollower).toEqual(path);
				expect(world.getResource('remainingTimeSeconds')).toBe(42);
				expect(world.getResource('mathSession')).toBe(mathSession);
				expect(world.getResource('mathProgress')).toBe(progress);
				expect(world.getResource('operandAndResultOnboardingCompletion')).toBe('completed');
			} finally {
				await world.dispose();
				sound.mockRestore();
			}
		});
	}
});
