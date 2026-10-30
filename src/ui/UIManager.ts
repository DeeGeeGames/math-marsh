import { isDemoArcadeComplete } from '../ecs/demoArcade';
import { openDesktopFullGame } from '../platform/desktop';
import type { InputPromptPlatform, NativePromptBindings } from './inputPrompts';
import { emptyPracticeProgress } from '../ecs/practiceProgress';
import { finishPractice } from '../ecs/practiceLifecycle';
import type { GameEngine } from '../ecs/Engine';
import type {
  SettingsReturnScreen,
} from '../ecs/types';
import {
  applyTouchControlsVisibility,
  hideAutoTouchControls,
  wireTouchControlsSetting,
} from './touchControls';
import {
  isFullscreenActive,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from './fullscreen';
import { requestCanvasResize, initializeRenderSystem, cleanupRenderSystem, getCtx } from '../ecs/systems/render/context';
import { updateGameplayHud } from './gameplayHud';
import {
  gameplayLevelLabel,
  settingsBackLabels,
} from './labels';
import {
  createScreenSpecs,
} from './screenSpecs';
import {
  getAudioSettings,
  playSound,
  setAudioScene,
  setAudioSettings,
  unlockAudio,
  type AudioScene,
} from '../audio/audio';
import { getDesktopFullscreenController, getDesktopQuitHandler } from '../platform/desktop';
import type { FocusDirection } from './spatialNavigation';
import type { UIScreen } from './screenTypes';
import type { ScreenPresentationOptions } from './screenRuntime';
import {
  nextGameplayOnboardingStep,
  previousGameplayOnboardingStep,
  skipGameplayOnboarding,
  startGameplayOnboarding,
  startNormalGame,
} from '../onboarding/gameplayOnboardingFlow';
import {
  TUTORIAL_PROMPT_SPEC,
  updateGameplayOnboardingUI,
} from '../onboarding/gameplayOnboardingUI';
import { createScreenRuntime } from './screenRuntime';
import { initialSavedMathProgress } from '../ecs/mathProgressStore';
import { activePlayerProfile, nextDefaultPlayerName } from '../profiles/rules';
import { type PlayerProfile, type PlayerProfilesState } from '../profiles/types';
import { boardPointGridCell, isPointOnLilyPad, isActiveLilyPadCell, activeLilyPadCellKeys } from '../ecs/lilyPads';

import { createRunActions } from '../application/runActions';
import { createProfileActions } from '../application/profileActions';
import { createNavigationActions } from '../application/navigationActions';
import { initializeTouchControlsLayout } from './touchLayout';
import { clearGameplayHud } from './gameplayHud';
export { gameplayLevelLabel };

let currentUI: ReturnType<typeof createUIIntegration> | undefined;

/** Owns the presentation runtime and all external UI subscriptions. Reinitializing replaces its owner. */
export function initializeUI(engine: GameEngine): () => void {
  currentUI?.dispose();
  const integration = createUIIntegration(engine);
  currentUI = integration;
  return integration.dispose;
}

const requireUI = function(): ReturnType<typeof createUIIntegration> {
  if (!currentUI) throw new Error('UIManager has not been initialized');
  return currentUI;
};

// Infer the integration's presentation surface from its explicitly typed methods.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createUIIntegration = function(engine: GameEngine) {
  let disposed = false;
  let boundCanvas: HTMLCanvasElement | undefined;
  const cleanups: (() => void)[] = [];
  document.documentElement.dataset.mobilePwa = String(
    getDesktopFullscreenController() === undefined
    && window.matchMedia('(hover: none)').matches
    && (window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches)
    && document.fullscreenElement === null,
  );
  const { startGame, selectMathStep, clearPlayerRun, replayGame, startPractice, openPractice } = createRunActions(engine, {
    playSound, startNormalGame: () => startNormalGame(engine),
  });
  const { openPlayerRoster, openPlayerAdd, openPlayerManagement, openPlayerRename, openPlayerDelete,
    createPlayer, switchPlayer, renamePlayer, deletePlayer } = createProfileActions(engine, {
    playSound, clearPlayerRun,
    focusRenamedProfile: function(profileId) {
      if (!disposed) screenRuntime.focus(`[data-rename-profile="${CSS.escape(profileId)}"]`);
    },
  });
  const { startTutorial, skipTutorial, nextTutorialStep, previousTutorialStep, returnToPreviousScreen,
    goToMenu, openModeSelect, openHowToPlay, openSettings, pauseGame, openSkitGallery, replaySkit, skipSkit } = createNavigationActions(engine, {
    playSound, finishPractice: () => finishPractice(engine),
    startGameplayOnboarding: () => startGameplayOnboarding(engine),
    skipGameplayOnboarding: () => skipGameplayOnboarding(engine),
    nextGameplayOnboardingStep: () => nextGameplayOnboardingStep(engine),
    previousGameplayOnboardingStep: () => previousGameplayOnboardingStep(engine),
  });
  const closePlayerScreen = function(focusSelector: string): void {
    void engine.popScreen().then(() => { if (!disposed) screenRuntime.focus(focusSelector); });
  };
  const syncFullscreenButton = (button: HTMLButtonElement): void => {
    const active = isFullscreenActive();
    button.setAttribute('aria-pressed', String(active));
    const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">${active
      ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>'
      : '<path d="M5 14h2v3h3v2H5v-5zm2-4H5V5h5v2H7v3zm7 7h3v-3h2v5h-5v-2zm3-7V7h-3V5h5v5h-2z"/>'}</svg>${button.id === 'pause-fullscreen-btn' ? ` Fullscreen: ${active ? 'On' : 'Off'}` : ''}`;
  };

  const wireFullscreenButton = (button: HTMLButtonElement): void => {
    button.classList.add('fullscreen-control');
    if (button.id !== 'pause-fullscreen-btn') button.classList.add('fullscreen-floating');
    if (!isFullscreenSupported()) {
      button.style.display = 'none';
      return;
    }
    syncFullscreenButton(button);
    button.addEventListener('click', () => {
      void toggleFullscreen().catch(() => { if (!disposed) syncFullscreenButton(button); });
    });
    cleanups.push(onFullscreenChange(() => syncFullscreenButton(button)));
  };

  const desktopQuit = getDesktopQuitHandler();
  const quitApplication = desktopQuit
    ? function quitApplication(): void {
        playSound('uiSelect');
        void desktopQuit();
      }
    : undefined;

  const SCREENS = createScreenSpecs({
    startGame,
    isLevelSelectionUnlocked: function(): boolean { return engine.getResource('levelSelectionUnlocked'); },
    startTutorial,
    skipTutorial,
    nextTutorialStep,
    previousTutorialStep,
    replayGame,
    isDemoArcadeComplete: () => isDemoArcadeComplete(engine.getResource('demoArcadeRun')),
    continueDemo: () => { void engine.setScreen('demoEnd', {}); },
    openFullGame: openDesktopFullGame,
    returnToPreviousScreen,
    goToMenu,
    openModeSelect,
    openPractice,
    startPractice,
    getPracticeSession: function() { return engine.getResource('practiceSession'); },
    getPracticeProgress: function() {
      return activePlayerProfile(engine.getResource('playerProfiles'))?.practiceProgress ?? emptyPracticeProgress();
    },
    getPracticePersistence: function() {
      const profiles = engine.getResource('playerProfiles');
      if (profiles.persistence === 'read-only') return 'read-only';
      return profiles.persistence === 'persistent' && activePlayerProfile(profiles)?.practiceProgress.canPersist
        ? 'persistent' : 'session-only';
    },
    repeatPractice: function(): void {
      const session = engine.getResource('practiceSession');
      if (session) startPractice(session.selection);
    },
    getMathProgress: function() {
      const profile = activePlayerProfile(engine.getResource('playerProfiles'));
      return profile?.mathProgress ?? initialSavedMathProgress();
    },
    getMathProgressPersistence: function() {
      return engine.getResource('playerProfiles').persistence;
    },
    selectMathStep,
    openHowToPlay,
    getPlayerProfiles: function(): PlayerProfilesState { return engine.getResource('playerProfiles'); },
    getPlayerActionProfile: function(): PlayerProfile | undefined {
      const screen = engine.getCurrentScreen();
      const profileId = screen === 'playerRename'
        ? engine.getScreenState('playerRename').profileId
        : screen === 'playerDelete' ? engine.getScreenState('playerDelete').profileId : undefined;
      return engine.getResource('playerProfiles').profiles.find(profile => profile.id === profileId);
    },
    getNextPlayerName: function(): string {
      return nextDefaultPlayerName(engine.getResource('playerProfiles').profiles);
    },
    openPlayerRoster,
    closePlayerScreen,
    openPlayerAdd,
    openPlayerManagement,
    openPlayerRename,
    openPlayerDelete,
    createPlayer,
    switchPlayer,
    renamePlayer,
    deletePlayer,
    openSkitGallery,
    getSkitProgress: function() {
      const profile = activePlayerProfile(engine.getResource('playerProfiles'));
      return profile?.skitProgress ?? [];
    },
    replaySkit,
    openSettings,
    quitApplication,
    pauseGame,
    skipSkit,
    wireFullscreenButton,
    wireTouchControlsSetting: (root) => wireTouchControlsSetting(root, requestCanvasResize),
    wireAudioSettings,
    tapBoardPoint: (point) => {
      if (engine.getCurrentScreen() !== 'playing') return;
      engine.setResource('tapRequest', point);
      const cell = boardPointGridCell(point, engine.getResource('board'));
      if (isPointOnLilyPad(point, cell)
        && isActiveLilyPadCell(cell, activeLilyPadCellKeys(engine.getEntitiesWithQuery(['position', 'mathProblem'])))) {
        hideAutoTouchControls();
        requestCanvasResize();
      }
    },
  });

  const screenRuntime = createScreenRuntime(SCREENS);

  applyTouchControlsVisibility();
  const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  const onTouchChange = function(): void {
    applyTouchControlsVisibility();
    requestCanvasResize();
  };
  touchQuery.addEventListener('change', onTouchChange);
  cleanups.push(() => touchQuery.removeEventListener('change', onTouchChange));
  (['pointerdown', 'keydown'] as const).forEach(function(eventName) {
    document.addEventListener(eventName, unlockAudio, { once: true });
    cleanups.push(() => document.removeEventListener(eventName, unlockAudio));
  });
  cleanups.push(initializeTouchControlsLayout());
  cleanups.push(engine.onResourceChange('gameplayOnboardingSession', updateGameplayOnboardingUI));

  function audioSceneForScreen(screen: UIScreen): AudioScene {
    if (screen === 'studioSplash' || screen === 'engineSplash') return 'silent';
    if (screen === 'skit') return 'cutscene';
    return screen === 'playing' ? 'game' : 'title';
  }

  function presentScreen(screen: UIScreen, options: ScreenPresentationOptions = {}): HTMLElement {
    const root = screenRuntime.presentScreen(screen, options);
    setAudioScene(audioSceneForScreen(screen));
    if (screen === 'playing') {
      const canvas = root.querySelector<HTMLCanvasElement>('#game-canvas');
      if (!canvas) throw new Error('Canvas element not found');
      if (boundCanvas !== canvas) {
        initializeRenderSystem(canvas, () => engine.getResource('board'));
        boundCanvas = canvas;
      }
      requestCanvasResize();
    }
    return root;
  }

  function showScreen(screen: UIScreen, options: ScreenPresentationOptions = {}): void {
    presentScreen(screen, options);
  }

  function showGameplayScreen(mode: 'normal' | 'tutorial'): void {
    screenRuntime.setPromptOverride(
      'playing',
      mode === 'tutorial' ? TUTORIAL_PROMPT_SPEC : undefined,
    );
    showScreen('playing');
    if (mode === 'tutorial') {
      updateGameplayOnboardingUI(engine.getResource('gameplayOnboardingSession'));
    }
  }

  function showControllerRecoveryScreen(): void {
    presentScreen('controllerRecovery', { retainGameplay: true });
  }

  function showPauseScreen(): void {
    presentScreen('paused', { retainGameplay: true });
  }

  function showSettingsScreen(returnTo: SettingsReturnScreen): void {
    const retainsGameplay = returnTo === 'paused';
    const root = presentScreen('settings', { retainGameplay: retainsGameplay });
    root.classList.toggle('app-background', !retainsGameplay);
    root.classList.toggle('contextual-gameplay-overlay', retainsGameplay);
    const backButton = document.getElementById('back-to-menu-btn');
    if (!backButton) throw new Error('Settings back button not found');
    backButton.textContent = settingsBackLabels[returnTo];
  }

  const updateInputPromptPlatform = screenRuntime.updateInputPromptPlatform;
  const showNavigationFocus = screenRuntime.showNavigationFocus;

  function navigateFocus(direction: FocusDirection): void {
    screenRuntime.navigateFocus(direction);
  }

  const activateFocus = screenRuntime.activateFocus;

  const triggerCancel = screenRuntime.triggerCancel;

  // UI-only shortcuts. Gameplay input (movement, eat, pause) lives in the ECS input plugin.
  const keyActions: Record<string, (event: KeyboardEvent) => void> = {
    F1: (event) => {
      event.preventDefault();
      openSettings();
    },
  };

  const onKeyDown = function(event: KeyboardEvent): void { keyActions[event.code]?.(event); };
  document.addEventListener('keydown', onKeyDown);
  cleanups.push(() => document.removeEventListener('keydown', onKeyDown));

  function wireAudioSettings(root: ParentNode): void {
    const effects = root.querySelector<HTMLInputElement>('#sound-effects');
    const music = root.querySelector<HTMLInputElement>('#background-music');
    if (!effects || !music) return;

    const settings = getAudioSettings();
    effects.checked = settings.soundEffects;
    music.checked = settings.backgroundMusic;

    const updateSettings = (): void => {
      setAudioSettings({
        soundEffects: effects.checked,
        backgroundMusic: music.checked,
      });
    };

    effects.addEventListener('change', updateSettings);
    music.addEventListener('change', updateSettings);
  }

  const revealLevelSelection = function(): void {
    if (screenRuntime.revealLevelSelection()) playSound('uiSelect');
  };

  const dispose = function(): void {
    if (disposed) return;
    disposed = true;
    cleanups.splice(0).reverse().forEach(function(cleanup) { cleanup(); });
    if (boundCanvas && getCtx()?.canvas === boundCanvas) cleanupRenderSystem();
    boundCanvas = undefined;
    screenRuntime.dispose();
    clearGameplayHud();
    if (currentUI?.dispose === dispose) currentUI = undefined;
  };
  return { dispose, showScreen, showGameplayScreen, showControllerRecoveryScreen, showPauseScreen, showSettingsScreen, updateInputPromptPlatform, showNavigationFocus, navigateFocus, activateFocus, triggerCancel, revealLevelSelection };
};

export const showScreen = function(screen: UIScreen, options: ScreenPresentationOptions = {}): void {
  requireUI().showScreen(screen, options);
};
export const showGameplayScreen = function(mode: 'normal' | 'tutorial'): void { requireUI().showGameplayScreen(mode); };
export const showControllerRecoveryScreen = function(): void { requireUI().showControllerRecoveryScreen(); };
export const showPauseScreen = function(): void { requireUI().showPauseScreen(); };
export const showSettingsScreen = function(returnTo: SettingsReturnScreen): void { requireUI().showSettingsScreen(returnTo); };
export const updateInputPromptPlatform = function(platform: InputPromptPlatform, nativeBindings?: NativePromptBindings): void {
  requireUI().updateInputPromptPlatform(platform, nativeBindings);
};
export const navigateFocus = function(direction: FocusDirection): void { requireUI().navigateFocus(direction); };
export const showNavigationFocus = function(): void { requireUI().showNavigationFocus(); };
export const activateFocus = function(): void { requireUI().activateFocus(); };
export const triggerCancel = function(): void { requireUI().triggerCancel(); };
export const revealLevelSelection = function(): void { requireUI().revealLevelSelection(); };
export const updateGameplayUI = updateGameplayHud;

export const setRunResult = (level: number, equationsSolved: number, demoComplete = false): void => {
  const el = document.getElementById('run-result');
  if (el) el.textContent = `${demoComplete ? '5 rounds cleared' : `Level ${level}`} · ${equationsSolved} equation${equationsSolved === 1 ? '' : 's'} solved`;
};
