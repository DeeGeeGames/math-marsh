import '../../src/main';
import { gameEngine } from '../../src/ecs/Engine';

// Only the browser fixture exposes game state for deterministic setup. Gameplay
// still runs through the normal bootstrap, progression system, and UI adapter.
declare global {
	interface Window {
		toastTestEngine: typeof gameEngine;
	}
}
window.toastTestEngine = gameEngine;

import { initializeUI, showPauseScreen } from '../../src/ui/UIManager';
import { getCtx } from '../../src/ecs/systems/render/context';

declare global {
  interface Window {
    replacePausedTestUI: () => void;
    rendererTargetsTestCanvas: () => boolean;
  }
}
window.replacePausedTestUI = function(): void {
  initializeUI(gameEngine);
  showPauseScreen();
};
window.rendererTargetsTestCanvas = function(): boolean {
  return getCtx()?.canvas === document.querySelector('#game-canvas');
};
