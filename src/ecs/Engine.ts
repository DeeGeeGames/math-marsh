import { initialLevelSelectSequence } from './levelSelectionCheat';
import { boardForDifficulty } from './boardGeometry';
import { frameDeltaSeconds } from './frameTime';
import ECSpresso, { type SystemRegistrarOf } from 'ecspresso';
import { createInputPlugin } from 'ecspresso/plugins/input/input';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { createCoroutinePlugin } from 'ecspresso/plugins/scripting/coroutine';
import { controllerActionMap, controllerOnlyActionMap, initialControllerSelection, keyboardActionMap } from './controllerSelection';
import { initialSplashState } from './splashSequence';
import type { SkitScreenConfig } from './skitSequence';
import { loadPlayerProfiles } from './playerProfiles';
import { gameplayClockPlugin } from './gameplayClock';
import { SYSTEM_PRIORITIES } from './systemConfigs';
import { configureImageAssets } from './assets';
import { createEquationModeState } from '../math/equations';
import { GAME_CONFIG } from '../config';
import type {
  Components,
  Resources,
  GameAction,
  TimerSlot,
  PlayingScreenConfig,
  LevelCompleteScreenConfig,
  LevelCompleteScreenState,
  SettingsScreenConfig,
  TutorialScreenConfig,
  PlayerProfileActionScreenConfig,
} from './types';

const timerPlugin = createTimerPlugin<TimerSlot>({ priority: SYSTEM_PRIORITIES.TIMERS });
// Priority slots tween between movement and render so render reads the
// just-interpolated values, not last frame's.
const tweenPlugin = createTweenPlugin({ priority: SYSTEM_PRIORITIES.ANIMATION });
const coroutinePlugin = createCoroutinePlugin({
  priority: SYSTEM_PRIORITIES.FROG_TONGUE,
  phase: 'preUpdate',
});

const noMathSession: Resources['mathSession'] = null;
const noMathRoundSummary: Resources['mathRoundSummary'] = null;

const PREVENT_DEFAULT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Tab']);

const isEditableTarget = function(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
};

const inputPlugin = createInputPlugin<GameAction>({
  actions: controllerActionMap(initialControllerSelection()),
  players: {
    keyboard: keyboardActionMap(),
    controller: controllerOnlyActionMap(initialControllerSelection()),
  },
  shouldPreventDefault: event => 'key' in event
    && PREVENT_DEFAULT_KEYS.has(event.key)
    && !isEditableTarget(event.target),
});

export const gameEngine = ECSpresso.create()
  .withPlugin(inputPlugin)
  .withPlugin(timerPlugin)
  .withPlugin(gameplayClockPlugin)
  .withPlugin(tweenPlugin)
  .withPlugin(coroutinePlugin)
  .withComponentTypes<Components>()
  .withAssets(configureImageAssets)
  .withResourceTypes<Resources>()
  .withResource('gameMode', ['add'] as const)
  .withResource('mathDifficulty', 'easy')
  .withResource('board', boardForDifficulty('easy'))
  .withResource('currentLevel', 1)
  .withResource('startingLevel', 1)
  .withResource('levelSelectionUnlocked', false)
  .withResource('remainingTimeSeconds', GAME_CONFIG.GAMEPLAY.STARTING_TIME_SECONDS)
  .withResource('equationsSolved', 0)
  .withResource('enemySpawn', { index: 0, roster: [] })
  .withResource('equationMode', createEquationModeState(1, 'easy', ['add']))
  .withResource('controllerSelection', initialControllerSelection())
  .withResource('playerProfiles', loadPlayerProfiles())
  .withResource('mathSession', noMathSession)
  .withResource('mathRoundSummary', noMathRoundSummary)
  .withResource('equationsSolvedThisBoard', 0)
  .withResource('mathRoundCompletedThisBoard', false)
  .withResource('inputPrompt', { platform: 'keyboard', gamepadAxesActive: [] })
  .withResource('gameplayOnboardingSession', { active: false })
  .withResource('tapRequest', null as Resources['tapRequest'])
  .withResource('tapEat', null as Resources['tapEat'])
  .withResource('tapFeedback', null as Resources['tapFeedback'])
  .withRequired('player', 'timers', () => ({}))
  .withRequired('enemy', 'timers', () => ({}))
  .withRequired('enemy', 'health', () => ({ current: 1, max: 1 }))
  .withScreens(screens => screens
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
    .add('gameOver', { initialState: () => ({}) }))
  .build();

export type GameEngine = typeof gameEngine;
export type GameSystemRegistrar = SystemRegistrarOf<GameEngine>;

let lastFrameTime = 0;
let gameRunning = false;

export async function initializeEngine(): Promise<void> {
  await gameEngine.initialize();
  console.log('ECSpresso engine initialized');
}

export function startGameLoop(): void {
  if (gameRunning) return;

  gameRunning = true;
  lastFrameTime = performance.now();
  document.addEventListener('visibilitychange', () => {
    lastFrameTime = performance.now();
  });
  requestAnimationFrame(gameLoop);
  console.log('Game loop started');
}

function gameLoop(currentTime: number): void {
  if (!gameRunning) return;

  const deltaTime = frameDeltaSeconds(currentTime, lastFrameTime, document.hidden);
  lastFrameTime = currentTime;

  gameEngine.update(deltaTime);

  requestAnimationFrame(gameLoop);
}
