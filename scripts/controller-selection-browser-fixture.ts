// Test-only entrypoint for the collaborative browser. Run:
// bun --port 3001 scripts/controller-selection-browser-fixture.html
// This simulates the Gamepad API and desktop quit; it is not hardware evidence.
import { runControllerJourney } from './controller-selection-browser-journey';
import type { GamepadLike } from 'ecspresso/plugins/input/input';

const pads: Array<GamepadLike | null> = [null, null, null, null];
const errors: string[] = [];
let quitRequests = 0;

if (new URLSearchParams(location.search).has('fresh')) {
  ['math-marsh.gameplayOnboarding', 'math-marsh.operandOnboarding', 'math-marsh.operandAndResultOnboarding'].forEach(key => localStorage.removeItem(key));
}

Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
window.mathMarshDesktop = { quit: async function (): Promise<void> { quitRequests += 1; } };
window.addEventListener('error', function (event) { errors.push(event.message); });
window.addEventListener('unhandledrejection', function (event) { errors.push(String(event.reason)); });

// Some collaborative preview clients do not deliver animation frames. Only this
// fixture substitutes a timer clock; the production entrypoint keeps native RAF.
if (new URLSearchParams(location.search).has('timerFrames')) {
  window.requestAnimationFrame = function (callback): number {
    return window.setTimeout(function () { callback(performance.now()); }, 16);
  };
  window.cancelAnimationFrame = function (handle): void { window.clearTimeout(handle); };
}

const setPad = function (
  slot: number,
  buttons: readonly number[] = [],
  axes: readonly number[] = [0, 0, 0, 0],
  id = 'Browser fixture Xbox controller',
): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= pads.length) throw new Error('Invalid controller slot');
  pads[slot] = {
    id, connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, button) => ({ pressed: buttons.includes(button), value: buttons.includes(button) ? 1 : 0 })),
  };
};

if (new URLSearchParams(location.search).has('startupClaim')) setPad(1, [0]);

await import('../src/main');
const { gameEngine } = await import('../src/ecs/Engine');

export const controllerFixture = {
    setPad,
    disconnect: function (slot: number): void { pads[slot] = null; },
    observe: function () {
      const player = gameEngine.tryGetSingleton(['player', 'position', 'pathFollower']);
      return {
        screen: gameEngine.getCurrentScreen(),
        selection: gameEngine.getResource('controllerSelection'),
        platform: gameEngine.getResource('inputPrompt').platform,
        clock: gameEngine.getResource('gameplayClock').elapsed,
        time: gameEngine.getResource('remainingTimeSeconds'),
        level: gameEngine.getResource('currentLevel'),
        equationsSolved: gameEngine.getResource('equationsSolved'),
        position: player ? { ...player.components.position } : undefined,
        breadcrumbs: player?.components.pathFollower.breadcrumbs.map(point => ({ ...point })),
        tutorial: { ...gameEngine.getResource('gameplayOnboardingSession') },
        focus: document.activeElement?.id,
        text: document.body.innerText,
        quitRequests,
        errors,
      };
    },
    // Deterministic results fixture: allow the normal gameplay-time/death-delay
    // systems to finish the run rather than changing screens from the harness.
    startCelebration: async function (): Promise<void> {
      await gameEngine.setScreen('levelComplete', { completedLevel: 1, nextLevel: 2, startedAt: performance.now() });
    },
    expireRun: function (): void { gameEngine.setResource('remainingTimeSeconds', 0); },
};

Object.defineProperty(window, '__controllerFixture', {
  value: { ...controllerFixture, runJourney: function () { return runControllerJourney(controllerFixture); } },
});
