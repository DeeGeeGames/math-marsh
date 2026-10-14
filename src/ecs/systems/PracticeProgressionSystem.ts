import type { GameSystemRegistrar } from '../Engine';
import { saveSkitProgress } from '../skitProgress';
import { addPracticeAssessmentTime, practiceAssessmentForEvaluation } from '../practiceAssessment';
import { PRACTICE_FINAL_STEP } from '../practiceSteps';
import { practiceSceneIdsForUnlockedSteps } from '../practiceMode';
import { evaluatePracticeProgressionRound } from '../practiceProgression';
import { savePracticeProgress } from '../practiceProgressStore';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { GAME_CONFIG } from '../../config';
import { playerQuery } from '../queries';
import type { SkitId } from '../skitSequence';

const mergeSkitProgress = function(
	progress: readonly SkitId[],
	newIds: readonly SkitId[],
): readonly SkitId[] {
	return [...progress, ...newIds.filter(id => !progress.includes(id))];
};

export function addPracticeProgressionSystemToEngine(systems: GameSystemRegistrar): void {
	systems.addSystem('practiceProgressionSystem')
		.inGroup('gameplay')
		.inScreens(['playing'])
		.setPriority(SYSTEM_PRIORITIES.PRACTICE_PROGRESSION)
		.runWhenEmpty()
		.addQuery('players', playerQuery)
		.withResources([
			'practiceSession',
			'practiceProgress',
			'practiceRoundSummary',
			'practiceAccelerationStreak',
			'equationMode',
			'gameplayOnboardingSession',
			'skitProgress',
		])
		.setProcess(({ ecs, dt, queries, resources }) => {
			const { practiceSession } = resources;
			if (!practiceSession || ecs.getCurrentScreen() !== 'playing') return;
			if (queries.players.some(player => player.components.player.gameOverPending)) return;

			const activeAssessment = resources.gameplayOnboardingSession.active
				? practiceSession.assessment
				: addPracticeAssessmentTime(practiceSession.assessment, dt);
			if (!activeAssessment) return;
			const updatedSession = { ...practiceSession, assessment: activeAssessment };
			ecs.setResource('practiceSession', updatedSession);

			if (
				updatedSession.assessment.correctAnswers < GAME_CONFIG.PRACTICE_PROGRESSION.MINIMUM_COMPLETED_EQUATIONS
				|| resources.equationMode.feedback !== undefined
				|| resources.practiceRoundSummary !== null
			) return;

			const assessment = practiceAssessmentForEvaluation(updatedSession.assessment);
			const outcome = assessment
				? evaluatePracticeProgressionRound(
					{
						currentStep: resources.practiceProgress[updatedSession.operation].currentStep,
						highestUnlockedStep: resources.practiceProgress[updatedSession.operation].highestUnlockedStep,
						accelerationStreak: updatedSession.accelerationStreak,
					},
					assessment,
					PRACTICE_FINAL_STEP,
				)
				: { kind: 'invalid' as const, reason: 'sample' as const };
			let newlyUnlockedScenes: readonly SkitId[] = [];

			if (outcome.kind !== 'invalid') {
				ecs.setResource('practiceAccelerationStreak', outcome.progress.accelerationStreak);
				const previousTrack = resources.practiceProgress[updatedSession.operation];
				const nextTrack = {
					currentStep: outcome.progress.currentStep,
					highestUnlockedStep: outcome.progress.highestUnlockedStep,
				};
				if (
					nextTrack.currentStep !== previousTrack.currentStep
					|| nextTrack.highestUnlockedStep !== previousTrack.highestUnlockedStep
				) {
					const practiceProgress = {
						...resources.practiceProgress,
						[updatedSession.operation]: nextTrack,
					};
					ecs.setResource('practiceProgress', practiceProgress);
					ecs.setResource(
						'practiceProgressPersistence',
						savePracticeProgress(practiceProgress) ? 'persistent' : 'session-only',
					);
				}

				newlyUnlockedScenes = practiceSceneIdsForUnlockedSteps(outcome.unlockedSteps)
					.filter(id => !resources.skitProgress.includes(id));
				if (newlyUnlockedScenes.length > 0) {
					const skitProgress = mergeSkitProgress(resources.skitProgress, newlyUnlockedScenes);
					ecs.setResource('skitProgress', skitProgress);
					saveSkitProgress(skitProgress);
				}
			}

			ecs.setResource('practiceRoundSummary', {
				operation: updatedSession.operation,
				assessedStep: updatedSession.step,
				assessment: assessment ?? {
					correctAnswers: updatedSession.assessment.correctAnswers,
					incorrectAnswers: updatedSession.assessment.incorrectAnswers,
				},
				outcome,
				unlockedSceneIds: newlyUnlockedScenes,
			});
			void ecs.setScreen('practiceResult', {});
		});
}
