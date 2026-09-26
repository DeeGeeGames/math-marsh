import { html, nothing, type TemplateResult } from 'lit-html';
import { ref } from 'lit-html/directives/ref.js';
import flyMoveToward from '../../assets/images/fly-move-toward.png';
import frogHopToward from '../../assets/images/frog-hop-toward.png';
import lizardWalkToward from '../../assets/lizard-walk-toward.png';
import spiderWalkToward from '../../assets/spider-walk-toward.png';
import type { GameMode } from '../../ecs/types';
import { $ } from '../dom';
import {
  isEquationOperation,
  isMathDifficulty,
  selectedOperationsLabel,
} from '../labels';
import type { ScreenSpec } from '../screenTypes';
import {
  BTN_CHROME,
  BTN_SIZE,
  inputPromptsSlot,
  OVERLAY_BASE,
  type ScreenSpecActions,
} from './shared';

const HOW_TO_PLAY_STEPS = [
  {
    title: 'Read the equation',
    description: 'Look at the equation above the pond. Empty spots show the numbers you need.',
  },
  {
    title: 'Move to a number',
    description: 'Tap or click a lily pad to fly there, or use the arrows or D-pad to move one pad at a time.',
  },
  {
    title: 'Eat the number',
    description: 'Once the fly arrives, tap or click it again, or press Eat. You may need two numbers.',
  },
  {
    title: 'Stay safe',
    description: 'Correct answers add time. Wrong answers and animal hits cost time. Keep solving to stay in the pond.',
  },
] as const;

function menuSprite(className: string, imageSrc: string): TemplateResult {
  return html`
    <span
      class="menu-board-sprite ${className}"
      style="background-image: url('${imageSrc}')"
      aria-hidden="true"
    ></span>
  `;
}

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

export function resetModeSelect(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
    card.setAttribute('aria-pressed', 'false');
  });
  const difficultySelect = root.querySelector<HTMLElement>('#difficulty-select');
  difficultySelect?.classList.add('hidden');
}

function selectedOperations(root: HTMLElement): GameMode | undefined {
  const [first, ...rest] = Array.from(root.querySelectorAll<HTMLElement>('.mode-card[aria-pressed="true"]'))
    .map(card => card.dataset.operation)
    .filter(isEquationOperation);
  return first ? [first, ...rest] : undefined;
}

function syncOperationSelection(root: HTMLElement): void {
  const mode = selectedOperations(root);
  const difficultySelect = $<HTMLElement>(root, '#difficulty-select');
  difficultySelect.classList.toggle('hidden', !mode);
  if (!mode) return;
  $<HTMLElement>(root, '#selected-mode-label').textContent = selectedOperationsLabel(mode);
}

function setOperationSelected(card: HTMLElement, selected: boolean): void {
  card.setAttribute('aria-pressed', String(selected));
}

export function createMenuScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
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
    promptPlacement: 'viewport',
  };
}

export function createModeSelectScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'mode-select-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="mode-select-shell">
        <header class="mode-select-heading">
          <h1 class="pond-title text-gold drop-shadow-lg">Select Math Mode</h1>
          <p>Choose one or more operations, then a difficulty to start.</p>
        </header>

        <div class="mode-options" role="group" aria-label="Math operations">
          <button type="button" data-operation="add" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">+</span>
            <span class="mode-name">Addition</span>
            <span class="mode-example">2 + 3 = ?</span>
          </button>
          <button type="button" data-operation="subtract" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">−</span>
            <span class="mode-name">Subtraction</span>
            <span class="mode-example">7 − 3 = ?</span>
          </button>
          <button type="button" data-operation="multiply" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">×</span>
            <span class="mode-name">Multiplication</span>
            <span class="mode-example">3 × 4 = ?</span>
          </button>
          <button type="button" data-operation="divide" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">÷</span>
            <span class="mode-name">Division</span>
            <span class="mode-example">12 ÷ 3 = ?</span>
          </button>
          <button id="back-to-main-btn" class="btn-secondary mode-menu-back">
            ← Back to Menu
          </button>
        </div>

        <div id="difficulty-select" class="difficulty-panel hidden mode-difficulty">
          <h2><span id="selected-mode-label">Addition</span> · Choose difficulty</h2>
          <div class="mode-difficulty-options">
            <button id="easy-difficulty" type="button" class="difficulty-choice easy" data-difficulty="easy">Easy</button>
            <button type="button" class="difficulty-choice medium" data-difficulty="medium">Medium</button>
            <button type="button" class="difficulty-choice expert" data-difficulty="expert">Expert</button>
          </div>
        </div>

        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Navigate' },
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    promptPlacement: 'panel',
    wire: (root): void => {
      root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
          if (!isEquationOperation(card.dataset.operation)) return;
          setOperationSelected(card, card.getAttribute('aria-pressed') !== 'true');
          syncOperationSelection(root);
        });
      });
      root.querySelectorAll<HTMLButtonElement>('.difficulty-choice').forEach(button => {
        button.addEventListener('click', () => {
          const mode = selectedOperations(root);
          if (!mode) return;
          if (!isMathDifficulty(button.dataset.difficulty)) return;
          actions.startGame(mode, button.dataset.difficulty);
        });
      });
      $(root, '#back-to-main-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.goToMenu,
  };
}

export function createHowToPlayScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'how-to-play-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: html`
      <div class="text-center max-w-sm md:max-w-4xl w-full px-4 md:px-8 py-4 sm:py-6 md:py-8 landscape:py-3">
        <h1 class="pond-title text-2xl sm:text-3xl md:text-5xl landscape:text-2xl landscape:md:text-3xl font-bold mb-2 sm:mb-3 md:mb-4 text-gold drop-shadow-lg">
          How to Play
        </h1>
        <p class="text-sm sm:text-base md:text-xl mb-4 sm:mb-5 md:mb-7 opacity-90 leading-relaxed">
          Eat the right numbers to solve the equation. Stay away from pond animals.
        </p>

        <ol class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5 text-left">
          ${HOW_TO_PLAY_STEPS.map(howToPlayStep)}
        </ol>

        <div class="flex flex-col sm:flex-row gap-3 justify-center mt-4 md:mt-7 landscape:mt-3">
          <button @click=${actions.startTutorial} class="btn-success ${BTN_CHROME} ${BTN_SIZE.lg} w-full sm:w-auto">
            Play Tutorial
          </button>
          <button @click=${actions.goToMenu} class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg} w-full sm:w-auto">
            ← Back to Menu
          </button>
        </div>
        <div class="input-prompts-slot" data-input-prompts></div>
      </div>
    `,
    prompts: [
      { action: 'back', label: 'Back' },
    ],
    promptPlacement: 'viewport',
    onCancel: actions.goToMenu,
  };
}

export function createTutorialOfferScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'tutorial-offer-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: html`
      <div class="overlay-panel text-center w-[min(92vw,620px)] px-6 sm:px-8 py-7 sm:py-9">
        <p class="text-sm md:text-base uppercase tracking-widest text-gold font-bold mb-2">First game</p>
        <h1 class="pond-title text-3xl sm:text-4xl md:text-5xl font-bold text-gold drop-shadow-lg">
          Learn on the pond
        </h1>
        <p class="text-base sm:text-lg md:text-xl mt-5 opacity-90 leading-relaxed">
          Try a short game that shows you how to play. You can skip it now and play it again later.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-7">
          <button @click=${actions.startTutorial} class="btn-success ${BTN_CHROME} ${BTN_SIZE.lgResponsive}">
            Start Tutorial
          </button>
          <button @click=${actions.skipTutorial} class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
            Skip and Play
          </button>
        </div>
        <div class="input-prompts-slot" data-input-prompts></div>
      </div>
    `,
    prompts: [
      { action: 'navigate', label: 'Choose' },
      { action: 'select', label: 'Select' },
    ],
    promptPlacement: 'panel',
  };
}
