import type { GameMode, MathDifficulty } from '../ecs/types';
import { html, nothing, type TemplateResult } from 'lit-html';
import { ref } from 'lit-html/directives/ref.js';
import flyMoveToward from '../assets/images/fly-move-toward.png';
import frogHopToward from '../assets/images/frog-hop-toward.png';
import lizardWalkToward from '../assets/lizard-walk-toward.png';
import spiderWalkToward from '../assets/spider-walk-toward.png';
import { $ } from './dom';
import { bindGameplayHud } from './gameplayHud';
import {
  isGameMode,
  isMathDifficulty,
  modeLabels,
} from './labels';
import { bindTouchControls } from './touchControls';
import type { ScreenSpec, UIScreen } from './screenTypes';

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

export type ScreenSpecActions = {
  startGame: (mode: GameMode, difficulty: MathDifficulty) => void;
  replayGame: () => void;
  returnToPreviousScreen: () => void;
  goToMenu: () => void;
  openModeSelect: () => void;
  openHowToPlay: () => void;
  openSettings: () => void;
  quitApplication?: () => void;
  pauseGame: () => void;
  wireFullscreenButton: (button: HTMLButtonElement) => void;
  wireAudioSettings: (root: ParentNode) => void;
  wireTouchControlsSetting: (root: ParentNode) => void;
};

// TODO: Make prompt placement explicit here, e.g. viewport / hud / panel,
// instead of relying on screen IDs and parent selectors in CSS.
const inputPromptsSlot = (): string => '<div class="input-prompts-slot" data-input-prompts></div>';

const menuSprite = (className: string, imageSrc: string): TemplateResult => html`
  <span
    class="menu-board-sprite ${className}"
    style="background-image: url('${imageSrc}')"
    aria-hidden="true"
  ></span>
`;

const HOW_TO_PLAY_STEPS = [
  {
    title: 'Read the equation',
    description: 'The goal above the board shows which result or operands are missing.',
  },
  {
    title: 'Move to a number',
    description: 'Guide the frog across the lily pads until it is on the number you need.',
  },
  {
    title: 'Eat to select',
    description: 'Use the Eat action on that tile. Some equations require more than one number.',
  },
  {
    title: 'Protect your lives',
    description: 'Wrong answers and enemies cost lives. Clear equations to advance through the marsh.',
  },
] as const;

function howToPlayStep(
  step: (typeof HOW_TO_PLAY_STEPS)[number],
  index: number,
): TemplateResult {
  return html`
    <li class="how-to-play-step p-3 sm:p-4 md:p-5 rounded-xl">
      <span class="how-to-play-step-number" aria-hidden="true">${index + 1}</span>
      <div>
        <h2 class="text-base md:text-xl font-semibold mb-1">${step.title}</h2>
        <p class="text-sm md:text-base opacity-90">${step.description}</p>
      </div>
    </li>
  `;
}

export const resetModeSelect = (root: HTMLElement): void => {
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

export const createScreenSpecs = (actions: ScreenSpecActions): Record<UIScreen, ScreenSpec> => ({
  menu: {
    id: 'main-menu',
    className: `${OVERLAY_BASE} app-background`,
    html: html`
      <div class="menu-shell w-[min(92vw,980px)] px-5 sm:px-7 md:px-9 py-5 sm:py-7 md:py-8 grid gap-5 sm:gap-7 md:gap-9 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] items-center">
        <div class="menu-copy text-center md:text-left">
          <h1 class="menu-title text-gold drop-shadow-lg">
            Math Marsh
          </h1>

          <div class="menu-actions mt-5 sm:mt-7">
            <button @click=${actions.openModeSelect} class="btn-success menu-primary-action ${BTN_CHROME} ${BTN_SIZE.lgResponsive}">
              Start Game
            </button>
            <div class="menu-secondary-actions">
              <button @click=${actions.openHowToPlay} class="btn-primary menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                How to Play
              </button>
              <button @click=${actions.openSettings} class="btn-primary menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                Settings
              </button>
              ${actions.quitApplication ? html`
                <button @click=${actions.quitApplication} class="btn-danger menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                  Quit
                </button>
              ` : nothing}
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

      <button
        ${ref(function connectFullscreenButton(element): void {
          if (!element) return;
          if (!(element instanceof HTMLButtonElement)) throw new Error('Fullscreen control must be a button');
          actions.wireFullscreenButton(element);
        })}
        type="button"
        class="utility-btn absolute top-3 right-3 md:top-4 md:right-4 text-white border-none w-10 h-10 md:w-12 md:h-12 rounded-md cursor-pointer text-lg md:text-xl transition-colors duration-200 flex items-center justify-center z-10"
      >
        ⛶
      </button>
      <div class="input-prompts-slot" data-input-prompts></div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
    ],
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
            <span class="mode-symbol" aria-hidden="true">÷</span>
            <h3 class="text-lg md:text-2xl landscape:text-base font-bold mb-1 md:mb-3 landscape:mb-1">Division</h3>
            <p class="text-xs md:text-base landscape:text-xs opacity-90 mb-1 md:mb-3 landscape:mb-1">
              Solve whole-number division equations.
            </p>
            <div class="text-xs opacity-70 landscape:hidden">
              Example: 12 ÷ 3 = _
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
    wire: (root): void => {
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
          actions.startGame(mode, button.dataset.difficulty);
        });
      });
      $(root, '#back-to-main-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.goToMenu,
  },

  howToPlay: {
    id: 'how-to-play-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: html`
      <div class="text-center max-w-sm md:max-w-4xl w-full px-4 md:px-8 py-4 sm:py-6 md:py-8 landscape:py-3">
        <h1 class="pond-title text-2xl sm:text-3xl md:text-5xl landscape:text-2xl landscape:md:text-3xl font-bold mb-2 sm:mb-3 md:mb-4 text-gold drop-shadow-lg">
          How to Play
        </h1>
        <p class="text-sm sm:text-base md:text-xl mb-4 sm:mb-5 md:mb-7 opacity-90 leading-relaxed">
          Solve the equation by eating the right number tiles while staying clear of pond creatures.
        </p>

        <ol class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5 text-left">
          ${HOW_TO_PLAY_STEPS.map(howToPlayStep)}
        </ol>

        <button @click=${actions.goToMenu} class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg} mt-4 md:mt-7 landscape:mt-3 w-full sm:w-auto">
          ← Back to Menu
        </button>
        <div class="input-prompts-slot" data-input-prompts></div>
      </div>
    `,
    prompts: [
      { action: 'back', label: 'Back' },
    ],
    onCancel: actions.goToMenu,
  },

  playing: {
    id: 'gameplay-ui',
    className: 'absolute inset-0 flex flex-col pointer-events-none z-10',
    html: `
      <div id="top-hud" class="absolute top-0 inset-x-0 p-3 md:p-4 lg:p-5 flex flex-nowrap justify-between items-start text-white font-bold pointer-events-none gap-2 md:gap-4">
        <div class="flex flex-wrap gap-2 md:gap-4 lg:gap-6 items-center pointer-events-auto">
          <div id="time-display" class="hud-chip time text-sm md:text-base lg:text-lg px-3 md:px-4 py-2 rounded-lg whitespace-nowrap">Time: 0:00</div>
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
    wire: (root): void => {
      $(root, '#pause-btn').addEventListener('click', actions.pauseGame);
      actions.wireFullscreenButton($<HTMLButtonElement>(root, '#hud-fullscreen-btn'));
      bindGameplayHud(root);
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
    wire: (root): void => {
      $(root, '#back-to-menu-btn').addEventListener('click', actions.returnToPreviousScreen);
      actions.wireAudioSettings(root);
      actions.wireTouchControlsSetting(root);
    },
    onCancel: actions.returnToPreviousScreen,
  },

  gameOver: {
    id: 'game-over-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="game-over-layout w-[min(92vw,540px)] text-center">
        <div class="game-over-shell px-5 sm:px-7 md:px-9 py-6 sm:py-8">
          <div class="game-over-emblem" aria-hidden="true">
            <span class="game-over-ripple"></span>
            <span class="game-over-lily"></span>
          </div>

          <h1 class="game-over-title drop-shadow-lg">
            Game Over
          </h1>

          <div id="final-time" class="final-time mt-4 sm:mt-5 text-xl sm:text-2xl md:text-3xl font-bold drop-shadow-md" aria-live="polite">
            Final Time: 0:00
          </div>

          <p class="game-over-message mt-4 sm:mt-5 text-base sm:text-lg">
            The pond goes quiet. Try another run.
          </p>

          <div class="game-over-actions mt-6 sm:mt-8">
            <button id="play-again-btn" class="btn-success ${BTN_CHROME} ${BTN_SIZE.lgResponsive}">
              Play Again
            </button>
            <button id="main-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
              Main Menu
            </button>
          </div>
        </div>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
    ],
    wire: (root): void => {
      $(root, '#play-again-btn').addEventListener('click', actions.replayGame);
      $(root, '#main-menu-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.goToMenu,
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
    wire: (root): void => {
      $(root, '#resume-btn').addEventListener('click', actions.returnToPreviousScreen);
      $(root, '#pause-settings-btn').addEventListener('click', actions.openSettings);
      $(root, '#quit-to-menu-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.returnToPreviousScreen,
  },
});

export const createGameContainer = (): HTMLElement => {
  const container = document.createElement('div');
  container.id = 'game-container';
  container.className = 'w-screen h-dvh relative overflow-hidden flex flex-col items-center justify-center font-sans app-background';
  document.body.appendChild(container);
  return container;
};
