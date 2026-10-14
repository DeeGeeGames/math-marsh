import type { EquationModeState, EquationOperation, GameMode } from './types';
import { createMathAssessment, type MathAssessmentState } from './mathAssessment';
import type { MathAssessment, MathProgressionResult } from './mathProgression';
import { SKITS, type SkitId } from './skitSequence';
import type { SavedMathProgress } from './mathProgressStore';
import { createMathEquationModeState } from './mathSteps';
import { mathStepForNumber } from './mathSteps';
import { operationForMode } from '../math/equations';
import type { GameplayOnboardingCompletion, GameplayOnboardingKind } from '../onboarding/gameplayOnboarding';

export const MATH_SCENE_UNLOCK_STEPS = [3, 6, 9, 11] as const;

export type MathTrackSession = Readonly<{
  step: number;
  accelerationStreak: number;
  assessment: MathAssessmentState;
}>;

export type MathSession = Readonly<{
  tracks: Readonly<Record<EquationOperation, MathTrackSession>>;
}>;

export type MathRoundSummary = Readonly<{
  operation: EquationOperation;
  assessedStep: number;
  assessment: MathAssessment;
  outcome: MathProgressionResult;
  unlockedSceneIds: readonly SkitId[];
}>;

export const createMathSession = function(
  progress: SavedMathProgress,
): MathSession {
  const track = function(operation: EquationOperation): MathTrackSession {
    return {
      step: progress[operation].currentStep,
      accelerationStreak: 0,
      assessment: createMathAssessment(),
    };
  };
  return {
    tracks: { add: track('add'), subtract: track('subtract'), multiply: track('multiply'), divide: track('divide') },
  };
};

export const equationModeForMathSession = function(
  session: MathSession,
  mode: GameMode,
  level: number,
  clearedThisLevel = 0,
): EquationModeState {
  const operation = operationForMode(mode);
  const track = session.tracks[operation];
  const state = createMathEquationModeState(track.step, operation, track.assessment.correctAnswers, clearedThisLevel);
  if (!state) throw new Error('Cannot generate an equation for an invalid math step');
  return { ...state, level };
};

export const mathSceneIdsForUnlockedSteps = function(
	steps: readonly number[],
): readonly SkitId[] {
	return MATH_SCENE_UNLOCK_STEPS.flatMap((threshold, index) => {
		const skit = SKITS[index];
		return skit && steps.includes(threshold) ? [skit.id] : [];
	});
};

export const mathTutorialForMode = function(
  session: MathSession,
  mode: GameMode,
  operands: GameplayOnboardingCompletion,
  mixed: GameplayOnboardingCompletion,
): GameplayOnboardingKind | undefined {
  const formats = mode.flatMap(operation => mathStepForNumber(session.tracks[operation].step)?.assessmentFormats ?? []);
  if (operands === 'pending' && formats.includes('selectOperands')) return 'operands';
  if (mixed === 'pending' && formats.includes('selectOperandAndResult')) return 'operandAndResult';
  return undefined;
};
