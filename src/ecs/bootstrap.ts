import { initializeEngine, startGameLoop, gameEngine } from './Engine';
import { createPlayer } from './entities';
import type { PlayingScreenConfig } from './types';
import { gridToPixel } from './gameUtils';
import {
  initializeRenderSystem,
  addRenderSystemToEngine
} from './systems/RenderSystem';
import { addEquationFeedbackSystemToEngine } from './systems/EquationFeedbackSystem';
import { addPauseSystemToEngine } from './systems/PauseSystem';
import { addUINavigationSystemToEngine } from './systems/UINavigationSystem';
import { addInputPromptSystemToEngine } from './systems/InputPromptSystem';
import { gameplayPlugin } from './gameplayPlugin';
import { playerQuery } from './queries';
import {
  initializeUI,
  setFinalTime,
  showGameplayScreen,
  showPauseScreen,
  showScreen,
  showSettingsScreen,
  updateGameplayOnboardingUI,
} from '../ui/UIManager';
import { createEquationModeState } from '../math/equations';
import { addLevelCompleteSystemToEngine } from './systems/LevelCompleteSystem';
import {
  gameplayOnboardingPlugin,
  setupScriptedTutorialScene,
} from './systems/GameplayOnboardingSystem';

const GAMEPLAY_CLOCK_GROUPS = ['timers', 'tweens', 'coroutines'] as const;
const INACTIVE_SCREENS = ['menu', 'modeSelect', 'howToPlay', 'tutorialOffer'] as const;

function pauseGameplayClocks(): void {
  GAMEPLAY_CLOCK_GROUPS.forEach(group => gameEngine.disableSystemGroup(group));
}

function resumeGameplayClocks(): void {
  GAMEPLAY_CLOCK_GROUPS.forEach(group => gameEngine.enableSystemGroup(group));
}

const setupCanvas = (): void => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) throw new Error('Canvas element not found');
  initializeRenderSystem(canvas);
};

const resetEnemySpawnSequence = (): void => {
  gameEngine.setResource('enemySpawn', { index: 0 });

  const player = gameEngine.tryGetSingleton(playerQuery.with);
  if (!player) return;

  gameEngine.mutateComponent(player.id, 'timers', timers => {
    delete timers.enemySpawn;
  });
};

/**
 * Set up game state for a 'playing' screen entry.
 *
 * On fresh game: tear down any leftover player (e.g. from a prior gameOver)
 * and create a new one — the player is unscoped so it survives screen exits.
 * On level transition: leave the existing player so lives and run time persist.
 */
const enterPlayingScreen = ({ level, isFreshGame }: PlayingScreenConfig): void => {
  gameEngine.setResource('currentLevel', level);
  const gameMode = gameEngine.getResource('gameMode');
  const mathDifficulty = gameEngine.getResource('mathDifficulty');
  gameEngine.setResource(
    'equationMode',
    createEquationModeState(level, mathDifficulty, gameMode),
  );

  if (isFreshGame) {
    gameEngine.setResource('gameplayTimeSeconds', 0);

    const existingPlayer = gameEngine.tryGetSingleton(playerQuery.with);
    if (existingPlayer) gameEngine.removeEntity(existingPlayer.id);

    const playerPixelPos = gridToPixel(3, 2);
    createPlayer(gameEngine, playerPixelPos.x, playerPixelPos.y);
  }

  resetEnemySpawnSequence();
};

/**
 * Wire screen lifecycle hooks. ECS screen state drives DOM, not vice versa.
 */
const setupScreenHooks = (): void => {
  const registerInactiveScreen = (screen: (typeof INACTIVE_SCREENS)[number]): void => {
    function showInactiveScreen(): void {
      pauseGameplayClocks();
      showScreen(screen);
    }

    gameEngine.onScreenEnter(screen, showInactiveScreen);
    gameEngine.onScreenResume(screen, showInactiveScreen);
  };

  INACTIVE_SCREENS.forEach(registerInactiveScreen);

  function showPausedScreen(): void {
    pauseGameplayClocks();
    showPauseScreen();
  }

  gameEngine.onScreenEnter('paused', showPausedScreen);
  gameEngine.onScreenResume('paused', showPausedScreen);

  gameEngine.onScreenEnter('playing', ({ config }) => {
    resumeGameplayClocks();
    showGameplayScreen('normal');
    setupCanvas();
    gameEngine.setResource('gameplayOnboardingSession', { active: false });
    updateGameplayOnboardingUI({ active: false });
    enterPlayingScreen(config);
  });

  gameEngine.onScreenResume('playing', () => {
    resumeGameplayClocks();
    showGameplayScreen('normal');
  });

  gameEngine.onScreenEnter('tutorial', ({ config }) => {
    resumeGameplayClocks();
    showGameplayScreen('tutorial');
    setupCanvas();
    setupScriptedTutorialScene(gameEngine, config);
  });

  gameEngine.onScreenResume('tutorial', () => {
    resumeGameplayClocks();
    showGameplayScreen('tutorial');
    updateGameplayOnboardingUI(gameEngine.getResource('gameplayOnboardingSession'));
  });

  gameEngine.onScreenEnter('levelComplete', pauseGameplayClocks);

  gameEngine.onScreenEnter('settings', ({ config }) => {
    pauseGameplayClocks();
    showSettingsScreen(config.returnTo);
  });

  function showGameOverScreen(): void {
    pauseGameplayClocks();
    setFinalTime(gameEngine.getResource('gameplayTimeSeconds'));
    showScreen('gameOver');
  }

  gameEngine.onScreenEnter('gameOver', showGameOverScreen);
  gameEngine.onScreenResume('gameOver', showGameOverScreen);
};

const registerSystems = async (): Promise<void> => {
  gameEngine.installPlugin(gameplayPlugin);
  gameEngine.installPlugin(gameplayOnboardingPlugin);

  addEquationFeedbackSystemToEngine();
  addPauseSystemToEngine();
  addUINavigationSystemToEngine();
  addInputPromptSystemToEngine();
  addLevelCompleteSystemToEngine();
  addRenderSystemToEngine();

  await initializeEngine();
};

export const initializeGame = async (): Promise<void> => {
  initializeUI(gameEngine);
  await registerSystems();
  setupScreenHooks();
  await gameEngine.setScreen('menu', {});
  startGameLoop();
};
