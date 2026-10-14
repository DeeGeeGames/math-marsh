import type { EquationModeState, EquationOperation, GameMode, MathDifficulty } from './types';
import { createMathAssessment, type MathAssessmentState } from './mathAssessment';
import type { MathAssessment, MathProgressionResult } from './mathProgression';
import { SKITS, type SkitId } from './skitSequence';
import type { SavedMathProgress } from './mathProgressStore';
import { mathOperandRanges } from './mathSteps';
import { createEquationModeState } from '../math/equations';
import { shouldStartOperandTutorial, shouldStartOperandAndResultTutorial, type GameplayOnboardingCompletion, type GameplayOnboardingKind } from '../onboarding/gameplayOnboarding';

export const MATH_SCENE_UNLOCK_STEPS = [3, 6, 9, 11] as const;

export type MathTrackSession = Readonly<{
  step: number;
  boardStep: number;
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
      boardStep: progress[operation].currentStep,
      accelerationStreak: 0,
      assessment: createMathAssessment(),
    };
  };
  return {
    tracks: { add: track('add'), subtract: track('subtract'), multiply: track('multiply'), divide: track('divide') },
  };
};

/** Snapshot every operation's number range once when a board spawns. */
export const mathSessionForBoard = function(session: MathSession): MathSession {
  const track = function(operation: EquationOperation): MathTrackSession {
    return { ...session.tracks[operation], boardStep: session.tracks[operation].step };
  };
  return { tracks: { add: track('add'), subtract: track('subtract'), multiply: track('multiply'), divide: track('divide') } };
};

export const equationModeForMathSession = function(
  session: MathSession,
  mode: GameMode,
  level: number,
  clearedThisLevel = 0,
  difficulty: MathDifficulty = 'easy',
): EquationModeState {
  const state = createEquationModeState(level, difficulty, mode, clearedThisLevel);
  const operandRanges = mathOperandRanges(session.tracks[state.operation].boardStep, state.operation);
  if (!operandRanges) throw new Error('Cannot generate an equation for an invalid math step');
  return { ...state, operandRanges };
};

export const mathSceneIdsForUnlockedSteps = function(
	steps: readonly number[],
): readonly SkitId[] {
	return MATH_SCENE_UNLOCK_STEPS.flatMap((threshold, index) => {
		const skit = SKITS[index];
		return skit && steps.includes(threshold) ? [skit.id] : [];
	});
};

export const mathTutorialForLevel = function(
  level: number,
  difficulty: MathDifficulty,
  operands: GameplayOnboardingCompletion,
  mixed: GameplayOnboardingCompletion,
): GameplayOnboardingKind | undefined {
  if (shouldStartOperandTutorial(level, difficulty, operands)) return 'operands';
  if (shouldStartOperandAndResultTutorial(level, difficulty, mixed)) return 'operandAndResult';
  return undefined;
};
