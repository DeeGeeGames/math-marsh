import { gameActions } from '../controllerSelection';
import type { GameSystemRegistrar } from '../Engine';
import { navigateFocus, activateFocus, triggerCancel } from '../../ui/UIManager';

// Drives DOM focus on non-gameplay screens from the unified input state, so
// keyboard arrows, d-pad, left stick, A button, and Start/B all work in
// menus without bespoke event listeners per screen.
export function addUINavigationSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('uiNavigationSystem')
    .inScreens(['menu', 'skitGallery', 'modeSelect', 'howToPlay', 'tutorialOffer', 'paused', 'controllerRecovery', 'settings', 'gameOver'])
    .withResources(['inputState', 'controllerSelection'])
    .setProcess(({ resources: { inputState, controllerSelection } }) => {
      const a = gameActions(inputState, controllerSelection);
      if (a.justActivated('up')) navigateFocus('up');
      if (a.justActivated('down')) navigateFocus('down');
      if (a.justActivated('left')) navigateFocus('left');
      if (a.justActivated('right')) navigateFocus('right');
      if (a.justActivated('eat')) activateFocus();
      if (a.justActivated('back') || a.justActivated('pause')) triggerCancel();
    });
}
