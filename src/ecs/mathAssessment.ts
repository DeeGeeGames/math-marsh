import { GAME_CONFIG } from '../config';
import type { MathAssessment } from './mathProgression';

export type MathAssessmentState = Readonly<{
  correctAnswers: number;
  incorrectAnswers: number;
  activeSeconds: number | null;
  expectedSecondsTotal: number | null;
}>;

export const createMathAssessment = function(): MathAssessmentState {
  return {
    correctAnswers: 0,
    incorrectAnswers: 0,
    activeSeconds: 0,
    expectedSecondsTotal: 0,
  };
};

const isValidAssessment = (assessment: MathAssessmentState): boolean =>
  Number.isSafeInteger(assessment.correctAnswers)
  && assessment.correctAnswers >= 0
  && Number.isSafeInteger(assessment.incorrectAnswers)
  && assessment.incorrectAnswers >= 0
  && (assessment.activeSeconds === null
    || (Number.isFinite(assessment.activeSeconds) && assessment.activeSeconds >= 0))
  && (assessment.expectedSecondsTotal === null
    || (Number.isFinite(assessment.expectedSecondsTotal) && assessment.expectedSecondsTotal >= 0));

export const addMathAssessmentTime = function(
  assessment: MathAssessmentState,
  deltaSeconds: number,
): MathAssessmentState | undefined {
  if (!isValidAssessment(assessment)) return undefined;
  if (assessment.activeSeconds === null) return assessment;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    return { ...assessment, activeSeconds: null };
  }

  const activeSeconds = assessment.activeSeconds + deltaSeconds;
  return Number.isFinite(activeSeconds)
    ? { ...assessment, activeSeconds }
    : { ...assessment, activeSeconds: null };
};

export const recordMathAssessmentAnswer = function(
  assessment: MathAssessmentState,
  correct: boolean,
  expectedSecondsPerCorrect?: number,
): MathAssessmentState | undefined {
  if (!isValidAssessment(assessment)) return undefined;
  if (assessment.correctAnswers >= GAME_CONFIG.MATH_PROGRESSION.MINIMUM_COMPLETED_EQUATIONS) {
    return assessment;
  }

  if (!correct) {
    if (!Number.isSafeInteger(assessment.incorrectAnswers + 1)) return undefined;
    return { ...assessment, incorrectAnswers: assessment.incorrectAnswers + 1 };
  }

  if (!Number.isSafeInteger(assessment.correctAnswers + 1)) return undefined;
  const expectedSecondsTotal = assessment.expectedSecondsTotal === null
    || expectedSecondsPerCorrect === undefined
    || !Number.isFinite(expectedSecondsPerCorrect)
    || expectedSecondsPerCorrect <= 0
    ? null
    : assessment.expectedSecondsTotal + expectedSecondsPerCorrect;

  return {
    ...assessment,
    correctAnswers: assessment.correctAnswers + 1,
    expectedSecondsTotal: expectedSecondsTotal !== null && Number.isFinite(expectedSecondsTotal)
      ? expectedSecondsTotal
      : null,
  };
};

export const mathAssessmentForEvaluation = function(
  assessment: MathAssessmentState,
): MathAssessment | undefined {
  if (!isValidAssessment(assessment)) return undefined;
  const expectedSecondsPerCorrect = assessment.expectedSecondsTotal !== null
    && assessment.correctAnswers > 0
    ? assessment.expectedSecondsTotal / assessment.correctAnswers
    : undefined;
  return {
    correctAnswers: assessment.correctAnswers,
    incorrectAnswers: assessment.incorrectAnswers,
    ...(assessment.activeSeconds !== null ? { activeSeconds: assessment.activeSeconds } : {}),
    ...(expectedSecondsPerCorrect !== undefined && Number.isFinite(expectedSecondsPerCorrect)
      ? { expectedSecondsPerCorrect }
      : {}),
  };
};
