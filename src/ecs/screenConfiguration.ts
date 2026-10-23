import type { ScreenConfigurator } from 'ecspresso';
import { initialLevelSelectSequence } from './levelSelectionCheat';
import { initialSplashState } from './splashSequence';
import type {
	LevelCompleteScreenConfig,
	LevelCompleteScreenState,
	PlayerProfileActionScreenConfig,
	PlayingScreenConfig,
	SettingsScreenConfig,
	TutorialScreenConfig,
} from './types';
import type { SkitScreenConfig } from './skitSequence';

// Keep the full screen map inferred for ECSpresso's withScreens type.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const configureGameScreens = function<World>(screens: ScreenConfigurator<{}, World>) {
	return screens
		.add('studioSplash', { initialState: initialSplashState })
		.add('engineSplash', { initialState: initialSplashState })
		.add('menu', { initialState: () => ({}) })
		.add('playerSetup', { initialState: () => ({}) })
		.add('playerRoster', { initialState: () => ({}) })
		.add('playerAdd', { initialState: () => ({}) })
		.add('playerManagement', { initialState: () => ({}) })
		.add('playerRename', { initialState: (config: PlayerProfileActionScreenConfig) => ({ ...config }) })
		.add('playerDelete', { initialState: (config: PlayerProfileActionScreenConfig) => ({ ...config }) })
		.add('skitGallery', { initialState: () => ({}) })
		.add('practice', { initialState: () => ({}) })
		.add('practiceResults', { initialState: () => ({}) })
		.add('modeSelect', { initialState: initialLevelSelectSequence })
		.add('howToPlay', { initialState: () => ({}) })
		.add('tutorialOffer', { initialState: () => ({}) })
		.add('tutorial', { initialState: (config: TutorialScreenConfig) => ({ ...config }) })
		.add('playing', { initialState: (config: PlayingScreenConfig) => ({ ...config }) })
		.add('levelComplete', {
			initialState: (config: LevelCompleteScreenConfig): LevelCompleteScreenState => ({
				...config,
				transitionStarted: false,
			}),
		})
		.add('skit', {
			initialState: (config: SkitScreenConfig) => ({ ...config, elapsed: 0, transitionStarted: false }),
		})
		.add('controllerRecovery', { initialState: () => ({ startedAt: performance.now() }) })
		.add('paused', { initialState: () => ({}) })
		.add('settings', { initialState: (config: SettingsScreenConfig) => ({ ...config }) })
		.add('demoEnd', { initialState: () => ({}) })
		.add('gameOver', { initialState: () => ({}) });
};
