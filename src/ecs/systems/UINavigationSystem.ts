import { gameEngine } from '../Engine';
import { navigateFocus, activateFocus, triggerCancel } from '../../ui/UIManager';

// Drives DOM focus on non-gameplay screens from the unified input state, so
// keyboard arrows, d-pad, left stick, A button, and Start/B all work in
// menus without bespoke event listeners per screen.
export function addUINavigationSystemToEngine(): void {
  gameEngine.addSystem('uiNavigationSystem')
    .inScreens(['menu', 'modeSelect', 'howToPlay', 'paused', 'settings', 'gameOver'])
    .withResources(['inputState'])
    .setProcess(({ resources: { inputState } }) => {
      const a = inputState.actions;
      if (a.justActivated('up')) navigateFocus('up');
      if (a.justActivated('down')) navigateFocus('down');
      if (a.justActivated('left')) navigateFocus('left');
      if (a.justActivated('right')) navigateFocus('right');
      if (a.justActivated('eat')) activateFocus();
      if (a.justActivated('pause')) triggerCancel();
    });
}
