import type { GameEngine } from '../ecs/Engine';
import type {
  GameMode,
  MathDifficulty,
  SettingsReturnScreen,
  TutorialScreenConfig,
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
import {
  renderInputPromptBar,
  type InputPromptPlatform,
} from './inputPrompts';
import { formatElapsedTime, updateGameplayHud } from './gameplayHud';
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
  type ScreenSpec,
  type UIScreen,
} from './screenTypes';
import {
  getAudioSettings,
  playSound,
  setAudioScene,
  setAudioSettings,
  unlockAudio,
} from '../audio/audio';
import { getDesktopQuitHandler } from '../platform/desktop';
import { render } from 'lit-html';
import {
  findSpatialTargetIndex,
  type FocusDirection,
  type SpatialRect,
} from './spatialNavigation';
import {
  completedOnboardingCompletion,
  saveOnboardingCompletion,
  skippedOnboardingCompletion,
  tutorialStepIndex,
  tutorialSteps,
  type GameplayOnboardingCompletion,
  type GameplayOnboardingKind,
  type GameplayOnboardingSession,
} from '../onboarding/gameplayOnboarding';

export { gameplayLevelLabel };

let currentPromptPlatform: InputPromptPlatform = 'keyboard';
let uiEngine: GameEngine | undefined;

export function initializeUI(engine: GameEngine): void {
  uiEngine = engine;
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

function startNormalGame(): void {
  void requireEngine().setScreen('playing', {
    level: 1,
    isFreshGame: true,
  });
}

const startGame = (mode: GameMode, difficulty: MathDifficulty): void => {
  const engine = requireEngine();
  playSound('uiSelect');
  engine.setResource('mathDifficulty', difficulty);
  engine.setResource('gameMode', mode);
  if (engine.getResource('gameplayOnboardingCompletion') === 'pending') {
    void engine.setScreen('tutorialOffer', {});
    return;
  }
  startNormalGame();
};

function startTutorial(): void {
  const engine = requireEngine();
  const isFirstRun = engine.getCurrentScreen() === 'tutorialOffer';
  playSound('uiSelect');
  const config: TutorialScreenConfig = {
    kind: 'basics',
    isReplay: engine.getResource('gameplayOnboardingCompletion') !== 'pending',
    returnTo: isFirstRun
      ? { kind: 'newGame' }
      : { kind: 'nextTutorial' },
  };
  if (isFirstRun) {
    void engine.setScreen('tutorial', config);
    return;
  }
  void engine.pushScreen('tutorial', config);
}

const ONBOARDING_COMPLETION_RESOURCES = {
  basics: 'gameplayOnboardingCompletion',
  operands: 'operandOnboardingCompletion',
} as const;

const onboardingCompletion = (
  engine: GameEngine,
  kind: GameplayOnboardingKind,
): GameplayOnboardingCompletion => engine.getResource(ONBOARDING_COMPLETION_RESOURCES[kind]);

async function continueToOperandTutorial(engine: GameEngine): Promise<void> {
  await engine.popScreen();
  await engine.pushScreen('tutorial', {
    kind: 'operands',
    isReplay: true,
    returnTo: { kind: 'previousScreen' },
  });
}

function continueAfterTutorial(
  session: Extract<GameplayOnboardingSession, { active: true }>,
): void {
  const engine = requireEngine();
  if (session.returnTo.kind === 'nextTutorial') {
    void continueToOperandTutorial(engine);
    return;
  }
  if (session.returnTo.kind === 'previousScreen') {
    void engine.popScreen();
    return;
  }
  if (session.returnTo.kind === 'newGame') {
    startNormalGame();
    return;
  }

  const player = engine.tryGetSingleton(['player', 'position', 'health', 'pathFollower'] as const);
  const snapshot = session.playerSnapshot;
  if (!player || !snapshot) throw new Error('Operand tutorial cannot restore the active player');
  Object.assign(player.components.position, snapshot.position);
  player.components.player.lives = snapshot.lives;
  player.components.player.gameOverPending = snapshot.gameOverPending;
  Object.assign(player.components.health, snapshot.health);
  Object.assign(player.components.pathFollower, snapshot.pathFollower, {
    breadcrumbs: snapshot.pathFollower.breadcrumbs.map(point => ({ ...point })),
  });
  (['tween', 'spriteAnimation', 'shake'] as const).forEach(component => {
    if (engine.hasComponent(player.id, component)) engine.commands.removeComponent(player.id, component);
  });
  void engine.setScreen('playing', {
    level: session.returnTo.level,
    isFreshGame: false,
  });
}

export function skipGameplayOnboarding(): void {
  const engine = requireEngine();
  const session = engine.getResource('gameplayOnboardingSession');
  const kind = session.active ? session.kind : 'basics';
  const current = onboardingCompletion(engine, kind);
  const next = skippedOnboardingCompletion(current);
  playSound('uiSelect');
  engine.setResource(ONBOARDING_COMPLETION_RESOURCES[kind], next);
  if (next === 'skipped' && current !== 'skipped') saveOnboardingCompletion(kind, 'skipped');
  if (!session.active) {
    startNormalGame();
    return;
  }
  if (session.returnTo.kind === 'nextTutorial') {
    void engine.popScreen();
    return;
  }
  continueAfterTutorial(session);
}

function completeTutorial(): void {
  const engine = requireEngine();
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  const current = onboardingCompletion(engine, session.kind);
  const next = completedOnboardingCompletion(current);
  playSound('uiSelect');
  engine.setResource(ONBOARDING_COMPLETION_RESOURCES[session.kind], next);
  if (next === 'completed' && current !== 'completed') {
    saveOnboardingCompletion(session.kind, 'completed');
  }
  continueAfterTutorial(session);
}

function setGameplayOnboardingStep(stepIndex: number): void {
  const engine = requireEngine();
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  engine.setResource('gameplayOnboardingSession', {
    ...session,
    stepIndex: tutorialStepIndex(session.kind, stepIndex),
  });
}

export function nextGameplayOnboardingStep(): void {
  const session = requireEngine().getResource('gameplayOnboardingSession');
  if (!session.active) return;
  if (session.stepIndex >= tutorialSteps(session.kind).length - 1) {
    completeTutorial();
    return;
  }
  playSound('uiSelect');
  setGameplayOnboardingStep(session.stepIndex + 1);
}

export function previousGameplayOnboardingStep(): void {
  const session = requireEngine().getResource('gameplayOnboardingSession');
  if (!session.active) return;
  if (session.stepIndex === 0) {
    skipGameplayOnboarding();
    return;
  }
  playSound('uiBack');
  setGameplayOnboardingStep(session.stepIndex - 1);
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
    || returnTo === 'settings'
    || returnTo === 'levelComplete'
    || returnTo === 'tutorialOffer'
  ) return;
  playSound('uiSelect');
  void engine.pushScreen('settings', { returnTo });
}

function pauseGame(): void {
  playSound('uiSelect');
  void requireEngine().pushScreen('paused', {});
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
  skipTutorial: skipGameplayOnboarding,
  nextTutorialStep: nextGameplayOnboardingStep,
  previousTutorialStep: previousGameplayOnboardingStep,
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
  wireAudioSettings: (root) => wireAudioSettings(root),
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

(['pointerdown', 'keydown'] as const).forEach(eventName => {
  document.addEventListener(eventName, unlockAudio, { once: true });
});

const screenElements = new Map<UIScreen, HTMLElement>();
let currentScreen: UIScreen = 'menu';
let tutorialPromptsActive = false;

const TUTORIAL_PROMPT_SPEC = {
  prompts: [
    { action: 'select', label: 'Next' },
    { action: 'back', label: 'Back' },
    { action: 'skip', label: 'Skip' },
  ],
  promptPlacement: 'hud',
} as const satisfies Pick<ScreenSpec, 'prompts' | 'promptPlacement'>;

const TUTORIAL_FINISH_LABELS = {
  level: 'Start Level 2',
  nextTutorial: 'Next Tutorial',
  previousScreen: 'Finish Tutorial',
  newGame: 'Start Playing',
} as const;

function promptSpecForScreen(screen: UIScreen): Pick<ScreenSpec, 'prompts' | 'promptPlacement'> {
  if (screen === 'playing' && tutorialPromptsActive) return TUTORIAL_PROMPT_SPEC;
  return SCREENS[screen];
}

const renderPromptSlot = (
  root: HTMLElement,
  spec: Pick<ScreenSpec, 'prompts' | 'promptPlacement'>,
): void => {
  const slot = root.querySelector<HTMLElement>('[data-input-prompts]');
  if (!slot || !spec.prompts) return;
  slot.classList.add(`input-prompts-slot--${spec.promptPlacement}`);
  slot.dataset.inputPromptPlacement = spec.promptPlacement;
  slot.replaceChildren(renderInputPromptBar(currentPromptPlatform, spec.prompts));
};

export const updateInputPromptPlatform = (platform: InputPromptPlatform): void => {
  currentPromptPlatform = platform;
  screenElements.forEach((root, screen) => renderPromptSlot(root, promptSpecForScreen(screen)));
};

const createScreen = (screen: UIScreen): HTMLElement => {
  const spec = SCREENS[screen];
  const root = document.createElement('div');
  root.id = spec.id;
  root.className = spec.className;
  if (typeof spec.html === 'string') root.innerHTML = spec.html;
  else render(spec.html, root);
  renderPromptSlot(root, promptSpecForScreen(screen));
  spec.wire?.(root);
  gameContainer.appendChild(root);
  screenElements.set(screen, root);
  return root;
};

const getFocusables = (screen: UIScreen): HTMLElement[] => {
  const root = screenElements.get(screen);
  if (!root) return [];
  const selector = SCREENS[screen].focusSelector ?? DEFAULT_FOCUS_SELECTOR;
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
};

const focusElement = (element: HTMLElement | undefined): void => {
  if (!element) return;
  element.focus();
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

const focusFirstOn = (screen: UIScreen): void => {
  const [first] = getFocusables(screen);
  focusElement(first);
};

export const showScreen = (screen: UIScreen): void => {
  screenElements.get(currentScreen)?.style.setProperty('display', 'none');
  const root = screenElements.get(screen) ?? createScreen(screen);
  root.style.display = 'flex';
  currentScreen = screen;
  setAudioScene(screen === 'playing' ? 'game' : 'title');
  if (screen === 'modeSelect') resetModeSelect(root);
  // Gameplay screen is driven by inputState, not DOM focus — leaving focus
  // there would show a focus ring on the pause button during play.
  if (screen !== 'playing') return focusFirstOn(screen);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  requestCanvasResize();
};

export function showGameplayScreen(mode: 'normal' | 'tutorial'): void {
  tutorialPromptsActive = mode === 'tutorial';
  showScreen('playing');
  const root = screenElements.get('playing');
  if (root) renderPromptSlot(root, promptSpecForScreen('playing'));
}

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

const spatialRect = (element: HTMLElement): SpatialRect => {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return { left, right, top, bottom };
};

export const navigateFocus = (direction: FocusDirection): void => {
  const focusables = getFocusables(currentScreen);
  if (focusables.length === 0) return;
  const current = focusedIndex(focusables);
  if (current < 0) {
    focusElement(focusables[0]);
    return;
  }
  const target = findSpatialTargetIndex(focusables.map(spatialRect), current, direction);
  if (target === null) return;
  focusElement(focusables[target]);
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

export function updateGameplayOnboardingUI(session: GameplayOnboardingSession): void {
  const panel = document.getElementById('gameplay-onboarding');
  if (!panel) return;
  panel.classList.toggle('hidden', !session.active);
  panel.closest('#gameplay-ui')?.classList.toggle('tutorial-mode', session.active);
  const pauseButton = document.getElementById('pause-btn');
  if (pauseButton) pauseButton.hidden = session.active;
  if (!session.active) return;

  const steps = tutorialSteps(session.kind);
  const step = steps[session.stepIndex];
  if (!step) throw new Error(`Unknown tutorial step: ${session.stepIndex}`);
  const kicker = document.getElementById('gameplay-onboarding-kicker');
  const title = document.getElementById('gameplay-onboarding-title');
  const description = document.getElementById('gameplay-onboarding-copy');
  const backButton = document.getElementById('tutorial-back-btn');
  const nextButton = document.getElementById('tutorial-next-btn');
  if (!kicker || !title || !description || !backButton || !nextButton) {
    throw new Error('Gameplay onboarding UI is incomplete');
  }
  kicker.textContent = `Step ${session.stepIndex + 1} of ${steps.length}`;
  title.textContent = step.title;
  description.textContent = step.copy;
  backButton.toggleAttribute('disabled', session.stepIndex === 0);
  nextButton.textContent = session.stepIndex === steps.length - 1
    ? TUTORIAL_FINISH_LABELS[session.returnTo.kind]
    : 'Next';
}

export const setFinalTime = (elapsedSeconds: number): void => {
  const el = document.getElementById('final-time');
  if (el) el.textContent = `Final Time: ${formatElapsedTime(elapsedSeconds)}`;
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
