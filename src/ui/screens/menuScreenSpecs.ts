import { selectedStartingLevel } from '../../ecs/levelSelectionCheat';
import { BOARD_SIZES } from '../../ecs/boardGeometry';
import { html, nothing, type TemplateResult } from 'lit-html';
import { ref } from 'lit-html/directives/ref.js';
import flyMoveToward from '../../assets/sprites/fly/fly-move-toward.png';
import frogHopToward from '../../assets/sprites/frog/frog-hop-toward.png';
import lizardWalkToward from '../../assets/sprites/lizard/lizard-walk-toward.png';
import spiderWalkToward from '../../assets/sprites/spider/spider-walk-toward.png';
import type { EquationOperation, GameMode } from '../../ecs/types';
import { MATH_FINAL_STEP, mathStepLabel } from '../../ecs/mathSteps';
import { $ } from '../dom';
import {
  isEquationOperation,
  isMathDifficulty,
  operationLabels,
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

const MATH_OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];

const HOW_TO_PLAY_STEPS = [
  {
    title: 'Read the equation',
    description: 'Look at the equation above the pond. Empty spots show the numbers you need.',
  },
  {
    title: 'Move to a number',
    description: 'Tap or click anywhere on the pond to fly there, or use the arrows or D-pad to move one space at a time.',
  },
  {
    title: 'Eat the number',
    description: 'Once the fly arrives, tap or click it again, or press Eat. Fill empty spots from left to right.',
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

export function resetModeSelect(root: HTMLElement, levelSelectionUnlocked = false): void {
  $(root, '#starting-level-select').classList.toggle('hidden', !levelSelectionUnlocked);
  $<HTMLOutputElement>(root, '#starting-level-value').value = '1';
  root.querySelectorAll<HTMLElement>('.mode-card').forEach(card => {
    card.setAttribute('aria-pressed', 'false');
  });
  const difficultySelect = root.querySelector<HTMLElement>('#difficulty-select');
  difficultySelect?.classList.add('hidden');
  root.querySelector<HTMLElement>('#math-progress-select')?.classList.add('hidden');
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
  $(root, '#math-progress-select').classList.toggle('hidden', !mode);
  MATH_OPERATIONS.forEach(function(operation): void {
    $(root, `[data-step-panel="${operation}"]`).classList.toggle('hidden', !mode?.includes(operation));
  });
  if (!mode) return;
  $<HTMLElement>(root, '#selected-mode-label').textContent = selectedOperationsLabel(mode);
}

function setOperationSelected(card: HTMLElement, selected: boolean): void {
  card.setAttribute('aria-pressed', String(selected));
}

const refreshMathProgress = function(root: HTMLElement, actions: ScreenSpecActions): void {
  const progress = actions.getMathProgress();
  MATH_OPERATIONS.forEach(function(operation): void {
    const track = progress[operation];
    $(root, `[data-progress-for="${operation}"]`).textContent = `Step ${track.currentStep} · Unlocked through ${track.highestUnlockedStep}`;
    $(root, `[data-skill-for="${operation}"]`).textContent = mathStepLabel(track.currentStep, operation);
    $(root, `[data-step-for="${operation}"]`).textContent = `Step ${track.currentStep}`;
    $(root, `[data-unlocked-for="${operation}"]`).textContent = `Unlocked through Step ${track.highestUnlockedStep} of ${MATH_FINAL_STEP}`;
    root.querySelectorAll<HTMLButtonElement>(`[data-step-operation="${operation}"]`).forEach(function(button): void {
      const nextStep = track.currentStep + Number(button.dataset.stepChange);
      button.setAttribute('aria-disabled', String(nextStep < 1 || nextStep > track.highestUnlockedStep));
    });
    root.querySelectorAll<HTMLElement>(`[data-milestone-operation="${operation}"]`).forEach(function(milestone): void {
      const step = Number(milestone.dataset.milestoneStep);
      const state = step === track.currentStep ? 'current' : step <= track.highestUnlockedStep ? 'unlocked' : 'locked';
      milestone.dataset.state = state;
      milestone.setAttribute('aria-label', `Step ${step}: ${state}`);
      if (state === 'current') milestone.setAttribute('aria-current', 'step');
      else milestone.removeAttribute('aria-current');
    });
  });
  $(root, '#math-save-status').textContent = actions.getMathProgressPersistence() === 'persistent'
    ? 'Math progress is saved on this device.'
    : 'Math progress lasts for this session only. Device saving is unavailable.';
};

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
              <button @click=${actions.openSkitGallery} class="btn-primary menu-secondary-action ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">
                Scenes
              </button>
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
      </button>
      <div class="input-prompts-slot menu-input-prompts" data-input-prompts></div>
    `,
    prompts: [
      { action: 'select', label: 'Select' },
    ],
    promptPlacement: 'panel',
  };
}

export function createModeSelectScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'mode-select-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="mode-select-shell">
        <header class="mode-select-heading">
          <h1 class="pond-title text-gold drop-shadow-lg">Choose Your Game</h1>
          <p>Choose operations. Your math advances as you solve; difficulty sets the board and enemies.</p>
        </header>

        <div class="mode-options" role="group" aria-label="Math operations">
          <button type="button" data-operation="add" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">+</span>
            <span class="mode-name">Addition</span>
            <span class="mode-example">2 + 3 = ?</span>
            <span class="mode-progress" data-progress-for="add"></span>
          </button>
          <button type="button" data-operation="subtract" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">−</span>
            <span class="mode-name">Subtraction</span>
            <span class="mode-example">7 − 3 = ?</span>
            <span class="mode-progress" data-progress-for="subtract"></span>
          </button>
          <button type="button" data-operation="multiply" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">×</span>
            <span class="mode-name">Multiplication</span>
            <span class="mode-example">3 × 4 = ?</span>
            <span class="mode-progress" data-progress-for="multiply"></span>
          </button>
          <button type="button" data-operation="divide" data-focusable aria-pressed="false" class="mode-card">
            <span class="mode-symbol" aria-hidden="true">÷</span>
            <span class="mode-name">Division</span>
            <span class="mode-example">12 ÷ 3 = ?</span>
            <span class="mode-progress" data-progress-for="divide"></span>
          </button>
          <button id="back-to-main-btn" class="btn-secondary mode-menu-back">
            ← Back to Menu
          </button>
        </div>

        <section id="math-progress-select" class="math-progress-panel hidden" aria-labelledby="math-progress-heading">
          <h2 id="math-progress-heading">Your math path</h2>
          <p>Continue at your saved step, or revisit any unlocked step. Your unlocks stay yours.</p>
          <div class="math-step-panels">
            ${MATH_OPERATIONS.map(function(operation): string {
              return `
                <section class="math-step-panel hidden" data-step-panel="${operation}" aria-label="${operationLabels[operation]} progression">
                  <h3>${operationLabels[operation]}</h3>
                  <p class="math-step-skill" data-skill-for="${operation}"></p>
                  <div class="math-step-controls">
                    <button type="button" class="btn-secondary" data-step-operation="${operation}" data-step-change="-1" aria-label="Earlier ${operationLabels[operation]} step">← Earlier</button>
                    <output data-step-for="${operation}" aria-live="polite"></output>
                    <button type="button" class="btn-secondary" data-step-operation="${operation}" data-step-change="1" aria-label="Later ${operationLabels[operation]} step">Later →</button>
                  </div>
                  <div class="math-milestones" role="list" aria-label="${operationLabels[operation]} unlocks">
                    ${Array.from({ length: MATH_FINAL_STEP }, function(_, index): string {
                      return `<span role="listitem" class="math-milestone" data-milestone-operation="${operation}" data-milestone-step="${index + 1}">${index + 1}</span>`;
                    }).join('')}
                  </div>
                  <p class="math-highest-unlock" data-unlocked-for="${operation}"></p>
                </section>
              `;
            }).join('')}
          </div>
          <p class="math-milestone-key">Gold: current · Green: unlocked · Dim: locked</p>
        </section>
        <p id="math-save-status" class="math-save-status" aria-live="polite"></p>

        <div id="starting-level-select" class="starting-level-panel hidden" role="group" aria-label="Starting level">
          <span>Starting arcade level</span>
          <button type="button" class="btn-secondary" data-level-change="-1" aria-label="Previous starting level">−</button>
          <output id="starting-level-value" aria-live="polite" aria-label="Starting level">1</output>
          <button type="button" class="btn-secondary" data-level-change="1" aria-label="Next starting level">+</button>
        </div>

        <div id="difficulty-select" class="difficulty-panel hidden mode-difficulty">
          <h2><span id="selected-mode-label">Addition</span> · Choose arcade difficulty</h2>
          <div class="mode-difficulty-options">
            <button id="easy-difficulty" type="button" class="difficulty-choice easy" data-difficulty="easy">Easy · ${BOARD_SIZES.easy.width}×${BOARD_SIZES.easy.height}</button>
            <button type="button" class="difficulty-choice medium" data-difficulty="medium">Medium · ${BOARD_SIZES.medium.width}×${BOARD_SIZES.medium.height}</button>
            <button type="button" class="difficulty-choice expert" data-difficulty="expert">Expert · ${BOARD_SIZES.expert.width}×${BOARD_SIZES.expert.height}</button>
          </div>
        </div>

        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
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
      root.querySelectorAll<HTMLButtonElement>('[data-step-change]').forEach(function(button): void {
        button.addEventListener('click', function(): void {
          const operation = button.dataset.stepOperation;
          if (!isEquationOperation(operation)) return;
          const track = actions.getMathProgress()[operation];
          const change = Number(button.dataset.stepChange);
          if (change !== -1 && change !== 1) return;
          const step = track.currentStep + change;
          if (step < 1 || step > track.highestUnlockedStep) return;
          actions.selectMathStep(operation, step);
          refreshMathProgress(root, actions);
        });
      });
      root.querySelectorAll<HTMLButtonElement>('.difficulty-choice').forEach(button => {
        button.addEventListener('click', () => {
          const mode = selectedOperations(root);
          if (!mode) return;
          if (!isMathDifficulty(button.dataset.difficulty)) return;
          actions.startGame(mode, button.dataset.difficulty, Number($<HTMLOutputElement>(root, '#starting-level-value').value));
        });
      });
      root.querySelectorAll<HTMLButtonElement>('[data-level-change]').forEach(button => {
        button.addEventListener('click', function(): void {
          const output = $<HTMLOutputElement>(root, '#starting-level-value');
          output.value = String(selectedStartingLevel(Number(output.value) + Number(button.dataset.levelChange)));
        });
      });
      $(root, '#back-to-main-btn').addEventListener('click', actions.goToMenu);
    },
    onShow: function(root): void {
      resetModeSelect(root, actions.isLevelSelectionUnlocked());
      refreshMathProgress(root, actions);
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
      { action: 'select', label: 'Select' },
    ],
    promptPlacement: 'panel',
  };
}
