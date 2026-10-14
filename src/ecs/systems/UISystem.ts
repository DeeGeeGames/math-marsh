import type { GameSystemRegistrar } from '../Engine';
import { gameplayLevelLabel, updateGameplayUI } from '../../ui/UIManager';
import { operationLabels } from '../../ui/labels';
import { playerQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { tutorialHudLabel } from '../../onboarding/gameplayOnboarding';
import { pondThemeForPromptKind } from '../pondTheme';
import { setGameMusicTime } from '../../audio/audio';

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
      'equationMode',
      'practiceSession',
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
        equationMode,
        practiceSession,
      } = resources;
      const level = tutorialHudLabel(gameplayOnboardingSession)
        ?? (practiceSession
          ? `Practice · ${operationLabels[practiceSession.operation]} · Step ${practiceSession.step}`
          : gameplayLevelLabel(gameMode, mathDifficulty, currentLevel));

      updateGameplayUI(remainingTimeSeconds, level, pondThemeForPromptKind(equationMode.promptKind).phase);
      setGameMusicTime(remainingTimeSeconds);
    });
}
