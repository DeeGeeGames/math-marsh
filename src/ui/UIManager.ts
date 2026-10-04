import type { GameEngine } from '../ecs/Engine';
import type {
  GameMode,
  MathDifficulty,
  SettingsReturnScreen,
} from '../ecs/types';
import {
  applyTouchControlsVisibility,
  wireTouchControlsSetting,
} from './touchControls';
import {
  isFullscreenActive,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from './fullscreen';
import { requestCanvasResize } from '../ecs/systems/render/context';
import { updateGameplayHud } from './gameplayHud';
import {
  gameplayLevelLabel,
  settingsBackLabels,
} from './labels';
import {
  createScreenSpecs,
  resetModeSelect,
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
import { playerQuery } from '../ecs/queries';

export { gameplayLevelLabel };

let uiEngine: GameEngine | undefined;
let stopObservingGameplayOnboarding: (() => void) | undefined;

export function initializeUI(engine: GameEngine): void {
  stopObservingGameplayOnboarding?.();
  uiEngine = engine;
  // Capture installed mode before a browser fullscreen request can change it.
  document.documentElement.dataset.mobilePwa = String(
    getDesktopFullscreenController() === undefined
    && window.matchMedia('(hover: none)').matches
    && (window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches)
    && document.fullscreenElement === null,
  );
  stopObservingGameplayOnboarding = engine.onResourceChange(
    'gameplayOnboardingSession',
    updateGameplayOnboardingUI,
  );
}

const requireEngine = (): GameEngine => {
  if (!uiEngine) throw new Error('UIManager engine has not been initialized');
  return uiEngine;
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
    void toggleFullscreen().catch(() => syncFullscreenButton(button));
  });
  onFullscreenChange(() => syncFullscreenButton(button));
};

const startGame = (mode: GameMode, difficulty: MathDifficulty): void => {
  const engine = requireEngine();
  playSound('uiSelect');
  engine.setResource('mathDifficulty', difficulty);
  engine.setResource('gameMode', mode);
  if (engine.getResource('gameplayOnboardingCompletion') === 'pending') {
    void engine.setScreen('tutorialOffer', {});
    return;
  }
  startNormalGame(engine);
};

function startTutorial(): void {
  startGameplayOnboarding(requireEngine());
}

function skipTutorial(): void {
  skipGameplayOnboarding(requireEngine());
}

function nextTutorialStep(): void {
  nextGameplayOnboardingStep(requireEngine());
}

function previousTutorialStep(): void {
  previousGameplayOnboardingStep(requireEngine());
}

function returnToPreviousScreen(): void {
  playSound('uiBack');
  void requireEngine().popScreen();
}

function goToMenu(): void {
  playSound('uiBack');
  void requireEngine().setScreen('menu', {});
}

function openModeSelect(): void {
  playSound('uiSelect');
  void requireEngine().setScreen('modeSelect', {});
}

function openHowToPlay(): void {
  playSound('uiSelect');
  void requireEngine().setScreen('howToPlay', {});
}

function openSettings(): void {
  const engine = requireEngine();
  const returnTo = engine.getCurrentScreen();
  if (
    returnTo === null
    || returnTo === 'studioSplash'
    || returnTo === 'engineSplash'
    || returnTo === 'settings'
    || returnTo === 'levelComplete'
    || returnTo === 'tutorialOffer'
  ) return;
  playSound('uiSelect');
  void engine.pushScreen('settings', { returnTo });
}

function pauseGame(): void {
  const engine = requireEngine();
  const player = engine.tryGetSingleton(playerQuery.with);
  if (!player || player.components.player.gameOverPending) return;
  playSound('uiSelect');
  void engine.pushScreen('paused', {});
}

function replayGame(): void {
  const engine = requireEngine();
  startGame(engine.getResource('gameMode'), engine.getResource('mathDifficulty'));
}

const desktopQuit = getDesktopQuitHandler();
const quitApplication = desktopQuit
  ? function quitApplication(): void {
      playSound('uiSelect');
      void desktopQuit();
    }
  : undefined;

const SCREENS = createScreenSpecs({
  startGame,
  startTutorial,
  skipTutorial,
  nextTutorialStep,
  previousTutorialStep,
  replayGame,
  returnToPreviousScreen,
  goToMenu,
  openModeSelect,
  openHowToPlay,
  openSettings,
  quitApplication,
  pauseGame,
  wireFullscreenButton,
  wireTouchControlsSetting: (root) => wireTouchControlsSetting(root, requestCanvasResize),
  wireAudioSettings,
  tapBoardPoint: (point) => {
    const engine = requireEngine();
    if (engine.getCurrentScreen() !== 'playing') return;
    engine.setResource('tapRequest', point);
  },
});

const screenRuntime = createScreenRuntime(SCREENS);

applyTouchControlsVisibility();
// Re-evaluate auto mode if the primary pointer changes (e.g. window moved
// between a touchscreen and a regular monitor, or device rotated into a
// virtual-keyboard state).
window.matchMedia('(hover: none) and (pointer: coarse)').addEventListener('change', () => {
  applyTouchControlsVisibility();
  requestCanvasResize();
});

(['pointerdown', 'keydown'] as const).forEach(eventName => {
  document.addEventListener(eventName, unlockAudio, { once: true });
});

function audioSceneForScreen(screen: UIScreen): AudioScene {
  if (screen === 'studioSplash' || screen === 'engineSplash') return 'silent';
  return screen === 'playing' ? 'game' : 'title';
}

function presentScreen(screen: UIScreen, retainGameplay: boolean): HTMLElement {
  const root = screenRuntime.presentScreen(screen, retainGameplay);
  setAudioScene(audioSceneForScreen(screen));
  if (screen === 'modeSelect') resetModeSelect(root);
  if (screen === 'playing') requestCanvasResize();
  return root;
}

export function showScreen(screen: UIScreen): void {
  presentScreen(screen, false);
}

export function showGameplayScreen(mode: 'normal' | 'tutorial'): void {
  screenRuntime.setPromptOverride(
    'playing',
    mode === 'tutorial' ? TUTORIAL_PROMPT_SPEC : undefined,
  );
  showScreen('playing');
}

export function showPauseScreen(): void {
  presentScreen('paused', true);
}

export function showSettingsScreen(returnTo: SettingsReturnScreen): void {
  const retainsGameplay = returnTo === 'paused';
  const root = presentScreen('settings', retainsGameplay);
  root.classList.toggle('app-background', !retainsGameplay);
  root.classList.toggle('contextual-gameplay-overlay', retainsGameplay);
  const backButton = document.getElementById('back-to-menu-btn');
  if (!backButton) throw new Error('Settings back button not found');
  backButton.textContent = settingsBackLabels[returnTo];
}

export const updateInputPromptPlatform = screenRuntime.updateInputPromptPlatform;

export function navigateFocus(direction: FocusDirection): void {
  screenRuntime.navigateFocus(direction);
}

export const activateFocus = screenRuntime.activateFocus;

export const triggerCancel = screenRuntime.triggerCancel;

export const updateGameplayUI = updateGameplayHud;

export const setRunResult = (level: number, equationsSolved: number): void => {
  const el = document.getElementById('run-result');
  if (el) el.textContent = `Level ${level} · ${equationsSolved} equation${equationsSolved === 1 ? '' : 's'} solved`;
};

// UI-only shortcuts. Gameplay input (movement, eat, pause) lives in the ECS input plugin.
const keyActions: Record<string, (event: KeyboardEvent) => void> = {
  F1: (event) => {
    event.preventDefault();
    openSettings();
  },
};

document.addEventListener('keydown', (event) => {
  keyActions[event.code]?.(event);
});

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
