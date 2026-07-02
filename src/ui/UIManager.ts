import { gameEngine } from '../ecs/Engine';
import type { GameMode, MathDifficulty, SettingsReturnScreen } from '../ecs/types';
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
import {
  renderInputPromptBar,
  type InputPromptItem,
  type InputPromptPlatform,
} from './inputPrompts';
import { updateGameplayHud } from './gameplayHud';
import {
  gameplayLevelLabel,
  settingsBackLabels,
} from './labels';
import {
  createGameContainer,
  createScreenSpecs,
  resetModeSelect,
} from './screenSpecs';
import {
  DEFAULT_FOCUS_SELECTOR,
  type UIScreen,
} from './screenTypes';

export { gameplayLevelLabel };

let currentPromptPlatform: InputPromptPlatform = 'keyboard';

const syncFullscreenButton = (button: HTMLButtonElement): void => {
  const active = isFullscreenActive();
  button.setAttribute('aria-pressed', String(active));
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  button.setAttribute('aria-label', label);
  button.title = label;
};

const wireFullscreenButton = (button: HTMLButtonElement): void => {
  if (!isFullscreenSupported()) {
    button.style.display = 'none';
    return;
  }
  syncFullscreenButton(button);
  button.addEventListener('click', () => { void toggleFullscreen(); });
  onFullscreenChange(() => syncFullscreenButton(button));
};

const startGame = (mode: GameMode, difficulty: MathDifficulty): void => {
  gameEngine.setResource('mathDifficulty', difficulty);
  gameEngine.setResource('gameMode', mode);
  void gameEngine.setScreen('playing', {
    level: 1,
    isFreshGame: true,
  });
};

function returnToPreviousScreen(): void {
  void gameEngine.popScreen();
}

function goToMenu(): void {
  void gameEngine.setScreen('menu', {});
}

function openModeSelect(): void {
  void gameEngine.setScreen('modeSelect', {});
}

function openSettings(): void {
  const returnTo = gameEngine.getCurrentScreen();
  if (returnTo === null || returnTo === 'settings' || returnTo === 'levelComplete') return;
  void gameEngine.pushScreen('settings', { returnTo });
}

function pauseGame(): void {
  void gameEngine.pushScreen('paused', {});
}

function replayGame(): void {
  startGame(gameEngine.getResource('gameMode'), gameEngine.getResource('mathDifficulty'));
}

const SCREENS = createScreenSpecs({
  startGame,
  replayGame,
  returnToPreviousScreen,
  goToMenu,
  openModeSelect,
  openSettings,
  pauseGame,
  wireFullscreenButton,
  wireTouchControlsSetting: (root) => wireTouchControlsSetting(root, requestCanvasResize),
});

const gameContainer = createGameContainer();

applyTouchControlsVisibility();
// Re-evaluate auto mode if the primary pointer changes (e.g. window moved
// between a touchscreen and a regular monitor, or device rotated into a
// virtual-keyboard state).
window.matchMedia('(hover: none) and (pointer: coarse)').addEventListener('change', () => {
  applyTouchControlsVisibility();
  requestCanvasResize();
});

const screenElements = new Map<UIScreen, HTMLElement>();
let currentScreen: UIScreen = 'menu';

const renderPromptSlot = (root: HTMLElement, prompts: InputPromptItem[] | undefined): void => {
  const slot = root.querySelector<HTMLElement>('[data-input-prompts]');
  if (!slot || !prompts) return;
  slot.replaceChildren(renderInputPromptBar(currentPromptPlatform, prompts));
};

export const updateInputPromptPlatform = (platform: InputPromptPlatform): void => {
  currentPromptPlatform = platform;
  screenElements.forEach((root, screen) => renderPromptSlot(root, SCREENS[screen].prompts));
};

const createScreen = (screen: UIScreen): HTMLElement => {
  const spec = SCREENS[screen];
  const root = document.createElement('div');
  root.id = spec.id;
  root.className = spec.className;
  root.innerHTML = spec.html;
  renderPromptSlot(root, spec.prompts);
  spec.wire?.(root);
  gameContainer.appendChild(root);
  screenElements.set(screen, root);
  return root;
};

const getFocusables = (screen: UIScreen): HTMLElement[] => {
  const root = screenElements.get(screen);
  if (!root) return [];
  const selector = SCREENS[screen].focusSelector ?? DEFAULT_FOCUS_SELECTOR;
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
};

const focusFirstOn = (screen: UIScreen): void => {
  const [first] = getFocusables(screen);
  first?.focus();
};

export const showScreen = (screen: UIScreen): void => {
  screenElements.get(currentScreen)?.style.setProperty('display', 'none');
  const root = screenElements.get(screen) ?? createScreen(screen);
  root.style.display = 'flex';
  currentScreen = screen;
  if (screen === 'modeSelect') resetModeSelect(root);
  // Gameplay screen is driven by inputState, not DOM focus — leaving focus
  // there would show a focus ring on the pause button during play.
  if (screen !== 'playing') return focusFirstOn(screen);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  requestCanvasResize();
};

export function showSettingsScreen(returnTo: SettingsReturnScreen): void {
  showScreen('settings');
  const backButton = document.getElementById('back-to-menu-btn');
  if (!backButton) throw new Error('Settings back button not found');
  backButton.textContent = settingsBackLabels[returnTo];
}

const focusedIndex = (focusables: HTMLElement[]): number => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return -1;
  return focusables.indexOf(active);
};

export const navigateFocus = (direction: 'prev' | 'next'): void => {
  const focusables = getFocusables(currentScreen);
  if (focusables.length === 0) return;
  const current = focusedIndex(focusables);
  if (current < 0) {
    focusables[direction === 'next' ? 0 : focusables.length - 1]?.focus();
    return;
  }
  const offset = direction === 'next' ? 1 : -1;
  focusables[(current + offset + focusables.length) % focusables.length]?.focus();
};

export const activateFocus = (): void => {
  const focusables = getFocusables(currentScreen);
  const current = focusedIndex(focusables);
  const target = current >= 0 ? focusables[current] : focusables[0];
  target?.click();
};

export const triggerCancel = (): void => {
  SCREENS[currentScreen].onCancel?.();
};

export const updateGameplayUI = updateGameplayHud;

export const setFinalScore = (score: number): void => {
  const el = document.getElementById('final-score');
  if (el) el.textContent = `Final Score: ${score}`;
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
