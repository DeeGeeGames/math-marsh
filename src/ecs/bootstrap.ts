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
import { registerGameplaySystems } from './gameplayPlugin';
import { registerFrogTongueInit } from './systems/FrogTongueSystem';
import { playerQuery } from './queries';
import {
  initializeUI,
  setFinalTime,
  showGameplayScreen,
  showPauseScreen,
  showScreen,
  showSettingsScreen,
} from '../ui/UIManager';
import { createEquationModeState } from '../math/equations';
import { addLevelCompleteSystemToEngine } from './systems/LevelCompleteSystem';
import {
  registerGameplayOnboardingSystem,
} from '../onboarding/gameplayOnboardingSystem';
import { setupScriptedTutorialScene } from '../onboarding/gameplayOnboardingScene';
import { registerGameplayClockLifecycle } from './gameplayClockLifecycle';
import { addUISystemToEngine } from './systems/UISystem';

const INACTIVE_SCREENS = ['menu', 'modeSelect', 'howToPlay', 'tutorialOffer'] as const;

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
  gameEngine.setResource('tapRequest', null);
  gameEngine.setResource('tapEat', null);
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
  registerGameplayClockLifecycle(gameEngine);

  const registerInactiveScreen = (screen: (typeof INACTIVE_SCREENS)[number]): void => {
    function showInactiveScreen(): void {
      showScreen(screen);
    }

    gameEngine.onScreenEnter(screen, showInactiveScreen);
    gameEngine.onScreenResume(screen, showInactiveScreen);
  };

  INACTIVE_SCREENS.forEach(registerInactiveScreen);

  function showPausedScreen(): void {
    showPauseScreen();
  }

  gameEngine.onScreenEnter('paused', showPausedScreen);
  gameEngine.onScreenResume('paused', showPausedScreen);

  gameEngine.onScreenEnter('playing', ({ config }) => {
    showGameplayScreen('normal');
    setupCanvas();
    gameEngine.setResource('gameplayOnboardingSession', { active: false });
    enterPlayingScreen(config);
  });

  gameEngine.onScreenResume('playing', () => {
    showGameplayScreen('normal');
  });

  gameEngine.onScreenEnter('tutorial', ({ config }) => {
    showGameplayScreen('tutorial');
    setupCanvas();
    setupScriptedTutorialScene(gameEngine, config);
  });

  gameEngine.onScreenResume('tutorial', () => {
    showGameplayScreen('tutorial');
  });

  gameEngine.onScreenEnter('settings', ({ config }) => {
    showSettingsScreen(config.returnTo);
  });

  function showGameOverScreen(): void {
    setFinalTime(gameEngine.getResource('gameplayTimeSeconds'));
    showScreen('gameOver');
  }

  gameEngine.onScreenEnter('gameOver', showGameOverScreen);
  gameEngine.onScreenResume('gameOver', showGameOverScreen);
};

const registerSystems = async (): Promise<void> => {
  const gameplaySystems = gameEngine.systemScope({
    inScreens: ['playing'],
  });
  const tutorialSystems = gameEngine.systemScope({
    inScreens: ['tutorial'],
  });

  registerGameplaySystems(gameplaySystems);
  registerGameplayOnboardingSystem(tutorialSystems);
  addUISystemToEngine(gameEngine.systemScope({
    inScreens: ['playing', 'tutorial'],
  }));
  registerFrogTongueInit(gameEngine);

  addEquationFeedbackSystemToEngine(gameEngine);
  addPauseSystemToEngine(gameEngine);
  addUINavigationSystemToEngine(gameEngine);
  addInputPromptSystemToEngine(gameEngine);
  addLevelCompleteSystemToEngine(gameEngine);
  addRenderSystemToEngine(gameEngine);

  await initializeEngine();
};

export const initializeGame = async (): Promise<void> => {
  initializeUI(gameEngine);
  await registerSystems();
  setupScreenHooks();
  await gameEngine.setScreen('menu', {});
  startGameLoop();
};
