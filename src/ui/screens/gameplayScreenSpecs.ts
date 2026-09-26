import { $ } from '../dom';
import { bindGameplayHud } from '../gameplayHud';
import type { ScreenSpec } from '../screenTypes';
import { bindTouchControls } from '../touchControls';
import { bindBoardPointer } from '../boardPointer';
import {
  BTN_CHROME,
  BTN_SIZE,
  inputPromptsSlot,
  OVERLAY_BASE,
  type ScreenSpecActions,
} from './shared';

export function createPlayingScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'gameplay-ui',
    className: 'absolute inset-0 flex flex-col pointer-events-none z-10',
    html: `
      <header id="top-hud" class="gameplay-header">
        <div class="gameplay-status" role="group" aria-label="Game status">
          <span id="time-display" role="timer" class="sr-only">Time left: 1:30</span>
        </div>

        <div id="level-display" class="hud-chip level">Addition - Easy - Level 1</div>

        <div class="gameplay-actions" role="group" aria-label="Game controls">
          <button id="hud-fullscreen-btn" type="button" class="utility-btn gameplay-action gameplay-fullscreen" aria-label="Enter fullscreen">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
          </button>
          <button id="pause-btn" type="button" class="utility-btn gameplay-action" aria-label="Pause game">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14" /></svg>
            <span>Pause</span>
          </button>
        </div>
      </header>

      <div id="canvas-container" class="flex-1 min-h-0 min-w-0 flex items-center justify-center mb-16 md:mb-20 px-2 md:px-4">
        <canvas id="game-canvas" class="rounded-lg max-w-full max-h-full"></canvas>
      </div>

      <div id="bottom-hud" class="hud-bottom absolute bottom-0 inset-x-0 p-3 md:p-4 lg:p-5 flex justify-center items-center text-white pointer-events-auto">
        <div id="hints-display" class="text-xs md:text-sm lg:text-base text-center opacity-80 max-w-xs md:max-w-md lg:max-w-lg px-2">
          ${inputPromptsSlot()}
        </div>
      </div>

      <section id="gameplay-onboarding" class="gameplay-onboarding hidden" aria-live="polite">
        <div class="gameplay-onboarding-copy">
          <p id="gameplay-onboarding-kicker" class="gameplay-onboarding-kicker">Step 1 of 5</p>
          <h2 id="gameplay-onboarding-title">Move across the pond</h2>
          <p id="gameplay-onboarding-copy">The fly moves from one lily pad to the next.</p>
        </div>
        <div class="gameplay-onboarding-actions">
          <button id="tutorial-back-btn" type="button" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.md}">
            Back
          </button>
          <button id="tutorial-next-btn" type="button" class="btn-success ${BTN_CHROME} ${BTN_SIZE.md}">
            Next
          </button>
          <button id="skip-tutorial-btn" type="button" class="tutorial-skip-btn">
            Skip
          </button>
        </div>
      </section>

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
    promptPlacement: 'hud',
    wire: (root): void => {
      $(root, '#pause-btn').addEventListener('click', actions.pauseGame);
      actions.wireFullscreenButton($<HTMLButtonElement>(root, '#hud-fullscreen-btn'));
      bindGameplayHud(root);
      bindTouchControls(root);
      bindBoardPointer($<HTMLCanvasElement>(root, '#game-canvas'), actions.tapBoardPoint);
      $(root, '#tutorial-back-btn').addEventListener('click', actions.previousTutorialStep);
      $(root, '#tutorial-next-btn').addEventListener('click', actions.nextTutorialStep);
      $(root, '#skip-tutorial-btn').addEventListener('click', actions.skipTutorial);
    },
  };
}

export function createGameOverScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
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

          <div id="run-result" class="run-result mt-4 sm:mt-5 text-xl sm:text-2xl md:text-3xl font-bold drop-shadow-md" aria-live="polite">
            Level 1 · 0 equations solved
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
    promptPlacement: 'panel',
    wire: (root): void => {
      $(root, '#play-again-btn').addEventListener('click', actions.replayGame);
      $(root, '#main-menu-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.goToMenu,
  };
}

export function createPauseScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'pause-screen',
    className: `${OVERLAY_BASE} contextual-gameplay-overlay`,
    html: `
      <div class="pause-panel overlay-panel text-center w-[min(92vw,28rem)] px-6 py-6 sm:py-8" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title" class="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 md:mb-12 drop-shadow-lg">⏸️ PAUSED</h2>

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
    promptPlacement: 'panel',
    wire: (root): void => {
      $(root, '#resume-btn').addEventListener('click', actions.returnToPreviousScreen);
      $(root, '#pause-settings-btn').addEventListener('click', actions.openSettings);
      $(root, '#quit-to-menu-btn').addEventListener('click', actions.goToMenu);
    },
    onCancel: actions.returnToPreviousScreen,
  };
}
