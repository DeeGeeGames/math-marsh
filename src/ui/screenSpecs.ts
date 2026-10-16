import { createSkitScreenSpec } from './screens/skitScreen';
import { createSkitGalleryScreenSpec } from './screens/skitGalleryScreen';
import { createSplashScreenSpec } from './screens/splashScreen';
import type { ScreenSpec, UIScreen } from './screenTypes';
import {
  createGameOverScreenSpec,
  createPauseScreenSpec,
  createControllerRecoveryScreenSpec,
  createPlayingScreenSpec,
} from './screens/gameplayScreenSpecs';
import {
  createHowToPlayScreenSpec,
  createMenuScreenSpec,
  createModeSelectScreenSpec,
  createTutorialOfferScreenSpec,
  resetModeSelect,
} from './screens/menuScreenSpecs';
import { createSettingsScreenSpec } from './screens/settingsScreen';
import {
	createPlayerAddScreenSpec,
	createPlayerDeleteScreenSpec,
	createPlayerManagementScreenSpec,
	createPlayerRenameScreenSpec,
	createPlayerRosterScreenSpec,
	createPlayerSetupScreenSpec,
} from './screens/playerProfileScreens';
import type { ScreenSpecActions } from './screens/shared';

export { resetModeSelect };

export function createScreenSpecs(
  actions: ScreenSpecActions,
): Record<UIScreen, ScreenSpec> {
  return {
    studioSplash: createSplashScreenSpec('studioSplash'),
    engineSplash: createSplashScreenSpec('engineSplash'),
    skit: createSkitScreenSpec(actions.skipSkit),
    skitGallery: createSkitGalleryScreenSpec(actions),
    menu: createMenuScreenSpec(actions),
    playerSetup: createPlayerSetupScreenSpec(actions),
    playerRoster: createPlayerRosterScreenSpec(actions),
    playerAdd: createPlayerAddScreenSpec(actions),
    playerManagement: createPlayerManagementScreenSpec(actions),
    playerRename: createPlayerRenameScreenSpec(actions),
    playerDelete: createPlayerDeleteScreenSpec(actions),
    modeSelect: createModeSelectScreenSpec(actions),
    howToPlay: createHowToPlayScreenSpec(actions),
    tutorialOffer: createTutorialOfferScreenSpec(actions),
    playing: createPlayingScreenSpec(actions),
    settings: createSettingsScreenSpec(actions),
    gameOver: createGameOverScreenSpec(actions),
    paused: createPauseScreenSpec(actions),
    controllerRecovery: createControllerRecoveryScreenSpec(actions),
  };
}
