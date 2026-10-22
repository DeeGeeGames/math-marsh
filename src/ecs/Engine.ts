import { desktopInputProvider } from '../platform/steamInput';
import { boardForDifficulty } from './boardGeometry';
import { frameDeltaSeconds } from './frameTime';
import ECSpresso, { type SystemRegistrarOf } from 'ecspresso';
import { createInputPlugin } from 'ecspresso/plugins/input/input';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { createCoroutinePlugin } from 'ecspresso/plugins/scripting/coroutine';
import { controllerActionMap, controllerOnlyActionMap, initialControllerSelection, keyboardActionMap } from './controllerSelection';
import { configureGameScreens } from './screenConfiguration';
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
  gamepad: { poll: desktopInputProvider.poll },
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
  .withScreens(configureGameScreens)
  .build();

gameEngine.addSystem('desktop-input-context')
  .inPhase('preUpdate')
  .setPriority(101)
  .setProcess(({ ecs }) => {
    desktopInputProvider.setContext(ecs.getCurrentScreen() === 'playing' ? 'gameplay' : 'menu');
  });

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
