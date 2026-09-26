import type { GameSystemRegistrar } from '../Engine';
import { gameplayLevelLabel, updateGameplayUI } from '../../ui/UIManager';
import { playerQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { tutorialHudLabel } from '../../onboarding/gameplayOnboarding';

/**
 * UI System
 * Updates HUD from player state. Gated to the 'playing' screen.
 */

export function addUISystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('uiSystem')
    .setPriority(SYSTEM_PRIORITIES.UI)
    .addSingleton('player', playerQuery)
    .withResources([
      'gameMode',
      'mathDifficulty',
      'currentLevel',
      'remainingTimeSeconds',
      'gameplayOnboardingSession',
    ])
    .setProcess(({ queries, resources }) => {
      const player = queries.player;
      if (!player) return;

      const {
        gameMode,
        mathDifficulty,
        currentLevel,
        remainingTimeSeconds,
        gameplayOnboardingSession,
      } = resources;
      const level = tutorialHudLabel(gameplayOnboardingSession)
        ?? gameplayLevelLabel(gameMode, mathDifficulty, currentLevel);

      updateGameplayUI(remainingTimeSeconds, level);
    });
}
