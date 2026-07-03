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
import { initializeUI, showScreen, showSettingsScreen, setFinalScore } from '../ui/UIManager';
import { createEquationModeState } from '../math/equations';
import { addLevelCompleteSystemToEngine } from './systems/LevelCompleteSystem';

const GAMEPLAY_CLOCK_GROUPS = ['timers', 'tweens', 'coroutines'] as const;

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
 * On level transition: leave the existing player so score and lives persist.
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
  const registerInactiveScreen = (screen: 'menu' | 'modeSelect' | 'paused'): void => {
    function showInactiveScreen(): void {
      pauseGameplayClocks();
      showScreen(screen);
    }

    gameEngine.onScreenEnter(screen, showInactiveScreen);
    gameEngine.onScreenResume(screen, showInactiveScreen);
  };

  (['menu', 'modeSelect', 'paused'] as const).forEach(registerInactiveScreen);

  gameEngine.onScreenEnter('playing', ({ config }) => {
    resumeGameplayClocks();
    showScreen('playing');
    setupCanvas();
    enterPlayingScreen(config);
  });

  gameEngine.onScreenResume('playing', () => {
    resumeGameplayClocks();
    showScreen('playing');
  });

  gameEngine.onScreenEnter('levelComplete', pauseGameplayClocks);

  gameEngine.onScreenEnter('settings', ({ config }) => {
    pauseGameplayClocks();
    showSettingsScreen(config.returnTo);
  });

  function showGameOverScreen(): void {
    pauseGameplayClocks();
    const player = gameEngine.tryGetSingleton(playerQuery.with);
    setFinalScore(player?.components.player.score ?? 0);
    showScreen('gameOver');
  }

  gameEngine.onScreenEnter('gameOver', showGameOverScreen);
  gameEngine.onScreenResume('gameOver', showGameOverScreen);
};

const registerSystems = async (): Promise<void> => {
  gameEngine.installPlugin(gameplayPlugin);

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
