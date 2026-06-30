import { gameEngine } from '../ecs/Engine';
import type { GameMode, MathDifficulty, SettingsReturnScreen } from '../ecs/types';
import {
  applyTouchControlsVisibility,
  bindTouchControls,
  isMode,
  loadTouchControlsMode,
  saveTouchControlsMode,
  type TouchControlsMode,
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
import flyMoveToward from '../assets/images/fly-move-toward.png';
import frogHopToward from '../assets/images/frog-hop-toward.png';
import lizardWalkToward from '../assets/lizard-walk-toward.png';
import spiderWalkToward from '../assets/spider-walk-toward.png';

type UIScreen = SettingsReturnScreen | 'settings';

const OVERLAY_BASE =
  'absolute inset-0 flex flex-col items-center justify-center text-white z-50 overflow-y-auto overscroll-contain overlay-safe-padding';
const BTN_CHROME =
  'text-white border-none rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl btn-mobile';
const BTN_SIZE = {
  lgResponsive: 'px-8 md:px-12 py-4 md:py-5 text-lg md:text-xl font-semibold',
  mdResponsive: 'px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium',
  lg: 'px-8 py-4 text-lg font-semibold',
  md: 'px-6 py-3 text-base font-medium',
} as const;

type ScreenSpec = {
  id: string;
  className: string;
  html: string;
  prompts?: InputPromptItem[];
  wire?: (root: HTMLElement) => void;
  focusSelector?: string;
  onCancel?: () => void;
};

const DEFAULT_FOCUS_SELECTOR = 'button:not(:disabled), [data-focusable]:not(.disabled)';
let currentPromptPlatform: InputPromptPlatform = 'keyboard';

const refreshTouchModeButtons = (root: ParentNode, mode: TouchControlsMode): void => {
  const buttons = root.querySelectorAll<HTMLButtonElement>('.touch-mode-btn');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.touchMode === mode;
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('ring-2', isActive);
    btn.classList.toggle('ring-yellow-300', isActive);
  });
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

const removeAnimationClassOnEnd = (
  element: HTMLElement,
  className: string,
): void => {
  element.addEventListener('animationend', () => {
    element.classList.remove(className);
  });
};

const wireTouchControlsSetting = (root: ParentNode): void => {
  const initial = loadTouchControlsMode();
  refreshTouchModeButtons(root, initial);
  const buttons = root.querySelectorAll<HTMLButtonElement>('.touch-mode-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.touchMode;
      if (!isMode(next)) return;
      saveTouchControlsMode(next);
      applyTouchControlsVisibility(next);
      refreshTouchModeButtons(root, next);
      requestCanvasResize();
    });
  });
};

const $ = <T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
};

const modeLabels: Record<GameMode, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  anything: 'Anything',
} as const;

const difficultyLabels: Record<MathDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  expert: 'Expert',
} as const;

const startGame = (mode: GameMode, difficulty: MathDifficulty): void => {
  gameEngine.setResource('mathDifficulty', difficulty);
  gameEngine.setResource('gameMode', mode);
  void gameEngine.setScreen('playing', {
    level: 1,
    isFreshGame: true,
  });
};

const isGameMode = (value: string | undefined): value is GameMode =>
  value !== undefined && value in modeLabels;

const isMathDifficulty = (value: string | undefined): value is MathDifficulty =>
  value !== undefined && value in difficultyLabels;

const resetModeSelect = (root: HTMLElement): void => {
  root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
    card.classList.remove('ring-2', 'ring-yellow-300');
    card.setAttribute('aria-pressed', 'false');
  });
  const difficultySelect = root.querySelector<HTMLElement>('#difficulty-select');
  difficultySelect?.classList.add('hidden');
  if (difficultySelect) delete difficultySelect.dataset.selectedMode;
};

const selectMode = (root: HTMLElement, mode: GameMode): void => {
  root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
    const selected = card.dataset.mode === mode;
    card.classList.toggle('ring-2', selected);
    card.classList.toggle('ring-yellow-300', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  const difficultySelect = $<HTMLElement>(root, '#difficulty-select');
  $<HTMLElement>(root, '#selected-mode-label').textContent = modeLabels[mode];
  difficultySelect.dataset.selectedMode = mode;
  difficultySelect.classList.remove('hidden');
  $<HTMLButtonElement>(root, '#easy-difficulty').focus();
};

export const gameplayLevelLabel = (
  mode: GameMode,
  difficulty: MathDifficulty,
  level: number,
): string =>
  `${modeLabels[mode]} - ${difficultyLabels[difficulty]} - Level ${level}`;

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

const inputPromptsSlot = (): string => '<div class="input-prompts-slot" data-input-prompts></div>';

const menuSprite = (className: string, imageSrc: string): string =>
  `<span class="menu-board-sprite ${className}" style="background-image: url('${imageSrc}')" aria-hidden="true"></span>`;

const renderPromptSlot = (root: HTMLElement, prompts: InputPromptItem[] | undefined): void => {
  const slot = root.querySelector<HTMLElement>('[data-input-prompts]');
  if (!slot || !prompts) return;
  slot.replaceChildren(renderInputPromptBar(currentPromptPlatform, prompts));
};

export const updateInputPromptPlatform = (platform: InputPromptPlatform): void => {
  currentPromptPlatform = platform;
  screenElements.forEach((root, screen) => renderPromptSlot(root, SCREENS[screen].prompts));
};

// HUD element refs + last-written values. Populated when the playing screen
// mounts; `updateGameplayUI` runs every frame and skips writes when unchanged.
const gameplayHud: {
  score?: HTMLElement;
  lives?: HTMLElement;
  level?: HTMLElement;
  lastScore: number;
  lastLives: number;
  lastLevel: string;
} = {
  lastScore: NaN,
  lastLives: NaN,
  lastLevel: '',
};

const SCREENS: Record<UIScreen, ScreenSpec> = {
  menu: {
    id: 'main-menu',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="menu-shell w-[min(92vw,980px)] px-5 sm:px-7 md:px-9 py-5 sm:py-7 md:py-8 grid gap-5 sm:gap-7 md:gap-9 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] items-center">
        <div class="menu-copy text-center md:text-left">
          <p class="menu-kicker mb-2 sm:mb-3">Arcade math maze</p>
          <h1 class="pond-title menu-title text-gold drop-shadow-lg">
            Math Munchers
          </h1>

          <p class="menu-tagline mt-3 sm:mt-4 md:mt-5 mx-auto md:mx-0">
            Snap up the right answers before the pond catches up.
          </p>

          <div class="menu-actions mt-5 sm:mt-7">
            <button id="start-game-btn" class="btn-success menu-primary-action ${BTN_CHROME} ${BTN_SIZE.lgResponsive}">
              Start Game
            </button>
            <div class="menu-secondary-actions">
              <button id="settings-btn" class="btn-primary menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                Settings
              </button>
              <button id="high-scores-btn" class="btn-warning menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                High Scores
              </button>
            </div>
          </div>
        </div>

        <div class="menu-board" aria-hidden="true">
          <div class="menu-board-grid">
            <span class="menu-board-tile menu-board-answer">8</span>
            <span class="menu-board-tile"></span>
            <span class="menu-board-tile menu-board-answer">12</span>
            <span class="menu-board-tile"></span>
            <span class="menu-board-tile"></span>
            <span class="menu-board-tile menu-board-answer">16</span>
            <span class="menu-board-tile"></span>
            <span class="menu-board-tile"></span>
            <span class="menu-board-tile menu-board-answer">24</span>
          </div>
          ${menuSprite('menu-board-frog', frogHopToward)}
          ${menuSprite('menu-board-fly', flyMoveToward)}
          ${menuSprite('menu-board-lizard', lizardWalkToward)}
          ${menuSprite('menu-board-spider', spiderWalkToward)}
          <div class="menu-equation-chip">6 x 4 = ?</div>
        </div>
      </div>

      <button id="menu-fullscreen-btn" type="button" class="utility-btn absolute top-3 right-3 md:top-4 md:right-4 text-white border-none w-10 h-10 md:w-12 md:h-12 rounded-md cursor-pointer text-lg md:text-xl transition-colors duration-200 flex items-center justify-center z-10">
        ⛶
      </button>
      ${inputPromptsSlot()}
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
    ],
    wire: (root) => {
      $(root, '#start-game-btn').addEventListener('click', openModeSelect);
      $(root, '#settings-btn').addEventListener('click', openSettings);
      $(root, '#high-scores-btn').addEventListener('click', () => alert('High Scores feature coming soon!'));
      wireFullscreenButton($<HTMLButtonElement>(root, '#menu-fullscreen-btn'));
    },
  },

  modeSelect: {
    id: 'mode-select-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="text-center max-w-sm md:max-w-3xl landscape:max-w-6xl px-4 md:px-8 py-4 sm:py-6 md:py-12 landscape:py-3 w-full">
        <h1 class="pond-title text-2xl sm:text-3xl md:text-5xl lg:text-6xl landscape:text-2xl landscape:md:text-3xl font-bold mb-3 sm:mb-4 md:mb-6 landscape:mb-2 text-gold drop-shadow-lg">
          Select Math Mode
        </h1>

        <p class="text-sm sm:text-base md:text-xl mb-4 sm:mb-6 md:mb-12 opacity-90 leading-relaxed px-2 landscape:hidden">
          Choose an operation, then choose a difficulty.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-5 gap-3 md:gap-6 items-stretch">
          <button type="button" data-mode="addition" data-focusable class="mode-card text-white border-none p-3 md:p-6 landscape:p-3 rounded-xl shadow-lg cursor-pointer text-left">
            <span class="mode-symbol" aria-hidden="true">+</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Addition</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Solve addition equations with result and operand prompts.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Example: 2 + 3 = _
            </div>
          </button>

          <button type="button" data-mode="subtraction" data-focusable class="mode-card text-white border-none p-3 md:p-6 landscape:p-3 rounded-xl shadow-lg cursor-pointer text-left">
            <span class="mode-symbol" aria-hidden="true">-</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Subtraction</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Select subtraction operands in order on operand levels.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Example: _ - _ = 4
            </div>
          </button>

          <button type="button" data-mode="multiplication" data-focusable class="mode-card border-none p-3 md:p-6 landscape:p-3 rounded-xl shadow-lg cursor-pointer text-left">
            <span class="mode-symbol" aria-hidden="true">x</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Multiplication</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Build products or find the result tile.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Example: 3 x 4 = _
            </div>
          </button>

          <button type="button" data-mode="division" data-focusable class="mode-card text-white border-none p-3 md:p-6 landscape:p-3 rounded-xl shadow-lg cursor-pointer text-left">
            <span class="mode-symbol" aria-hidden="true">/</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Division</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Solve whole-number division equations.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Example: 12 / 3 = _
            </div>
          </button>

          <button type="button" data-mode="anything" data-focusable class="mode-card text-white border-none p-3 md:p-6 landscape:p-3 rounded-xl shadow-lg cursor-pointer text-left">
            <span class="mode-symbol" aria-hidden="true">?</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Anything</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Mix addition, subtraction, multiplication, and division prompts.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Operation changes from prompt to prompt.
            </div>
          </button>
        </div>

        <div id="difficulty-select" class="difficulty-panel hidden mt-4 md:mt-8 landscape:mt-3 p-3 md:p-5 rounded-xl backdrop-blur-sm">
          <h2 class="text-base md:text-xl font-semibold mb-3">
            <span id="selected-mode-label">Addition</span> Difficulty
          </h2>
          <div class="flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
            <button id="easy-difficulty" type="button" class="difficulty-choice easy text-white border-none px-5 py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-difficulty="easy">Easy</button>
            <button type="button" class="difficulty-choice medium border-none px-5 py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-difficulty="medium">Medium</button>
            <button type="button" class="difficulty-choice expert text-white border-none px-5 py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-difficulty="expert">Expert</button>
          </div>
        </div>

        <button id="back-to-main-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive} mt-4 md:mt-8 landscape:mt-3">
          ← Back to Menu
        </button>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    wire: (root) => {
      root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
          if (!isGameMode(card.dataset.mode)) return;
          selectMode(root, card.dataset.mode);
        });
      });
      root.querySelectorAll<HTMLButtonElement>('.difficulty-choice').forEach(button => {
        button.addEventListener('click', () => {
          const mode = $<HTMLElement>(root, '#difficulty-select').dataset.selectedMode;
          if (!isGameMode(mode)) return;
          if (!isMathDifficulty(button.dataset.difficulty)) return;
          startGame(mode, button.dataset.difficulty);
        });
      });
      $(root, '#back-to-main-btn').addEventListener('click', goToMenu);
    },
    onCancel: goToMenu,
  },

  playing: {
    id: 'gameplay-ui',
    className: 'absolute inset-0 flex flex-col pointer-events-none z-10',
    html: `
      <div id="top-hud" class="absolute top-0 inset-x-0 p-3 md:p-4 lg:p-5 flex flex-nowrap justify-between items-start text-white font-bold pointer-events-none gap-2 md:gap-4">
        <div class="flex flex-wrap gap-2 md:gap-4 lg:gap-6 items-center pointer-events-auto">
          <div id="score-display" class="hud-chip score text-sm md:text-base lg:text-lg px-3 md:px-4 py-2 rounded-lg whitespace-nowrap">Score: 0</div>
          <div id="lives-display" aria-live="polite" class="hud-chip lives text-sm md:text-base lg:text-lg px-3 md:px-4 py-2 rounded-lg whitespace-nowrap">Lives: 3</div>
        </div>

        <div class="flex gap-2 md:gap-3 items-center pointer-events-auto shrink-0">
          <button id="hud-fullscreen-btn" type="button" class="utility-btn text-white border-none px-3 md:px-4 py-2 rounded-md cursor-pointer text-sm md:text-base transition-colors duration-200 min-h-10 min-w-10 flex items-center justify-center">
            ⛶
          </button>
          <button id="pause-btn" class="utility-btn text-white border-none px-3 md:px-4 py-2 rounded-md cursor-pointer text-sm md:text-base transition-colors duration-200 min-h-10 min-w-10 flex items-center justify-center">
            ⏸️
          </button>
          <div id="level-display" class="hud-chip level text-xs md:text-sm lg:text-base px-2 md:px-3 py-1 md:py-2 rounded-lg whitespace-nowrap">Addition - Easy - Level 1</div>
        </div>
      </div>

      <div id="canvas-container" class="flex-1 min-h-0 min-w-0 flex items-center justify-center mb-16 md:mb-20 px-2 md:px-4">
        <canvas id="game-canvas" class="rounded-lg max-w-full max-h-full"></canvas>
      </div>

      <div id="bottom-hud" class="hud-bottom absolute bottom-0 inset-x-0 p-3 md:p-4 lg:p-5 flex justify-center items-center text-white pointer-events-auto">
        <div id="hints-display" class="text-xs md:text-sm lg:text-base text-center opacity-80 max-w-xs md:max-w-md lg:max-w-lg px-2">
          ${inputPromptsSlot()}
        </div>
      </div>

      <div id="touch-dpad" class="touch-controls" aria-label="Movement controls">
        <button id="touch-up"    type="button" aria-label="Move up"><span class="dpad-glyph">▲</span></button>
        <button id="touch-left"  type="button" aria-label="Move left"><span class="dpad-glyph">▲</span></button>
        <button id="touch-right" type="button" aria-label="Move right"><span class="dpad-glyph">▲</span></button>
        <button id="touch-down"  type="button" aria-label="Move down"><span class="dpad-glyph">▲</span></button>
      </div>
      <div id="touch-action" class="touch-controls" aria-label="Action controls">
        <button id="touch-eat" type="button" aria-label="Eat">EAT</button>
      </div>
    `,
    prompts: [
      { action: 'move', label: 'Move' },
      { action: 'eat', label: 'Eat' },
      { action: 'pause', label: 'Pause' },
    ],
    wire: (root) => {
      $(root, '#pause-btn').addEventListener('click', () => { void gameEngine.pushScreen('paused', {}); });
      wireFullscreenButton($<HTMLButtonElement>(root, '#hud-fullscreen-btn'));
      const scoreDisplay = $(root, '#score-display');
      const livesDisplay = $(root, '#lives-display');
      removeAnimationClassOnEnd(scoreDisplay, 'score-gain');
      removeAnimationClassOnEnd(livesDisplay, 'life-loss');
      gameplayHud.score = scoreDisplay;
      gameplayHud.lives = livesDisplay;
      gameplayHud.level = $(root, '#level-display');
      bindTouchControls(root);
    },
  },

  settings: {
    id: 'settings-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="text-center max-w-sm md:max-w-lg landscape:max-w-4xl w-full px-4 md:px-8 py-4 sm:py-6 md:py-8 landscape:py-3">
        <h2 class="pond-title text-2xl sm:text-3xl md:text-4xl landscape:text-xl landscape:md:text-2xl font-bold mb-4 sm:mb-6 md:mb-8 landscape:mb-3 text-gold drop-shadow-lg">⚙️ Settings</h2>

        <div class="grid grid-cols-1 landscape:grid-cols-2 gap-3 md:gap-6 landscape:gap-3 text-left items-stretch">
          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">🎯 Math Challenge</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90">Mode and difficulty are selected when starting a game.</p>
          </div>

          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">🔊 Audio</h3>
            <div class="space-y-2 md:space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="sound-effects" checked class="theme-checkbox w-5 h-5 rounded">
                <span class="text-sm md:text-base">Sound Effects</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="background-music" checked class="theme-checkbox w-5 h-5 rounded">
                <span class="text-sm md:text-base">Background Music</span>
              </label>
            </div>
          </div>

          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">🎮 Controls</h3>
            <div class="text-xs md:text-base landscape:text-xs space-y-0.5 md:space-y-1 opacity-90">
              <p>🔤 Move: WASD / Arrows / D-pad</p>
              <p>🍽️ Eat / Select: Space / Enter / A</p>
              <p>⏸️ Pause / Back: Esc / Start</p>
              <p>⚙️ F1: Settings</p>
            </div>
          </div>

          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">📱 Touch Controls</h3>
            <p class="text-xs md:text-sm opacity-80 mb-2 landscape:hidden">Show on-screen D-pad and Eat button.</p>
            <div class="flex flex-col md:flex-row gap-2 md:gap-3">
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="auto">Auto</button>
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="on">Always On</button>
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="off">Always Off</button>
            </div>
          </div>
        </div>

        <button id="back-to-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg} mt-4 md:mt-8 landscape:mt-3 w-full md:w-auto">
          ← Back to Menu
        </button>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    wire: (root) => {
      $(root, '#back-to-menu-btn').addEventListener('click', returnToPreviousScreen);
      wireTouchControlsSetting(root);
    },
    onCancel: returnToPreviousScreen,
  },

  gameOver: {
    id: 'game-over-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="overlay-panel text-center max-w-sm md:max-w-md px-6 py-6 sm:py-8">
        <h1 class="game-over-title text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 md:mb-8 drop-shadow-lg animate-pulse">
          💀 GAME OVER
        </h1>

        <div id="final-score" class="final-score text-xl sm:text-2xl md:text-3xl mb-6 sm:mb-8 font-bold drop-shadow-md">
          Final Score: 0
        </div>

        <div class="flex flex-col gap-4 md:gap-5 mt-8">
          <button id="play-again-btn" class="btn-success ${BTN_CHROME} ${BTN_SIZE.lg} w-full">
            🔄 Play Again
          </button>
          <button id="main-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.md} w-full">
            🏠 Main Menu
          </button>
        </div>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
    ],
    wire: (root) => {
      $(root, '#play-again-btn').addEventListener('click', () => {
        startGame(gameEngine.getResource('gameMode'), gameEngine.getResource('mathDifficulty'));
      });
      $(root, '#main-menu-btn').addEventListener('click', goToMenu);
    },
    onCancel: goToMenu,
  },

  paused: {
    id: 'pause-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="overlay-panel text-center max-w-sm md:max-w-md px-6 py-6 sm:py-8">
        <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 md:mb-12 drop-shadow-lg">⏸️ PAUSED</h2>

        <div class="flex flex-col gap-4 md:gap-5">
          <button id="resume-btn" class="btn-success ${BTN_CHROME} ${BTN_SIZE.lg} w-full">
            ▶️ Resume Game
          </button>
          <button id="pause-settings-btn" class="btn-primary ${BTN_CHROME} ${BTN_SIZE.md} w-full">
            ⚙️ Settings
          </button>
          <button id="quit-to-menu-btn" class="btn-danger ${BTN_CHROME} ${BTN_SIZE.md} w-full">
            🏠 Quit to Menu
          </button>
        </div>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    wire: (root) => {
      $(root, '#resume-btn').addEventListener('click', returnToPreviousScreen);
      $(root, '#pause-settings-btn').addEventListener('click', openSettings);
      $(root, '#quit-to-menu-btn').addEventListener('click', goToMenu);
    },
    onCancel: returnToPreviousScreen,
  },
};

const gameContainer = ((): HTMLElement => {
  const container = document.createElement('div');
  container.id = 'game-container';
  container.className = 'w-screen h-dvh relative overflow-hidden flex flex-col items-center justify-center font-sans app-background';
  document.body.appendChild(container);
  return container;
})();

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

const SETTINGS_BACK_LABELS: Record<SettingsReturnScreen, string> = {
  menu: '← Back to Menu',
  modeSelect: '← Back to Mode Selection',
  playing: '← Back to Game',
  paused: '← Back to Game',
  gameOver: '← Back to Game Over',
} as const;

export function showSettingsScreen(returnTo: SettingsReturnScreen): void {
  showScreen('settings');
  const backButton = document.getElementById('back-to-menu-btn');
  if (!backButton) throw new Error('Settings back button not found');
  backButton.textContent = SETTINGS_BACK_LABELS[returnTo];
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

export const updateGameplayUI = (
  score: number,
  lives: number,
  level: string,
): void => {
  if (gameplayHud.score && score !== gameplayHud.lastScore) {
    const scoreIncreased = Number.isFinite(gameplayHud.lastScore) && score > gameplayHud.lastScore;
    gameplayHud.score.textContent = `Score: ${score}`;
    gameplayHud.score.classList.toggle('score-gain', scoreIncreased);
    gameplayHud.lastScore = score;
  }
  if (gameplayHud.lives && lives !== gameplayHud.lastLives) {
    const lifeLost = Number.isFinite(gameplayHud.lastLives) && lives < gameplayHud.lastLives;
    gameplayHud.lives.textContent = `Lives: ${lives}`;
    gameplayHud.lives.classList.toggle('life-loss', lifeLost);
    gameplayHud.lastLives = lives;
  }
  if (gameplayHud.level && level !== gameplayHud.lastLevel) {
    gameplayHud.level.textContent = level;
    gameplayHud.lastLevel = level;
  }
};

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
