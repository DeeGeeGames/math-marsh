import { addControllerSelectionSystemToEngine, registerControllerRecoveryLifecycle } from './systems/ControllerSelectionSystem';
import { boardForDifficulty, TUTORIAL_BOARD } from './boardGeometry';
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
import { addFrogSpriteAnimationSystemToEngine } from './systems/FrogSpriteSystem';
import { registerFrogTongueInit } from './systems/FrogTongueSystem';
import { playerQuery } from './queries';
import {
  initializeUI,
  setRunResult,
  showGameplayScreen,
  showPauseScreen,
  showControllerRecoveryScreen,
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
import { addSplashSystemToEngine } from './systems/SplashSystem';
import { addSkitSystemToEngine } from './systems/SkitSystem';
import { updateSkitPresentation } from '../ui/screens/skitScreen';
import { skitById } from './skitSequence';
import { saveSkitProgress, unlockSkitForCompletedLevel } from './skitProgress';
import { STARTING_TIME_SECONDS } from './runTime';
import { enemyRosterForLevel, arcadeEnemyRosterForLevel } from './enemyRosters';
import { equationModeForMathSession, mathSessionForBoard } from './mathMode';
import type { GameEngine } from './Engine';
import { addMathProgressionSystemToEngine } from './systems/MathProgressionSystem';

const INACTIVE_SCREENS = ['studioSplash', 'engineSplash', 'menu', 'skitGallery', 'modeSelect', 'howToPlay', 'tutorialOffer'] as const;

const setupCanvas = (): void => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) throw new Error('Canvas element not found');
  initializeRenderSystem(canvas, () => gameEngine.getResource('board'));
};

const resetEnemySpawnSequence = (ecs: GameEngine): void => {
  const mathSession = ecs.getResource('mathSession');
  ecs.setResource('enemySpawn', {
    index: 0,
    roster: mathSession
      ? arcadeEnemyRosterForLevel(ecs.getResource('currentLevel'), ecs.getResource('mathDifficulty'))
      : enemyRosterForLevel(
          ecs.getResource('currentLevel'),
          ecs.getResource('mathDifficulty'),
        ),
  });

  const player = ecs.tryGetSingleton(playerQuery.with);
  if (!player) return;

  ecs.mutateComponent(player.id, 'timers', timers => {
    delete timers.enemySpawn;
  });
};

/**
 * Set up game state for a 'playing' screen entry.
 *
 * On fresh game: tear down any leftover player (e.g. from a prior gameOver)
 * and create a new one — the player is unscoped so it survives screen exits.
 * On level transition: leave the existing player so the run persists.
 */
const enterPlayingScreen = (ecs: GameEngine, { level, isFreshGame }: PlayingScreenConfig): void => {
  ecs.setResource('tapRequest', null);
  ecs.setResource('tapEat', null);
  ecs.setResource('tapFeedback', null);
  ecs.setResource('currentLevel', level);
  const gameMode = ecs.getResource('gameMode');
  const mathDifficulty = ecs.getResource('mathDifficulty');
  const session = ecs.getResource('mathSession');
  const mathSession = session ? mathSessionForBoard(session) : null;
  ecs.setResource('mathSession', mathSession);
  ecs.setResource('equationMode', mathSession
    ? equationModeForMathSession(mathSession, gameMode, level, 0, mathDifficulty)
    : createEquationModeState(level, mathDifficulty, gameMode));
  ecs.setResource('equationsSolvedThisBoard', 0);
  ecs.setResource('mathRoundCompletedThisBoard', false);
  ecs.setResource('mathRoundSummary', null);

  if (isFreshGame) {
    ecs.setResource('remainingTimeSeconds', STARTING_TIME_SECONDS);
    ecs.setResource('equationsSolved', 0);

    const existingPlayer = ecs.tryGetSingleton(playerQuery.with);
    if (existingPlayer) ecs.removeEntity(existingPlayer.id);

    const board = ecs.getResource('board');
    const playerPixelPos = gridToPixel(Math.floor(board.width / 2), Math.floor(board.height / 2));
    createPlayer(ecs, playerPixelPos.x, playerPixelPos.y);
  }

  resetEnemySpawnSequence(ecs);
};

/**
 * Wire screen lifecycle hooks. ECS screen state drives DOM, not vice versa.
 */
const setupScreenHooks = (): void => {
  registerGameplayClockLifecycle(gameEngine);
  registerControllerRecoveryLifecycle(gameEngine);
  gameEngine.onScreenEnter('controllerRecovery', showControllerRecoveryScreen);
  gameEngine.onScreenResume('levelComplete', () => showGameplayScreen('normal'));

  const registerInactiveScreen = (screen: (typeof INACTIVE_SCREENS)[number]): void => {
    function showInactiveScreen(): void {
      showScreen(screen);
    }

    gameEngine.onScreenEnter(screen, showInactiveScreen);
    gameEngine.onScreenResume(screen, showInactiveScreen);
  };

  const showSkit = function(): void {
    showScreen('skit');
    const state = gameEngine.getScreenState('skit');
    updateSkitPresentation(state.elapsed, skitById(state.skitId));
  };
  gameEngine.onScreenEnter('skit', showSkit);
  gameEngine.onScreenResume('skit', showSkit);

  gameEngine.onScreenEnter('levelComplete', ({ config, ecs }) => {
    const progress = ecs.getResource('skitProgress');
    const unlocked = unlockSkitForCompletedLevel(progress, config.completedLevel);
    if (unlocked === progress) return;
    ecs.setResource('skitProgress', unlocked);
    saveSkitProgress(unlocked);
  });

  INACTIVE_SCREENS.forEach(registerInactiveScreen);

  function showPausedScreen(): void {
    showPauseScreen();
  }

  gameEngine.onScreenEnter('paused', showPausedScreen);
  gameEngine.onScreenResume('paused', showPausedScreen);

  gameEngine.onScreenEnter('playing', ({ config, ecs }) => {
    gameEngine.setResource(
      'board',
      boardForDifficulty(ecs.getResource('mathDifficulty')),
    );
    showGameplayScreen('normal');
    setupCanvas();
    gameEngine.setResource('gameplayOnboardingSession', { active: false });
    enterPlayingScreen(ecs, config);
  });

  gameEngine.onScreenResume('playing', () => {
    showGameplayScreen('normal');
  });

  gameEngine.onScreenEnter('tutorial', ({ config }) => {
    gameEngine.setResource('board', TUTORIAL_BOARD);
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
  gameEngine.onScreenResume('settings', ({ config }) => {
    showSettingsScreen(config.returnTo);
  });

  function showGameOverScreen(): void {
    showScreen('gameOver');
    setRunResult(gameEngine.getResource('currentLevel'), gameEngine.getResource('equationsSolved'));
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
  addMathProgressionSystemToEngine(gameplaySystems);
  registerGameplayOnboardingSystem(tutorialSystems);
  addFrogSpriteAnimationSystemToEngine(gameEngine.systemScope({
    inScreens: ['playing', 'tutorial'],
  }));
  addUISystemToEngine(gameEngine.systemScope({
    inScreens: ['playing', 'tutorial'],
  }));
  registerFrogTongueInit(gameEngine);

  addEquationFeedbackSystemToEngine(gameEngine);
  addControllerSelectionSystemToEngine(gameEngine);
  addPauseSystemToEngine(gameEngine);
  addUINavigationSystemToEngine(gameEngine);
  addSplashSystemToEngine(gameEngine);
  addSkitSystemToEngine(gameEngine);
  addInputPromptSystemToEngine(gameEngine);
  addLevelCompleteSystemToEngine(gameEngine);
  addRenderSystemToEngine(gameEngine);

  await initializeEngine();
};

export const initializeGame = async (): Promise<void> => {
  initializeUI(gameEngine);
  await registerSystems();
  setupScreenHooks();
  await gameEngine.setScreen('studioSplash', {});
  startGameLoop();
};
