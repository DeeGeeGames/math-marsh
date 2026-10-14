import { advanceLevelSelectSequence, LEVEL_SELECT_SEQUENCE } from '../levelSelectionCheat';
import { gameActions } from '../controllerSelection';
import type { GameSystemRegistrar } from '../Engine';
import { navigateFocus, activateFocus, triggerCancel, revealLevelSelection } from '../../ui/UIManager';

const CHEAT_DIRECTIONS = [...new Set(LEVEL_SELECT_SEQUENCE)];

// Drives DOM focus on non-gameplay screens from the unified input state, so
// keyboard arrows, d-pad, left stick, A button, and Start/B all work in
// menus without bespoke event listeners per screen.
export function addUINavigationSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('uiNavigationSystem')
    .inScreens(['menu', 'skitGallery', 'modeSelect', 'practiceSelect', 'practiceResult', 'howToPlay', 'tutorialOffer', 'paused', 'controllerRecovery', 'settings', 'gameOver'])
    .withResources(['inputState', 'controllerSelection', 'levelSelectionUnlocked'])
    .setProcess(({ ecs, dt, resources: { inputState, controllerSelection, levelSelectionUnlocked } }) => {
      const a = gameActions(inputState, controllerSelection);
      if (ecs.getCurrentScreen() === 'modeSelect' && !levelSelectionUnlocked) {
        const directions = CHEAT_DIRECTIONS.filter(direction => a.justActivated(direction));
        const next = advanceLevelSelectSequence(ecs.getScreenState('modeSelect'), directions, dt,
          controllerSelection.blockFrame || a.justActivated('eat') || a.justActivated('back') || a.justActivated('pause'));
        ecs.updateScreenState('modeSelect', next.state);
        if (next.unlocked) {
          ecs.setResource('levelSelectionUnlocked', true);
          revealLevelSelection();
          return;
        }
      }
      if (a.justActivated('up')) navigateFocus('up');
      if (a.justActivated('down')) navigateFocus('down');
      if (a.justActivated('left')) navigateFocus('left');
      if (a.justActivated('right')) navigateFocus('right');
      if (a.justActivated('eat')) activateFocus();
      if (a.justActivated('back') || a.justActivated('pause')) triggerCancel();
    });
}
