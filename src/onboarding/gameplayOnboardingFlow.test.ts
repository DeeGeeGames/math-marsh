import { emptyPracticeProgress } from '../ecs/practiceProgress';
import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import * as audio from '../audio/audio';
import type { GameEngine } from '../ecs/Engine';
import type { AllComponents, PlayingScreenConfig, TutorialScreenConfig } from '../ecs/types';
import { playerComponents } from '../ecs/entities';
import { createMathSession, type MathSession } from '../ecs/mathMode';
import { initialSavedMathProgress, type SavedMathProgress } from '../ecs/mathProgressStore';
import { activePlayerProfile, initialPlayerLearnerData, type PlayerProfile, type PlayerProfilesState } from '../ecs/playerProfiles';
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

const profilesFor = function(progress: SavedMathProgress): PlayerProfilesState {
	return {
		profiles: [{
			id: 'test-player',
			name: 'Player',
			mathProgress: progress,
			onboarding: { basics: 'pending', operands: 'pending', operandAndResult: 'pending' },
			skitProgress: [],
    practiceProgress: emptyPracticeProgress(),
		}],
		activeProfileId: 'test-player',
		initialLearnerData: initialPlayerLearnerData(),
		persistence: 'persistent',
		canPersist: false,
	};
};

const activeProfileFor = function(world: TestWorld): PlayerProfile {
	const profile = activePlayerProfile(world.getResource('playerProfiles'));
	if (!profile) throw new Error('Missing active player profile');
	return profile;
};

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
	world.setResource('playerProfiles', profilesFor(progress));
	world.setResource('mathDifficulty', 'expert');
	world.setResource('gameMode', ['add']);
	world.setResource('remainingTimeSeconds', 42);
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
		test(`${action} operands lesson resumes the same run before the later mixed lesson`, async () => {
			const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
			const { world, player, mathSession, progress } = await createWorld();
			try {
				const position = { ...player.components.position };
				const path = { ...player.components.pathFollower, breadcrumbs: [...player.components.pathFollower.breadcrumbs] };
				goToNextLevel(world, 2, 'expert', 'pending', 'pending');
				await new Promise<void>(resolve => setTimeout(resolve, 0));
				const operands = world.getResource('gameplayOnboardingSession');
				if (!operands.active) throw new Error('Expected active operands lesson');
				expect(operands.kind).toBe('operands');
				expect(operands.returnTo).toEqual({ kind: 'level', level: 2 });
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
				expect(world.getCurrentScreen()).toBe('playing');
				expect(player.components.position).toEqual(position);
				goToNextLevel(world, 3, 'expert', action, 'pending');
				await new Promise<void>(resolve => setTimeout(resolve, 0));
				const mixed = world.getResource('gameplayOnboardingSession');
				if (!mixed.active) throw new Error('Expected active mixed lesson');
				expect(world.getCurrentScreen()).toBe('tutorial');
				expect(mixed.kind).toBe('operandAndResult');
				expect(mixed.returnTo).toEqual({ kind: 'level', level: 3 });
				expect(mixed.playerSnapshot?.position).toEqual(position);
				expect(mixed.playerSnapshot?.pathFollower).toEqual(path);
				expect(mixed.playerSnapshot?.remainingTimeSeconds).toBe(42);
				expect(activeProfileFor(world).onboarding.operands).toBe(action);
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
				expect(activeProfileFor(world).mathProgress).toBe(progress);
				expect(activeProfileFor(world).onboarding.operandAndResult).toBe('completed');
			} finally {
				await world.dispose();
				sound.mockRestore();
			}
		});
	}
});
