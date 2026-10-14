import { GAME_CONFIG } from '../config';

export type PracticeProgress = Readonly<{
  currentStep: number;
  highestUnlockedStep: number;
  accelerationStreak: number;
}>;

export type PracticeAssessment = Readonly<{
  correctAnswers: number;
  incorrectAnswers: number;
  activeSeconds?: number;
  expectedSecondsPerCorrect?: number;
}>;

export type PracticeProgressionResult =
  | Readonly<{
    kind: 'invalid';
    reason: 'configuration' | 'progress' | 'sample';
  }>
  | Readonly<{
    kind: 'insufficientSample';
    progress: PracticeProgress;
    unlockedSteps: readonly number[];
  }>
  | Readonly<{
    kind: 'stayed';
    reason: 'lowAccuracy';
    accuracy: number;
    progress: PracticeProgress;
    unlockedSteps: readonly number[];
  }>
  | Readonly<{
    kind: 'advanced';
    accelerated: boolean;
    accuracy: number;
    timeRatio: number | null;
    advanceBy: number;
    progress: PracticeProgress;
    unlockedSteps: readonly number[];
  }>;

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isValidProgress = (progress: PracticeProgress, finalStep: number): boolean =>
  isPositiveSafeInteger(finalStep)
  && isPositiveSafeInteger(progress.currentStep)
  && progress.currentStep <= progress.highestUnlockedStep
  && progress.highestUnlockedStep <= finalStep
  && isNonNegativeSafeInteger(progress.accelerationStreak);

const hasValidConfiguration = (): boolean => {
  const config = GAME_CONFIG.PRACTICE_PROGRESSION;
  return isPositiveSafeInteger(config.MINIMUM_COMPLETED_EQUATIONS)
    && Number.isFinite(config.MINIMUM_ACCURACY)
    && config.MINIMUM_ACCURACY >= 0
    && config.MINIMUM_ACCURACY <= 1
    && Number.isFinite(config.ACCELERATED_ACCURACY)
    && config.ACCELERATED_ACCURACY >= config.MINIMUM_ACCURACY
    && config.ACCELERATED_ACCURACY <= 1
    && Number.isFinite(config.MAX_TIME_RATIO)
    && config.MAX_TIME_RATIO > 0
    && isPositiveSafeInteger(config.MAX_ADVANCE_STEPS);
};

const unlockedBetween = (previousHighest: number, nextHighest: number): number[] =>
  Array.from(
    { length: Math.max(0, nextHighest - previousHighest) },
    (_, index) => previousHighest + index + 1,
  );

const progressAfterAdvance = (
  progress: PracticeProgress,
  requestedAdvance: number,
  nextStreak: number,
  finalStep: number,
): { progress: PracticeProgress; advanceBy: number; unlockedSteps: readonly number[] } => {
  const currentStep = Math.min(finalStep, progress.currentStep + requestedAdvance);
  const highestUnlockedStep = Math.max(progress.highestUnlockedStep, currentStep);
  return {
    progress: {
      currentStep,
      highestUnlockedStep,
      accelerationStreak: nextStreak,
    },
    advanceBy: currentStep - progress.currentStep,
    unlockedSteps: unlockedBetween(progress.highestUnlockedStep, highestUnlockedStep),
  };
};

/** Evaluates one complete assessment round without mutating its inputs. */
export const evaluatePracticeProgressionRound = function(
  progress: PracticeProgress,
  assessment: PracticeAssessment,
  finalStep: number,
): PracticeProgressionResult {
  if (!hasValidConfiguration()) return { kind: 'invalid', reason: 'configuration' };
  if (!isValidProgress(progress, finalStep)) return { kind: 'invalid', reason: 'progress' };

  const { correctAnswers, incorrectAnswers } = assessment;
  if (
    !isNonNegativeSafeInteger(correctAnswers)
    || !isNonNegativeSafeInteger(incorrectAnswers)
    || !Number.isSafeInteger(correctAnswers + incorrectAnswers)
  ) return { kind: 'invalid', reason: 'sample' };

  const minimumAnswers = GAME_CONFIG.PRACTICE_PROGRESSION.MINIMUM_COMPLETED_EQUATIONS;
  if (correctAnswers < minimumAnswers) {
    return { kind: 'insufficientSample', progress, unlockedSteps: [] };
  }

  const accuracy = correctAnswers / (correctAnswers + incorrectAnswers);
  if (accuracy < GAME_CONFIG.PRACTICE_PROGRESSION.MINIMUM_ACCURACY) {
    return {
      kind: 'stayed',
      reason: 'lowAccuracy',
      accuracy,
      progress: { ...progress, accelerationStreak: 0 },
      unlockedSteps: [],
    };
  }

  const activeSeconds = assessment.activeSeconds;
  const expectedSecondsPerCorrect = assessment.expectedSecondsPerCorrect;
  const timeRatio = activeSeconds !== undefined
    && Number.isFinite(activeSeconds)
    && activeSeconds > 0
    && expectedSecondsPerCorrect !== undefined
    && Number.isFinite(expectedSecondsPerCorrect)
    && expectedSecondsPerCorrect > 0
    ? activeSeconds / (correctAnswers * expectedSecondsPerCorrect)
    : null;
  const hasValidTimeRatio = timeRatio !== null && Number.isFinite(timeRatio);
  const accelerated = accuracy >= GAME_CONFIG.PRACTICE_PROGRESSION.ACCELERATED_ACCURACY
    && hasValidTimeRatio
    && timeRatio <= GAME_CONFIG.PRACTICE_PROGRESSION.MAX_TIME_RATIO;

  const nextStreak = accelerated ? progress.accelerationStreak + 1 : 0;
  if (!Number.isSafeInteger(nextStreak)) return { kind: 'invalid', reason: 'progress' };

  const requestedAdvance = accelerated
    ? Math.min(
      GAME_CONFIG.PRACTICE_PROGRESSION.MAX_ADVANCE_STEPS,
      2 ** Math.min(nextStreak, Math.ceil(Math.log2(GAME_CONFIG.PRACTICE_PROGRESSION.MAX_ADVANCE_STEPS))),
    )
    : 1;
  const advancement = progressAfterAdvance(progress, requestedAdvance, nextStreak, finalStep);

  return {
    kind: 'advanced',
    accelerated,
    accuracy,
    timeRatio: hasValidTimeRatio ? timeRatio : null,
    ...advancement,
  };
};
