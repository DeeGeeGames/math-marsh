import { selectedStartingLevel } from '../../ecs/levelSelectionCheat';
import { BOARD_SIZES } from '../../ecs/boardGeometry';
import { GAME_CONFIG } from '../../config';
import { html, nothing, render, type TemplateResult } from 'lit-html';
import { ref } from 'lit-html/directives/ref.js';
import flyMoveToward from '../../assets/sprites/fly/fly-move-toward.png';
import frogHopToward from '../../assets/sprites/frog/frog-hop-toward.png';
import lizardWalkToward from '../../assets/sprites/lizard/lizard-walk-toward.png';
import spiderWalkToward from '../../assets/sprites/spider/spider-walk-toward.png';
import type { EquationOperation, MathDifficulty } from '../../ecs/types';
import { MATH_FINAL_STEP, mathStepLabel } from '../../ecs/mathSteps';
import { $ } from '../dom';
import {
  difficultyLabels,
  isEquationOperation,
  isMathDifficulty,
  operationLabels,
} from '../labels';
import type { ScreenSpec } from '../screenTypes';
import {
  advanceModeSelectToPond,
  chooseModeSelectDifficulty,
  closeModeSelectPanel,
  createModeSelectSetupState,
  mathProgressCue,
  modeSelectGameRequest,
  revealModeSelectLevelSelection,
  returnModeSelectToMath,
  showModeSelectPanel,
  toggleModeSelectOperation,
  type ModeSelectSetupState,
} from '../modeSelectSetup';
import {
  BTN_CHROME,
  BTN_SIZE,
  inputPromptsSlot,
  OVERLAY_BASE,
  type ScreenSpecActions,
} from './shared';
import { playerBadgeTemplate } from './playerProfileScreens';

const MATH_OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];
const MATH_DIFFICULTIES: readonly MathDifficulty[] = ['easy', 'medium', 'expert'];
const OPERATION_CARD_LABELS: Record<EquationOperation, string> = {
  add: 'Add',
  subtract: 'Subtract',
  multiply: 'Multiply',
  divide: 'Divide',
};
const OPERATION_SYMBOLS: Record<EquationOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

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
}

const refreshMathProgress = function(root: HTMLElement, actions: ScreenSpecActions): void {
  const progress = actions.getMathProgress();
  MATH_OPERATIONS.forEach(function(operation): void {
    const track = progress[operation];
    const cue = mathProgressCue(track, MATH_FINAL_STEP);
    $(root, `[data-progress-label="${operation}"]`).textContent = cue.caption;
    const progressBar = $(root, `[data-progress-bar="${operation}"]`);
    progressBar.setAttribute('aria-valuenow', String(cue.highestUnlockedStep));
    progressBar.setAttribute('aria-valuetext', cue.valueText);
    $(root, `[data-progress-fill="${operation}"]`).style.width = `${cue.percentage}%`;
    $(root, `[data-skill-for="${operation}"]`).textContent = mathStepLabel(track.currentStep, operation);
    $(root, `[data-step-for="${operation}"]`).textContent = `Step ${track.currentStep}`;
    $(root, `[data-unlocked-for="${operation}"]`).textContent = `Unlocked through Step ${cue.highestUnlockedStep} of ${MATH_FINAL_STEP}`;
    root.querySelectorAll<HTMLButtonElement>(`[data-step-operation="${operation}"]`).forEach(function(button): void {
      const nextStep = track.currentStep + Number(button.dataset.stepChange);
      button.disabled = nextStep < 1 || nextStep > cue.highestUnlockedStep;
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
      <div class="player-profile-badge-slot" data-player-profile-badge></div>
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
      <div class="gameplay-toast-region">
        <p id="player-save-notice" class="gameplay-toast" role="status" aria-live="polite" aria-atomic="true" hidden></p>
      </div>
    `,
    prompts: [
      { action: 'select', label: 'Select' },
    ],
    promptPlacement: 'panel',
    initialFocusSelector: '.menu-primary-action',
		onShow: (root): void => {
      const badgeSlot = root.querySelector<HTMLElement>('[data-player-profile-badge]');
      if (badgeSlot) render(playerBadgeTemplate(actions), badgeSlot);
      const notice = $(root, '#player-save-notice');
      const sessionOnly = actions.getMathProgressPersistence() === 'session-only';
      notice.textContent = sessionOnly
        ? 'Your profile and progress can’t be saved on this device. You can play until you close the game.'
        : '';
      notice.hidden = !sessionOnly;
    },
  };
}

export function createModeSelectScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  let setupState: ModeSelectSetupState = createModeSelectSetupState();
  let panelTrigger: HTMLButtonElement | undefined;
  let activeRoot: HTMLElement | undefined;
  let isStartingGame = false;

  const focusButton = function(button: HTMLButtonElement | null | undefined): void {
    if (!button || button.disabled) return;
    button.focus();
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const renderSetup = function(root: HTMLElement): void {
    root.dataset.setupStep = setupState.step;
    root.dataset.setupPanel = setupState.panel ?? 'none';
    root.querySelectorAll<HTMLElement>('[data-setup-view]').forEach(function(view): void {
      const name = view.dataset.setupView;
      const isMainStep = setupState.panel === null && name === setupState.step;
      view.classList.toggle('hidden', !isMainStep && name !== setupState.panel);
    });
    root.querySelectorAll<HTMLButtonElement>('.mode-card').forEach(function(button): void {
      const operation = button.dataset.operation;
      if (!isEquationOperation(operation)) return;
      button.setAttribute('aria-pressed', String(setupState.selectedOperations.includes(operation)));
    });
    const hasOperations = setupState.selectedOperations.length > 0;
    $<HTMLButtonElement>(root, '[data-open-math-steps]').disabled = !hasOperations;
    $<HTMLButtonElement>(root, '[data-next-to-pond]').disabled = !hasOperations;
    root.querySelectorAll<HTMLButtonElement>('.pond-choice').forEach(function(button): void {
      button.setAttribute('aria-pressed', String(button.dataset.difficulty === setupState.difficulty));
    });
    $<HTMLButtonElement>(root, '[data-play-selected]').disabled = setupState.difficulty === null;
    root.querySelectorAll<HTMLElement>('[data-step-panel]').forEach(function(panel): void {
      const operation = panel.dataset.stepPanel;
      panel.classList.toggle('hidden', !isEquationOperation(operation) || !setupState.selectedOperations.includes(operation));
    });
    const [firstOperation, ...otherOperations] = setupState.selectedOperations;
    $(root, '#math-step-summary').textContent = firstOperation
      ? `${[firstOperation, ...otherOperations].map(operation => OPERATION_CARD_LABELS[operation]).join(', ')}: continue at your saved step or choose any unlocked step.`
      : 'Choose math operations to see their unlocked steps.';
  };

  const focusFirstInView = function(root: HTMLElement, viewName: string): void {
    const view = root.querySelector<HTMLElement>(`[data-setup-view="${viewName}"]`);
    focusButton(view?.querySelector<HTMLButtonElement>('button:not(:disabled)'));
  };

  const closePanel = function(root: HTMLElement): void {
    if (setupState.panel === null) return;
    setupState = closeModeSelectPanel(setupState);
    renderSetup(root);
    const trigger = panelTrigger;
    panelTrigger = undefined;
    focusButton(trigger ?? root.querySelector<HTMLButtonElement>('.mode-card[aria-pressed="true"]')
      ?? root.querySelector<HTMLButtonElement>('.mode-card'));
  };

  const handleBack = function(root: HTMLElement): void {
    if (setupState.panel !== null) {
      closePanel(root);
      return;
    }
    if (setupState.step === 'pond') {
      setupState = returnModeSelectToMath(setupState);
      renderSetup(root);
      focusButton(root.querySelector<HTMLButtonElement>('[data-next-to-pond]'));
      return;
    }
    actions.goToMenu();
  };

  const openPanel = function(
    root: HTMLElement,
    trigger: HTMLButtonElement,
    panel: Exclude<ModeSelectSetupState['panel'], null>,
  ): void {
    const nextState = showModeSelectPanel(setupState, panel);
    if (nextState === setupState) return;
    panelTrigger = trigger;
    setupState = nextState;
    renderSetup(root);
    focusFirstInView(root, panel);
  };

  const operationCards = MATH_OPERATIONS.map(function(operation): string {
    return `
      <button type="button" data-operation="${operation}" data-focusable aria-pressed="false" class="mode-card">
        <span class="mode-symbol" aria-hidden="true">${OPERATION_SYMBOLS[operation]}</span>
        <span class="mode-name">${OPERATION_CARD_LABELS[operation]}</span>
        <span class="mode-progress-copy" data-progress-label="${operation}">1 step unlocked</span>
        <span class="mode-progress-meter" role="progressbar" aria-label="${operationLabels[operation]} progress" aria-valuemin="0" aria-valuemax="${MATH_FINAL_STEP}" aria-valuenow="1" aria-valuetext="1 of ${MATH_FINAL_STEP} steps unlocked" data-progress-bar="${operation}">
          <span class="mode-progress-fill" data-progress-fill="${operation}"></span>
        </span>
      </button>
    `;
  }).join('');

  const mathStepPanels = MATH_OPERATIONS.map(function(operation): string {
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
  }).join('');

  const difficultyChoices = MATH_DIFFICULTIES.map(function(difficulty): string {
    const pondPadCount = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;
    const pads = Array.from({ length: pondPadCount }, function(_, index): string {
      return `<span class="pond-lily pond-lily-${index + 1}"></span>`;
    }).join('');
    const pondSize = difficulty === 'easy' ? 'Small pond' : difficulty === 'medium' ? 'Bigger pond' : 'Biggest pond';
    return `
      <button type="button" class="difficulty-choice ${difficulty} pond-choice" data-difficulty="${difficulty}" aria-pressed="false">
        <span class="pond-illustration pond-illustration-${difficulty}" aria-hidden="true"><span class="pond-water"></span>${pads}</span>
        <span class="pond-choice-copy"><span class="pond-choice-name">${difficultyLabels[difficulty]}</span><span class="pond-choice-size">${pondSize}</span></span>
      </button>
    `;
  }).join('');

  const difficultyHelp = MATH_DIFFICULTIES.map(function(difficulty): string {
    const board = BOARD_SIZES[difficulty];
    const enemies = GAME_CONFIG.MATH_PROGRESSION.ENEMY_COUNT[difficulty];
    return `<li class="setup-help-row"><strong>${difficultyLabels[difficulty]}</strong><span>${board.width} × ${board.height} spaces · ${enemies} ${enemies === 1 ? 'animal' : 'animals'}</span></li>`;
  }).join('');

  return {
    id: 'mode-select-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="mode-select-shell">
        <section class="setup-view" data-setup-view="math">
          <header class="mode-select-heading">
            <div class="setup-topline">
              <button type="button" class="btn-secondary setup-back" data-setup-back>‹ Back</button>
              <p class="setup-step-indicator" aria-label="Step 1 of 2">1 of 2 <span aria-hidden="true">● ○</span></p>
            </div>
            <h1 class="pond-title text-gold drop-shadow-lg">Pick your math</h1>
            <p>Pick one or more.</p>
          </header>
          <div class="mode-options" role="group" aria-label="Math operations">
            ${operationCards}
          </div>
          <footer class="setup-actions">
            <button type="button" class="btn-secondary setup-optional-action" data-open-math-steps disabled>Math steps</button>
            <button type="button" class="btn-success setup-primary-action" data-next-to-pond disabled>Next <span aria-hidden="true">›</span></button>
          </footer>
        </section>

        <section class="setup-view hidden" data-setup-view="pond">
          <header class="mode-select-heading">
            <div class="setup-topline">
              <button type="button" class="btn-secondary setup-back" data-setup-back>‹ Back</button>
              <p class="setup-step-indicator" aria-label="Step 2 of 2">2 of 2 <span aria-hidden="true">● ●</span></p>
            </div>
            <h1 class="pond-title text-gold drop-shadow-lg">Choose your pond</h1>
            <p>Bigger ponds. More animals.</p>
          </header>
          <div class="pond-choices" role="group" aria-label="Pond difficulty">
            ${difficultyChoices}
          </div>
          <footer class="setup-actions pond-actions">
            <button type="button" class="btn-secondary setup-optional-action" data-open-difficulty-help>What changes?</button>
            <button type="button" class="btn-success setup-primary-action" data-play-selected disabled>Play</button>
          </footer>
        </section>

        <section class="setup-secondary-panel hidden" data-setup-view="math-steps" aria-labelledby="math-progress-heading">
          <header class="setup-secondary-heading">
            <button type="button" class="btn-secondary setup-back" data-close-setup-panel>‹ Done</button>
            <h1 class="pond-title text-gold drop-shadow-lg" id="math-progress-heading">Math steps</h1>
            <p id="math-step-summary">Choose math operations to see their unlocked steps.</p>
          </header>
          <section id="math-progress-select" class="math-progress-panel">
            <div class="math-step-panels">${mathStepPanels}</div>
            <p class="math-milestone-key">Gold: current · Green: unlocked · Dim: locked</p>
            <p id="math-save-status" class="math-save-status" aria-live="polite"></p>
          </section>
          <div id="starting-level-select" class="starting-level-panel hidden" role="group" aria-label="Starting level">
            <span>Starting arcade level</span>
            <button type="button" class="btn-secondary" data-level-change="-1" aria-label="Previous starting level">−</button>
            <output id="starting-level-value" aria-live="polite" aria-label="Starting level">1</output>
            <button type="button" class="btn-secondary" data-level-change="1" aria-label="Next starting level">+</button>
          </div>
        </section>

        <section class="setup-secondary-panel hidden" data-setup-view="difficulty-help" aria-labelledby="difficulty-help-heading">
          <header class="setup-secondary-heading">
            <button type="button" class="btn-secondary setup-back" data-close-setup-panel>‹ Done</button>
            <h1 class="pond-title text-gold drop-shadow-lg" id="difficulty-help-heading">What changes?</h1>
            <p>Each pond has a different size and number of animals.</p>
          </header>
          <ul class="setup-help-list">${difficultyHelp}</ul>
        </section>

        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    promptPlacement: 'panel',
    wire: (root): void => {
      activeRoot = root;
      root.querySelectorAll<HTMLButtonElement>('.mode-card').forEach(function(button): void {
        button.addEventListener('click', function(): void {
          const operation = button.dataset.operation;
          if (!isEquationOperation(operation)) return;
          setupState = toggleModeSelectOperation(setupState, operation);
          renderSetup(root);
        });
      });
      root.querySelectorAll<HTMLButtonElement>('[data-setup-back]').forEach(function(button): void {
        button.addEventListener('click', function(): void { handleBack(root); });
      });
      root.querySelectorAll<HTMLButtonElement>('[data-close-setup-panel]').forEach(function(button): void {
        button.addEventListener('click', function(): void { closePanel(root); });
      });
      $<HTMLButtonElement>(root, '[data-open-math-steps]').addEventListener('click', function(event): void {
        if (!(event.currentTarget instanceof HTMLButtonElement)) return;
        openPanel(root, event.currentTarget, 'math-steps');
      });
      $<HTMLButtonElement>(root, '[data-open-difficulty-help]').addEventListener('click', function(event): void {
        if (!(event.currentTarget instanceof HTMLButtonElement)) return;
        openPanel(root, event.currentTarget, 'difficulty-help');
      });
      $<HTMLButtonElement>(root, '[data-next-to-pond]').addEventListener('click', function(): void {
        setupState = advanceModeSelectToPond(setupState);
        renderSetup(root);
        focusButton(root.querySelector<HTMLButtonElement>('.pond-choice'));
      });
      root.querySelectorAll<HTMLButtonElement>('.pond-choice').forEach(function(button): void {
        button.addEventListener('click', function(): void {
          const difficulty = button.dataset.difficulty;
          if (!isMathDifficulty(difficulty)) return;
          setupState = chooseModeSelectDifficulty(setupState, difficulty);
          renderSetup(root);
          focusButton(button);
        });
      });
      const playButton = $<HTMLButtonElement>(root, '[data-play-selected]');
      playButton.addEventListener('click', function(): void {
        if (isStartingGame) return;
        const request = modeSelectGameRequest(
          setupState,
          selectedStartingLevel(Number($<HTMLOutputElement>(root, '#starting-level-value').value)),
        );
        if (!request) return;
        isStartingGame = true;
        playButton.disabled = true;
        actions.startGame(request.mode, request.difficulty, request.startingLevel);
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
      root.querySelectorAll<HTMLButtonElement>('[data-level-change]').forEach(button => {
        button.addEventListener('click', function(): void {
          const output = $<HTMLOutputElement>(root, '#starting-level-value');
          output.value = String(selectedStartingLevel(Number(output.value) + Number(button.dataset.levelChange)));
        });
      });
      renderSetup(root);
    },
    onShow: function(root): void {
      setupState = createModeSelectSetupState();
      panelTrigger = undefined;
      isStartingGame = false;
      resetModeSelect(root, actions.isLevelSelectionUnlocked());
      refreshMathProgress(root, actions);
      renderSetup(root);
    },
    onLevelSelectionUnlocked: function(root): void {
      setupState = revealModeSelectLevelSelection(setupState);
      panelTrigger = undefined;
      renderSetup(root);
      const panel = $(root, '#starting-level-select');
      panel.classList.remove('hidden');
      panel.querySelector<HTMLButtonElement>('[data-level-change="1"]')?.focus();
      panel.scrollIntoView({ block: 'nearest' });
    },
    onCancel: function(): void {
      if (activeRoot) handleBack(activeRoot);
      else actions.goToMenu();
    },
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
