import * as ui from '../../src/ui/UIManager';
import { gameEngine as engine } from '../../src/ecs/Engine';

const importedContainerCount = document.querySelectorAll('#game-container').length;
const handlers = new Set<() => void>();
window.mathMarshDesktop = {
  fullscreen: {
    isSupported: () => true,
    isActive: () => false,
    toggle: async () => {},
    onChange: function(handler) { handlers.add(handler); return () => handlers.delete(handler); },
  },
};
engine.setResource('playerProfiles', engine.getResource('profilePersistence').create(engine.getResource('playerProfiles'), 'Mira', 'mira').state);
await engine.initialize();
let dispose: (() => void) | undefined;
let staleDispose: (() => void) | undefined;
const fixture = {
  importedContainerCount,
  fullscreenSubscriptions: () => handlers.size,
  initialize: function(): void { staleDispose = dispose; dispose = ui.initializeUI(engine); },
  dispose: function(): void { dispose?.(); },
  staleDispose: function(): void { staleDispose?.(); },
  showMenu: function(): void { ui.showScreen('menu'); },
  showGameplay: function(): void { ui.showGameplayScreen('normal'); },
  showPause: function(): void { ui.showPauseScreen(); },
  showSettings: function(): void { ui.showSettingsScreen('paused'); },
  cancelAndReplace: async function(): Promise<void> {
    await engine.setScreen('playerRoster', {});
    await engine.pushScreen('playerAdd', {});
    ui.showScreen('playerAdd', { retainMenu: true });
    ui.triggerCancel();
    dispose?.();
    dispose = ui.initializeUI(engine);
    ui.showScreen('menu');
    document.querySelector<HTMLButtonElement>('#main-menu .menu-secondary-action')?.focus();
  },
  navigate: function(): void { ui.navigateFocus('down'); },
};
declare global {
  interface Window { uiLifecycleFixture: typeof fixture; }
}
window.uiLifecycleFixture = fixture;
