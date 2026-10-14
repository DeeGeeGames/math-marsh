import type { GameSystemRegistrar } from '../Engine';
import { gameplayLevelLabel, updateGameplayUI } from '../../ui/UIManager';
import { operationLabels } from '../../ui/labels';
import { playerQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { tutorialHudLabel } from '../../onboarding/gameplayOnboarding';
import { pondThemeForPromptKind } from '../pondTheme';
import { setGameMusicTime } from '../../audio/audio';
import { mathStepLabel } from '../mathSteps';

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
      'mathSession',
      'mathRoundSummary',
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
        mathSession,
        mathRoundSummary,
      } = resources;
      const level = tutorialHudLabel(gameplayOnboardingSession)
        ?? (mathSession
          ? `Level ${currentLevel} · ${mathDifficulty} - ${mathStepLabel(mathSession.tracks[equationMode.operation].step, equationMode.operation)}`
          : gameplayLevelLabel(gameMode, mathDifficulty, currentLevel));
      const outcome = mathRoundSummary?.outcome;
      const notice = !gameplayOnboardingSession.active && mathRoundSummary && outcome
        ? outcome.kind === 'advanced'
          ? `${operationLabels[mathRoundSummary.operation]}: ${outcome.accelerated ? 'fast and accurate! ' : ''}${outcome.advanceBy > 0
            ? `Advanced ${outcome.advanceBy} step${outcome.advanceBy === 1 ? '' : 's'} to ${outcome.progress.currentStep}.`
            : 'Final step reached.'}${mathRoundSummary.unlockedSceneIds.length > 0 ? ' New scene unlocked!' : ''}`
          : outcome.kind === 'stayed' ? `${operationLabels[mathRoundSummary.operation]}: keep practicing this step. Your unlocks are kept.` : ''
        : '';
      updateGameplayUI(remainingTimeSeconds, level, pondThemeForPromptKind(equationMode.promptKind).phase, notice);
      setGameMusicTime(remainingTimeSeconds);
    });
}
