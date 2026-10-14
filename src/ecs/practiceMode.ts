import type { EquationOperation } from './types';
import { createPracticeAssessment, type PracticeAssessmentState } from './practiceAssessment';
import type { PracticeAssessment, PracticeProgressionResult } from './practiceProgression';
import { SKITS, type SkitId } from './skitSequence';

export const PRACTICE_SCENE_UNLOCK_STEPS = [3, 6, 9, 11] as const;

export type PracticeSession = Readonly<{
  operation: EquationOperation;
  step: number;
  accelerationStreak: number;
  assessment: PracticeAssessmentState;
}>;

export type PracticeRoundSummary = Readonly<{
  operation: EquationOperation;
  assessedStep: number;
  assessment: PracticeAssessment;
  outcome: PracticeProgressionResult;
  unlockedSceneIds: readonly SkitId[];
}>;

export const createPracticeSession = function(
  operation: EquationOperation,
  step: number,
  accelerationStreak = 0,
): PracticeSession {
  return {
    operation,
    step,
    accelerationStreak,
    assessment: createPracticeAssessment(),
  };
};

export const practiceSceneIdsForUnlockedSteps = function(
	steps: readonly number[],
): readonly SkitId[] {
	return PRACTICE_SCENE_UNLOCK_STEPS.flatMap((threshold, index) => {
		const skit = SKITS[index];
		return skit && steps.includes(threshold) ? [skit.id] : [];
	});
};
