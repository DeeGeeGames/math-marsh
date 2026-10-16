import type { GameSystemRegistrar } from '../Engine';
import { addMathAssessmentTime, createMathAssessment, mathAssessmentForEvaluation } from '../mathAssessment';
import { MATH_FINAL_STEP } from '../mathSteps';
import { mathSceneIdsForUnlockedSteps } from '../mathMode';
import { evaluateMathProgressionRound } from '../mathProgression';
import { activePlayerProfile, updateActivePlayerProfile } from '../playerProfiles';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { GAME_CONFIG } from '../../config';
import { playerQuery } from '../queries';

/** Assess arithmetic during normal play, independently for each selected operation. */
export function addMathProgressionSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('mathProgressionSystem')
    .inGroup('gameplay')
    .inScreens(['playing'])
    .setPriority(SYSTEM_PRIORITIES.MATH_PROGRESSION)
    .runWhenEmpty()
    .addQuery('players', playerQuery)
    .withResources(['mathSession', 'playerProfiles', 'equationMode', 'gameplayOnboardingSession'])
    .setProcess(({ ecs, dt, queries, resources }) => {
      const session = resources.mathSession;
      if (!session || ecs.getCurrentScreen() !== 'playing' || resources.gameplayOnboardingSession.active) return;
      const profile = activePlayerProfile(resources.playerProfiles);
      if (!profile) return;
      if (ecs.tryGetResource('mathRoundCompletedThisBoard')) return;
      if (queries.players.some(player => player.components.player.gameOverPending)) return;
      const operation = resources.equationMode.operation;
      const track = session.tracks[operation];
      const timed = addMathAssessmentTime(track.assessment, dt);
      if (!timed) return;
      const timedSession = { ...session, tracks: { ...session.tracks, [operation]: { ...track, assessment: timed } } };
      ecs.setResource('mathSession', timedSession);
      if (resources.equationMode.feedback !== undefined) return;

      // The feedback's next prompt may select another operation. Finish the
      // prior operation's sample without crediting either operation with the other's work.
      const completedOperation = (['add', 'subtract', 'multiply', 'divide'] as const)
        .find(candidate => timedSession.tracks[candidate].assessment.correctAnswers
          >= GAME_CONFIG.MATH_PROGRESSION.MINIMUM_COMPLETED_EQUATIONS);
      if (!completedOperation) return;
      const completedTrack = timedSession.tracks[completedOperation];
      const assessment = mathAssessmentForEvaluation(completedTrack.assessment);
      if (!assessment) return;
      const saved = profile.mathProgress[completedOperation];
      const outcome = evaluateMathProgressionRound({
        currentStep: completedTrack.step,
        highestUnlockedStep: saved.highestUnlockedStep,
        accelerationStreak: completedTrack.accelerationStreak,
      }, assessment, MATH_FINAL_STEP);
      if (outcome.kind === 'invalid' || outcome.kind === 'insufficientSample') return;

      const mathProgress = {
        ...profile.mathProgress,
        [completedOperation]: {
          currentStep: outcome.progress.currentStep,
          highestUnlockedStep: outcome.progress.highestUnlockedStep,
        },
      };
      const nextSession = {
        ...timedSession,
        tracks: { ...timedSession.tracks, [completedOperation]: {
          ...completedTrack,
          step: outcome.progress.currentStep,
          accelerationStreak: outcome.progress.accelerationStreak,
          assessment: createMathAssessment(),
        } },
      };
      ecs.setResource('mathRoundCompletedThisBoard', true);
      ecs.setResource('mathSession', nextSession);
      const unlockedSceneIds = mathSceneIdsForUnlockedSteps(outcome.unlockedSteps)
        .filter(id => !profile.skitProgress.includes(id));
      const skitProgress = [...profile.skitProgress, ...unlockedSceneIds];
      const playerProfiles = updateActivePlayerProfile(resources.playerProfiles, active => ({
        ...active,
        mathProgress,
        skitProgress,
      }));
      ecs.setResource('playerProfiles', playerProfiles);
      ecs.setResource('mathRoundSummary', {
        operation: completedOperation,
        assessedStep: completedTrack.step,
        assessment,
        outcome,
        unlockedSceneIds,
      });
    });
}
