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
